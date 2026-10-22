import { describe, expect, it } from "vitest";
import { computeIncomeTax, computeProgressiveTax, computeVat, deductionImpact, marginalRate, type IncomeTaxInput } from "../src/finance/tax/engine";
import { TR_2026, getRuleSet, isFullyVerified, type Bracket } from "../src/finance/tax/rules";

const TL = (n: number) => Math.round(n * 100);

/**
 * NOT: Bu testler motorun ARİTMETİĞİNİ doğrular. Aşağıdaki "TEST_BRACKETS" kurgusal bir tarifedir;
 * gerçek mevzuata uygunluk iddiası taşımaz. 2026 tarifesiyle ilgili testler ise kural setinde
 * kayıtlı (ikincil kaynaklardan alınmış, resmî olarak doğrulanmamış) değerlerin tutarlı
 * uygulandığını kontrol eder — mevzuat doğrulaması değildir.
 */
const TEST_BRACKETS: Bracket[] = [
  { upTo: TL(100_000), rate: 0.1 },
  { upTo: TL(200_000), rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

const baseInput: IncomeTaxInput = {
  grossIncome: 0,
  confirmedDeductible: 0,
  assumedDeductible: 0,
  includeAssumed: true,
  socialSecurity: 0,
  deductSocialSecurity: false,
  youngEntrepreneur: false,
  withholdingCredits: 0,
  provisionalPaid: 0,
};

describe("computeProgressiveTax — kurgusal tarife", () => {
  it("dilim sınırının hemen altı, kendisi ve hemen üstü", () => {
    expect(computeProgressiveTax(TL(100_000) - 1, TEST_BRACKETS).tax).toBe(Math.round((TL(100_000) - 1) * 0.1));
    expect(computeProgressiveTax(TL(100_000), TEST_BRACKETS).tax).toBe(TL(10_000));
    // 1 kuruş fazlası yalnızca %20 ile vergilenir (tüm gelir değil)
    expect(computeProgressiveTax(TL(100_000) + 1, TEST_BRACKETS).tax).toBe(TL(10_000) + Math.round(1 * 0.2));
    expect(computeProgressiveTax(TL(100_000) + 100, TEST_BRACKETS).tax).toBe(TL(10_000) + 20);
  });

  it("tüm gelire marjinal oran uygulanmaz", () => {
    const { tax } = computeProgressiveTax(TL(250_000), TEST_BRACKETS);
    expect(tax).toBe(TL(10_000 + 20_000 + 15_000));
    expect(tax).toBeLessThan(TL(250_000) * 0.3);
  });

  it("dilim kırılımlarının toplamı toplam vergiye eşittir", () => {
    const r = computeProgressiveTax(TL(345_678.9), TEST_BRACKETS);
    expect(r.slices.reduce((s, x) => s + x.taxInSlice, 0)).toBe(r.tax);
    expect(r.slices.reduce((s, x) => s + x.taxableInSlice, 0)).toBe(TL(345_678.9));
    expect(r.slices).toHaveLength(3);
  });

  it("sıfır ve negatif matrah vergi doğurmaz", () => {
    expect(computeProgressiveTax(0, TEST_BRACKETS).tax).toBe(0);
    expect(computeProgressiveTax(-TL(5_000), TEST_BRACKETS).tax).toBe(0);
  });

  it("marjinal oran sınırda alt dilimde kalır", () => {
    expect(marginalRate(TL(100_000), TEST_BRACKETS)).toBe(0.1);
    expect(marginalRate(TL(100_000) + 1, TEST_BRACKETS)).toBe(0.2);
  });
});

describe("2026 kural seti (ikincil kaynak, doğrulanmamış) tutarlılığı", () => {
  const b = TR_2026.incomeTax.brackets;
  it.each([
    [190_000, 28_500],
    [400_000, 70_500],
    [1_000_000, 232_500],
    [5_300_000, 1_737_500],
  ])("%d TL matrah → birikimli vergi %d TL", (base, expected) => {
    expect(computeProgressiveTax(TL(base), b).tax).toBe(TL(expected));
  });

  it("sınırın 1 TL üstü bir sonraki dilim oranıyla vergilenir", () => {
    expect(computeProgressiveTax(TL(190_001), b).tax).toBe(TL(28_500) + TL(0.2));
    expect(computeProgressiveTax(TL(1_000_001), b).tax).toBe(TL(232_500) + TL(0.35));
  });

  it("kural seti resmî olarak doğrulanmadığı için demo tahminidir", () => {
    expect(isFullyVerified(TR_2026)).toBe(false);
    expect(computeIncomeTax({ ...baseInput, grossIncome: TL(500_000) }, TR_2026).isDemoEstimate).toBe(true);
  });

  it("her kuralın kaynak ve yürürlük bilgisi vardır", () => {
    for (const meta of [TR_2026.incomeTax.meta, TR_2026.vat.meta, TR_2026.withholding.meta, TR_2026.provisionalTax.meta]) {
      expect(meta.source.length).toBeGreaterThan(5);
      expect(meta.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(meta).toHaveProperty("lastVerifiedAt");
    }
  });

  it("bilinmeyen yıl en yakın kural setine düşer ve işaretlenir", () => {
    expect(getRuleSet(2030).fallback).toBe(true);
    expect(getRuleSet(2026).fallback).toBe(false);
  });
});

describe("computeIncomeTax", () => {
  it("gelir sıfır → vergi sıfır", () => {
    const r = computeIncomeTax(baseInput, TR_2026);
    expect(r.incomeTax).toBe(0);
    expect(r.taxableBase).toBe(0);
    expect(r.effectiveRate).toBe(0);
  });

  it("gider gelire eşit → matrah ve vergi sıfır, zarar değil", () => {
    const r = computeIncomeTax({ ...baseInput, grossIncome: TL(300_000), confirmedDeductible: TL(300_000) }, TR_2026);
    expect(r.profit).toBe(0);
    expect(r.incomeTax).toBe(0);
    expect(r.isLoss).toBe(false);
  });

  it("zarar durumunda vergi doğmaz ve not eklenir", () => {
    const r = computeIncomeTax({ ...baseInput, grossIncome: TL(100_000), confirmedDeductible: TL(150_000) }, TR_2026);
    expect(r.profit).toBe(-TL(50_000));
    expect(r.taxableBase).toBe(0);
    expect(r.incomeTax).toBe(0);
    expect(r.isLoss).toBe(true);
    expect(r.notes.join(" ")).toMatch(/zarar/i);
  });

  it("varsayımsal giderler kapatıldığında matraha dahil edilmez", () => {
    const withA = computeIncomeTax({ ...baseInput, grossIncome: TL(500_000), assumedDeductible: TL(100_000) }, TR_2026);
    const withoutA = computeIncomeTax({ ...baseInput, grossIncome: TL(500_000), assumedDeductible: TL(100_000), includeAssumed: false }, TR_2026);
    expect(withA.taxableBase).toBe(TL(400_000));
    expect(withoutA.taxableBase).toBe(TL(500_000));
  });

  it("stopaj ve geçici vergi mahsup edilir; fazlası negatif kalan olarak gösterilir", () => {
    const r = computeIncomeTax({ ...baseInput, grossIncome: TL(190_000), withholdingCredits: TL(20_000), provisionalPaid: TL(10_000) }, TR_2026);
    expect(r.incomeTax).toBe(TL(28_500));
    expect(r.remainingPayable).toBe(-TL(1_500));
  });

  it("genç girişimci istisnası matrahı istisna tutarı kadar azaltır", () => {
    const r = computeIncomeTax({ ...baseInput, grossIncome: TL(600_000), youngEntrepreneur: true }, TR_2026);
    expect(r.youngEntrepreneurExemption).toBe(TR_2026.youngEntrepreneur.exemptionAmount);
    expect(r.taxableBase).toBe(TL(600_000) - TR_2026.youngEntrepreneur.exemptionAmount);
  });

  it("Bağ-Kur indirimi ayara bağlıdır", () => {
    const on = computeIncomeTax({ ...baseInput, grossIncome: TL(400_000), socialSecurity: TL(100_000), deductSocialSecurity: true }, TR_2026);
    const off = computeIncomeTax({ ...baseInput, grossIncome: TL(400_000), socialSecurity: TL(100_000), deductSocialSecurity: false }, TR_2026);
    expect(on.taxableBase).toBe(TL(300_000));
    expect(off.taxableBase).toBe(TL(400_000));
  });
});

describe("KDV gelir vergisinden ayrıdır", () => {
  it("hesaplanan − indirilecek", () => {
    const r = computeVat([{ amount: TL(100_000), vatRate: 0.2 }], [{ amount: TL(30_000), vatRate: 0.2 }]);
    expect(r.outputVat).toBe(TL(20_000));
    expect(r.inputVat).toBe(TL(6_000));
    expect(r.payable).toBe(TL(14_000));
    expect(r.carryForward).toBe(0);
  });
  it("indirilecek KDV fazlası devreder", () => {
    const r = computeVat([{ amount: TL(10_000), vatRate: 0.2 }], [{ amount: TL(50_000), vatRate: 0.2 }]);
    expect(r.payable).toBe(0);
    expect(r.carryForward).toBe(TL(8_000));
  });
});

describe("deductionImpact", () => {
  it("vergi farkı, gider tutarı × ilgili dilim oranıdır ve net maliyet pozitiftir", () => {
    const base = { ...baseInput, grossIncome: TL(700_000) };
    const r = deductionImpact(base, TL(50_000), TR_2026);
    expect(r.taxDifference).toBe(TL(50_000 * 0.27));
    expect(r.netCost).toBe(TL(50_000) - r.taxDifference);
    expect(r.netCost).toBeGreaterThan(0); // gider her zaman nakit olarak vergiden daha pahalıdır
  });
});

describe("vergi görünümü", async () => {
  const { taxView } = await import("../src/finance/taxView");
  const { generateDemoTransactions, demoSettings } = await import("../src/data/demo");
  it("kümülatif seri artan, KDV ayrı, geçici vergi dönemleri kural setiyle uyumlu", () => {
    const today = "2026-10-22";
    const v = taxView(generateDemoTransactions(today), demoSettings(today), TR_2026, today, true);
    expect(v.cumulative).toHaveLength(12);
    for (let i = 1; i < 12; i++) expect(v.cumulative[i].income).toBeGreaterThanOrEqual(v.cumulative[i - 1].income);
    expect(v.provisional).toHaveLength(TR_2026.provisionalTax.quarters.length);
    expect(v.vat.ytd.outputVat).toBeGreaterThan(0);
    expect(v.vat.ytd.net).toBe(v.vat.ytd.outputVat - v.vat.ytd.inputVat);
  });
});
