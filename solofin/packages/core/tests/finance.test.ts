import { describe, expect, it } from "vitest";
import { compareScenario, futureValueMonthly, NEUTRAL_LEVERS, type Baseline } from "../src/finance/scenarios";
import { deflate, nominalFromReal, projectRetirement, realFromNominal, RETURN_PROFILES } from "../src/finance/retirement";
import { TR_2026 } from "../src/finance/tax/rules";
import { formatMoney, parseMoneyInput, toKurus } from "../src/finance/money";
import { addMonths, monthRange } from "../src/finance/dates";
import { generateDemoTransactions, demoRecurring, demoSettings } from "../src/data/demo";
import { projectYear, totals, buildTaxBasis } from "../src/finance/summary";
import { safeToSpend, occurrences, resilience, taxReserve } from "../src/finance/cashflow";
import { transactionSchema } from "../src/data/schema";

const TL = (n: number) => Math.round(n * 100);

const baseline: Baseline = {
  monthlyIncome: TL(100_000),
  monthlyExpense: TL(25_000),
  deductibleShare: 0.8,
  monthlySocialSecurity: TL(8_800),
  deductSocialSecurity: true,
  youngEntrepreneur: false,
  monthlyPersonalSpend: TL(35_000),
  startingCash: TL(300_000),
  withholdingRatio: 0.15,
  yearsToRetirement: 25,
  realReturn: 0.03,
};

describe("money", () => {
  it("TR biçimli girişleri ayrıştırır", () => {
    expect(parseMoneyInput("12.500,75")).toBe(1_250_075);
    expect(parseMoneyInput("12500.75")).toBe(1_250_075);
    expect(parseMoneyInput("1.250.000")).toBe(125_000_000);
    expect(parseMoneyInput("₺ 49999")).toBe(4_999_900);
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("")).toBeNull();
  });
  it("kayan nokta hatası üretmez", () => {
    expect(toKurus(0.1) + toKurus(0.2)).toBe(toKurus(0.3));
  });
  it("TL biçimlendirir", () => {
    expect(formatMoney(TL(542_300))).toMatch(/542\.300/);
  });
});

describe("senaryo motoru", () => {
  it("nötr kaldıraçlar baz durumla birebir aynı sonucu verir", () => {
    const c = compareScenario(baseline, NEUTRAL_LEVERS, TR_2026);
    expect(c.diff.netEarnings).toBe(0);
    expect(c.diff.tax).toBe(0);
    expect(c.diff.endCash).toBe(0);
  });

  it("senaryo baz veriyi değiştirmez", () => {
    const copy = structuredClone(baseline);
    compareScenario(baseline, { ...NEUTRAL_LEVERS, priceChange: 0.1, incomeDrop: 0.3, oneOffPurchase: TL(80_000) }, TR_2026);
    expect(baseline).toEqual(copy);
  });

  it("matematiksel tutarlılık: net fark = gelir farkı − gider farkı − vergi farkı − ekipman", () => {
    const levers = { ...NEUTRAL_LEVERS, priceChange: 0.1, monthlyExpenseIncrease: TL(3_000), oneOffPurchase: TL(5_000) };
    const c = compareScenario(baseline, levers, TR_2026);
    expect(c.diff.netEarnings).toBe(c.diff.annualIncome - c.diff.annualExpense - c.diff.tax - levers.oneOffPurchase);
    expect(c.diff.annualIncome).toBe(TL(10_000) * 12);
    expect(c.scenario.netEarnings).toBe(c.baseline.netEarnings + c.diff.netEarnings);
  });

  it("%10 zam vergiyi artırır ama net kazancı da artırır", () => {
    const c = compareScenario(baseline, { ...NEUTRAL_LEVERS, priceChange: 0.1 }, TR_2026);
    expect(c.diff.tax).toBeGreaterThan(0);
    expect(c.diff.netEarnings).toBeGreaterThan(0);
    expect(c.diff.netEarnings).toBeLessThan(c.diff.annualIncome);
  });

  it("%30 gelir düşüşü net kazancı ve nakit tamponunu azaltır", () => {
    const c = compareScenario(baseline, { ...NEUTRAL_LEVERS, incomeDrop: 0.3 }, TR_2026);
    expect(c.diff.annualIncome).toBe(-TL(30_000) * 12);
    expect(c.diff.netEarnings).toBeLessThan(0);
    expect(c.scenario.runwayMonths).toBeLessThan(c.baseline.runwayMonths);
  });

  it("sınır altı ekipman doğrudan gider, sınır üstü amortisman", () => {
    const small = compareScenario(baseline, { ...NEUTRAL_LEVERS, oneOffPurchase: TL(5_000) }, TR_2026);
    expect(small.scenario.depreciation).toBe(0);
    expect(small.diff.tax).toBeLessThan(0);
    const big = compareScenario(baseline, { ...NEUTRAL_LEVERS, oneOffPurchase: TL(80_000) }, TR_2026);
    expect(big.scenario.depreciation).toBe(TL(20_000));
  });

  it("tahsilat gecikmesi yıllık geliri değil nakit zamanlamasını etkiler", () => {
    const c = compareScenario(baseline, { ...NEUTRAL_LEVERS, collectionDelayDays: 30 }, TR_2026);
    expect(c.diff.annualIncome).toBe(0);
    expect(c.scenario.monthlyCash[0].inflow).toBe(0);
    expect(c.diff.minCash).toBeLessThan(0);
    expect(c.diff.endCash).toBe(-baseline.monthlyIncome);
  });

  it("ek emeklilik birikimi gelecekteki değeri artırır", () => {
    const c = compareScenario(baseline, { ...NEUTRAL_LEVERS, extraMonthlySavings: TL(5_000) }, TR_2026);
    expect(c.scenario.retirementBoost).toBeGreaterThan(TL(5_000) * 12 * 25);
  });
});

describe("emeklilik ve enflasyon", () => {
  it("Fisher denklemi ters çevrilebilir", () => {
    const n = nominalFromReal(0.03, 0.25);
    expect(n).toBeCloseTo(0.2875, 10);
    expect(realFromNominal(n, 0.25)).toBeCloseTo(0.03, 10);
  });

  it("enflasyondan arındırma", () => {
    expect(deflate(TL(1_250), 0.25, 1)).toBe(TL(1_000));
    expect(deflate(TL(1_000), 0, 10)).toBe(TL(1_000));
  });

  it("sıfır getiri + katkı = katkıların toplamı", () => {
    expect(futureValueMonthly(TL(1_000), 0, 2)).toBe(TL(24_000));
  });

  it("projeksiyon reel ve nominal tutarları ayrı verir; profiller sıralıdır", () => {
    const input = { currentAge: 30, targetAge: 60, currentSavings: TL(100_000), monthlyContribution: TL(5_000), inflation: 0.2, targetMonthlyBudget: TL(50_000), withdrawalRate: 0.04 };
    const [c, m, h] = RETURN_PROFILES.map((p) => projectRetirement(input, p));
    expect(c.realBalance).toBeLessThan(m.realBalance);
    expect(m.realBalance).toBeLessThan(h.realBalance);
    expect(m.nominalBalance).toBeGreaterThan(m.realBalance);
    expect(Math.abs(m.nominalBalance / (m.realBalance * Math.pow(1.2, 30)) - 1)).toBeLessThan(1e-6);
    expect(m.requiredReal).toBe(TL(50_000 * 12 / 0.04));
    // Gerekli aylık katkıyla hedefe ulaşılmalı
    const check = projectRetirement({ ...input, monthlyContribution: m.requiredMonthly }, m.profile);
    expect(check.realBalance).toBeGreaterThanOrEqual(m.requiredReal - 100);
  });
});

describe("demo veri ve özetler", () => {
  const today = "2026-10-22";
  const txs = generateDemoTransactions(today);
  const settings = demoSettings(today);
  const recurring = demoRecurring(today);

  it("deterministik ve şemaya uygun", () => {
    expect(generateDemoTransactions(today)).toEqual(txs);
    for (const t of txs) expect(transactionSchema.safeParse(t).success).toBe(true);
    expect(txs.every((t) => t.source === "demo")).toBe(true);
  });

  it("gelecekte tarihli ödenmiş işlem yoktur", () => {
    expect(txs.filter((t) => t.status === "paid" && t.date > today)).toHaveLength(0);
  });

  it("yıl projeksiyonu YTD + kalan ayları içerir", () => {
    const p = projectYear(txs, settings, TR_2026, today);
    expect(p.months).toHaveLength(12);
    expect(p.months.filter((m) => m.projected)).toHaveLength(2);
    expect(p.projectedBasis.grossIncome).toBe(p.ytd.grossIncome + p.avgMonthlyIncome * 2);
    expect(p.projectedTax.incomeTax).toBeGreaterThanOrEqual(p.ytdTax.incomeTax);
  });

  it("güvenle harcanabilir tutar bileşenlerinden tutarlı türetilir", () => {
    const s = safeToSpend(txs, recurring, settings, TR_2026, today);
    expect(s.rawAmount).toBe(s.cashBalance - s.taxReserve.total - s.upcomingObligations - s.safetyBuffer);
    expect(s.safeAmount).toBe(Math.max(0, s.rawAmount));
    expect(s.taxReserve.total).toBeGreaterThan(0);
  });

  it("tekrarlayan kalemler kayıtlıysa çift sayılmaz", () => {
    const rent = recurring.find((r) => r.id === "rec-rent")!;
    expect(occurrences(rent, "2026-11-01", "2026-12-31")).toEqual(["2026-11-03", "2026-12-03"]);
  });

  it("dayanıklılık satırları düşüş arttıkça kısalır", () => {
    const p = projectYear(txs, settings, TR_2026, today);
    const r = resilience(p, settings, taxReserve(p, txs, settings, TR_2026, today));
    const finite = r.rows.filter((x) => x.months !== null).map((x) => x.months!);
    for (let i = 1; i < finite.length; i++) expect(finite[i]).toBeLessThanOrEqual(finite[i - 1]);
    expect(r.rows.at(-1)!.months).not.toBeNull();
  });

  it("toplamlar kişisel harcamaları iş giderinden ayırır", () => {
    const t = totals(txs, "2026-01-01", today);
    expect(t.personal).toBeGreaterThan(0);
    const b = buildTaxBasis(txs, settings, TR_2026, "2026-01-01", today);
    expect(b.nonDeductible).toBeGreaterThan(0);
    expect(b.depreciation).toBe(Math.round(TL(49_999) / 4));
  });

  it("ay aralığı yardımcıları", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("ortak veritabanı ve genel bakış", async () => {
  const { loadDatabase, seedDemoDatabase, userIdFor } = await import("../src/data/db");
  const { computeOverview } = await import("../src/finance/overview");
  it("bozuk veya boş depolamada moda uygun başlangıç verisi döner; demo ve yerel ayrıdır", () => {
    const demo = loadDatabase("{bozuk", "demo", "2026-10-22");
    expect(demo.transactions.length).toBeGreaterThan(20);
    const local = loadDatabase(null, "local", "2026-10-22");
    expect(local.transactions).toHaveLength(0);
    expect(local.settings[userIdFor("local")]).toBeDefined();
    expect(userIdFor("demo")).not.toBe(userIdFor("local"));
  });
  it("genel bakış motor fonksiyonlarıyla tutarlıdır", () => {
    const db = seedDemoDatabase("2026-10-22");
    const o = computeOverview(db.transactions, db.recurring, db.settings[userIdFor("demo")], "2026-10-22");
    expect(o.safe.rawAmount).toBe(o.safe.cashBalance - o.safe.taxReserve.total - o.safe.upcomingObligations - o.safe.safetyBuffer);
    expect(o.rules.year).toBe(2026);
  });
});

describe("senaryo özeti", async () => {
  const { scenarioInsight, isNeutral } = await import("../src/finance/scenarios");
  it("nötr kaldıraçlarda yönlendirme metni, ekipmanda vergi avantajının harcamadan küçük olduğunu söyler", () => {
    expect(isNeutral(NEUTRAL_LEVERS)).toBe(true);
    expect(scenarioInsight(NEUTRAL_LEVERS, compareScenario(baseline, NEUTRAL_LEVERS, TR_2026).diff)).toMatch(/Bir varsayımı/);
    const lev = { ...NEUTRAL_LEVERS, oneOffPurchase: TL(5_000) };
    const text = scenarioInsight(lev, compareScenario(baseline, lev, TR_2026).diff);
    expect(text).toMatch(/azalır/);
    expect(text).toMatch(/harcamanın kendisinden küçüktür/);
  });
});
