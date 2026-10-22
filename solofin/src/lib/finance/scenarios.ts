import type { ScenarioLevers } from "../data/schema";
import type { Kurus } from "./money";
import type { YearProjection } from "./summary";
import { computeIncomeTax, type IncomeTaxResult } from "./tax/engine";
import type { TaxRuleSet } from "./tax/rules";

/**
 * Senaryo motoru 12 aylık bir ufukta çalışır. Girdi (Baseline) dondurulur; hiçbir fonksiyon onu değiştirmez.
 */
export interface Baseline {
  monthlyIncome: Kurus;
  monthlyExpense: Kurus;
  /** Ortalama giderin indirilebilir sayılan oranı (0–1) */
  deductibleShare: number;
  monthlySocialSecurity: Kurus;
  deductSocialSecurity: boolean;
  youngEntrepreneur: boolean;
  monthlyPersonalSpend: Kurus;
  /** Başlangıç nakit (vergi rezervi düşülmüş) */
  startingCash: Kurus;
  /** Stopaj oranı (gelirin ne kadarı kaynakta kesiliyor) */
  withholdingRatio: number;
  /** Emeklilik hesabı için: hedef yaşa kalan yıl ve varsayımsal reel getiri */
  yearsToRetirement: number;
  realReturn: number;
}

export const NEUTRAL_LEVERS: ScenarioLevers = {
  oneOffPurchase: 0,
  oneOffPurchaseDeductible: true,
  priceChange: 0,
  incomeDrop: 0,
  newClientMonthly: 0,
  collectionDelayDays: 0,
  monthlyExpenseIncrease: 0,
  extraMonthlySavings: 0,
};

export interface ScenarioOutcome {
  annualIncome: Kurus;
  annualExpense: Kurus;
  depreciation: Kurus;
  tax: IncomeTaxResult;
  netEarnings: Kurus;
  /** 12 aylık nakit tahsilatları (gecikme etkisi dahil) */
  monthlyCash: { month: number; inflow: Kurus; outflow: Kurus; balance: Kurus }[];
  minCash: Kurus;
  endCash: Kurus;
  /** Gelir tamamen kesilirse kaç ay dayanır (senaryo sonrası nakit / aylık çıkış) */
  runwayMonths: number;
  /** Ek birikimin hedef yaştaki reel değeri */
  retirementBoost: Kurus;
}

export interface ScenarioComparison {
  baseline: ScenarioOutcome;
  scenario: ScenarioOutcome;
  diff: {
    annualIncome: Kurus;
    annualExpense: Kurus;
    tax: Kurus;
    netEarnings: Kurus;
    endCash: Kurus;
    minCash: Kurus;
    runwayMonths: number;
  };
  assumptions: string[];
  uncertainties: string[];
}

function evaluate(base: Readonly<Baseline>, levers: Readonly<ScenarioLevers>, rules: TaxRuleSet): ScenarioOutcome {
  const monthlyIncome = Math.round(base.monthlyIncome * (1 + levers.priceChange) * (1 - levers.incomeDrop)) + levers.newClientMonthly;
  const monthlyExpense = base.monthlyExpense + levers.monthlyExpenseIncrease;
  const annualIncome = monthlyIncome * 12;
  const annualExpense = monthlyExpense * 12;

  // Ekipman: sınırı aşıyorsa doğrusal amortisman, değilse doğrudan gider.
  let depreciation = 0;
  let directPurchaseDeduction = 0;
  if (levers.oneOffPurchase > 0 && levers.oneOffPurchaseDeductible) {
    const { amount: threshold, defaultUsefulLifeYears: life } = rules.directExpenseThreshold;
    if (levers.oneOffPurchase <= threshold) directPurchaseDeduction = levers.oneOffPurchase;
    else depreciation = Math.round(levers.oneOffPurchase / life);
  }

  const deductibleOps = Math.round(annualExpense * base.deductibleShare);
  const tax = computeIncomeTax(
    {
      grossIncome: annualIncome,
      confirmedDeductible: deductibleOps + directPurchaseDeduction,
      assumedDeductible: 0,
      includeAssumed: false,
      depreciation,
      socialSecurity: base.monthlySocialSecurity * 12,
      deductSocialSecurity: base.deductSocialSecurity,
      youngEntrepreneur: base.youngEntrepreneur,
      withholdingCredits: 0,
      provisionalPaid: 0,
    },
    rules,
  );

  // Net kazanç: gelir − işletme giderleri − ekipman (nakit) − prim − vergi
  const netEarnings = annualIncome - annualExpense - levers.oneOffPurchase - base.monthlySocialSecurity * 12 - tax.incomeTax;

  // Nakit akışı: tahsilat gecikmesi gelirin zamanlamasını kaydırır (ay hassasiyetinde, kesirli).
  const delayMonths = levers.collectionDelayDays / 30;
  const whole = Math.floor(delayMonths);
  const frac = delayMonths - whole;
  const monthlyTax = Math.round(tax.incomeTax / 12);
  const monthlyOut = monthlyExpense + base.monthlySocialSecurity + base.monthlyPersonalSpend + monthlyTax + levers.extraMonthlySavings;
  const monthlyCash: ScenarioOutcome["monthlyCash"] = [];
  let balance = base.startingCash;
  let minCash = balance;
  for (let m = 0; m < 12; m++) {
    const fromA = m - whole >= 0 ? monthlyIncome * (1 - frac) : 0;
    const fromB = m - whole - 1 >= 0 ? monthlyIncome * frac : 0;
    const inflow = Math.round(fromA + fromB);
    const outflow = monthlyOut + (m === 0 ? levers.oneOffPurchase : 0);
    balance += inflow - outflow;
    minCash = Math.min(minCash, balance);
    monthlyCash.push({ month: m + 1, inflow, outflow, balance });
  }
  const burn = monthlyExpense + base.monthlySocialSecurity + base.monthlyPersonalSpend;
  const runwayMonths = burn > 0 ? Math.max(0, Math.floor((balance / burn) * 10) / 10) : Number.POSITIVE_INFINITY;

  const retirementBoost = futureValueMonthly(levers.extraMonthlySavings, base.realReturn, base.yearsToRetirement);

  return { annualIncome, annualExpense, depreciation, tax, netEarnings, monthlyCash, minCash, endCash: balance, runwayMonths, retirementBoost };
}

/** Aylık sabit katkının n yıl sonundaki değeri (aylık bileşik, reel getiri) */
export function futureValueMonthly(monthly: Kurus, annualRate: number, years: number): Kurus {
  if (monthly <= 0 || years <= 0) return 0;
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  const n = Math.round(years * 12);
  if (r === 0) return monthly * n;
  return Math.round(monthly * ((Math.pow(1 + r, n) - 1) / r));
}

export function compareScenario(base: Readonly<Baseline>, levers: Readonly<ScenarioLevers>, rules: TaxRuleSet): ScenarioComparison {
  const frozen = Object.freeze({ ...base });
  const baseline = evaluate(frozen, NEUTRAL_LEVERS, rules);
  const scenario = evaluate(frozen, levers, rules);

  const assumptions = [
    "Ufuk: önümüzdeki 12 ay. Aylık gelir ve gider son 6 ayın ortalamasıdır.",
    `Giderlerin %${Math.round(base.deductibleShare * 100)}'i indirilebilir kabul edildi (mevcut kayıtlardaki orana göre).`,
    "Gelir vergisi yıllık tutarın 12'de biri olarak her ay nakitten ayrıldı.",
  ];
  if (levers.priceChange !== 0) assumptions.push(`Fiyat değişikliği tüm mevcut gelire uygulandı ve müşteri kaybı olmadığı varsayıldı.`);
  if (levers.incomeDrop > 0) assumptions.push(`Gelir düşüşü fiyat değişikliğinden sonra uygulandı; giderler sabit kaldı.`);
  if (levers.oneOffPurchase > 0) {
    assumptions.push(
      levers.oneOffPurchaseDeductible
        ? `Ekipman, sınır (${(rules.directExpenseThreshold.amount / 100).toLocaleString("tr-TR")} TL) aşılıyorsa ${rules.directExpenseThreshold.defaultUsefulLifeYears} yılda amortismana tabi tutuldu.`
        : "Ekipman vergi açısından indirilebilir kabul edilmedi.",
    );
  }
  if (levers.collectionDelayDays > 0) assumptions.push(`Tüm tahsilatlar ${levers.collectionDelayDays} gün gecikmeli alındı.`);

  const uncertainties = [
    "Vergi kuralları demo tahminidir; resmî mevzuatla birebir doğrulanmamıştır.",
    "Geçmiş ortalamalar gelecekteki geliri garanti etmez.",
  ];
  if (levers.oneOffPurchase > 0 && levers.oneOffPurchaseDeductible) uncertainties.push("Giderin vergi açısından kabulü belgeye ve işle ilişkisine bağlıdır.");
  if (levers.priceChange > 0) uncertainties.push("Zam sonrası müşteri kaybı riski modellenmedi.");
  if (levers.extraMonthlySavings > 0) uncertainties.push("Emeklilik getirisi varsayımsaldır, garanti değildir.");

  return {
    baseline,
    scenario,
    diff: {
      annualIncome: scenario.annualIncome - baseline.annualIncome,
      annualExpense: scenario.annualExpense - baseline.annualExpense,
      tax: scenario.tax.incomeTax - baseline.tax.incomeTax,
      netEarnings: scenario.netEarnings - baseline.netEarnings,
      endCash: scenario.endCash - baseline.endCash,
      minCash: scenario.minCash - baseline.minCash,
      runwayMonths: scenario.runwayMonths - baseline.runwayMonths,
    },
    assumptions,
    uncertainties,
  };
}

export const SCENARIO_PRESETS: { id: string; name: string; description: string; levers: Partial<ScenarioLevers> }[] = [
  { id: "equipment", name: "5.000 TL ekipman alırsam", description: "Tek seferlik iş ekipmanı alımı", levers: { oneOffPurchase: 500_000, oneOffPurchaseDeductible: true } },
  { id: "raise", name: "Fiyatımı %10 artırırsam", description: "Tüm müşterilere fiyat artışı", levers: { priceChange: 0.1 } },
  { id: "drop", name: "Gelirim %30 düşerse", description: "Müşteri veya proje kaybı", levers: { incomeDrop: 0.3 } },
  { id: "client", name: "Yeni müşteri kazanırsam", description: "Aylık 25.000 TL yeni iş", levers: { newClientMonthly: 2_500_000 } },
  { id: "delay", name: "Tahsilatım 30 gün gecikirse", description: "Ödemelerin bir ay kayması", levers: { collectionDelayDays: 30 } },
  { id: "cost", name: "Bir giderim artarsa", description: "Aylık 3.000 TL ek gider", levers: { monthlyExpenseIncrease: 300_000 } },
  { id: "retire", name: "Emeklilik için daha fazla ayırırsam", description: "Aylık 5.000 TL ek birikim", levers: { extraMonthlySavings: 500_000 } },
];

/**
 * Yıl projeksiyonundan senaryo baz durumunu türetir.
 * Bağ-Kur primi ortalama giderden ayrılır (senaryo motorunda ayrı kalem olarak işlenir, çift sayılmaz).
 */
export function baselineFromProjection(
  p: YearProjection,
  opts: {
    cashAfterReserve: Kurus;
    monthlyPersonalSpend: Kurus;
    deductSocialSecurity: boolean;
    youngEntrepreneur: boolean;
    yearsToRetirement: number;
    realReturn: number;
  },
): Baseline {
  const monthlySS = Math.round(p.projectedBasis.socialSecurity / 12);
  const b = p.ytd;
  const deductible = b.confirmedDeductible + b.assumedDeductible;
  const allExp = deductible + b.unknownExpenses + b.nonDeductible;
  return {
    monthlyIncome: p.avgMonthlyIncome,
    monthlyExpense: Math.max(0, p.avgMonthlyExpense - monthlySS),
    deductibleShare: allExp > 0 ? deductible / allExp : 0,
    monthlySocialSecurity: monthlySS,
    deductSocialSecurity: opts.deductSocialSecurity,
    youngEntrepreneur: opts.youngEntrepreneur,
    monthlyPersonalSpend: opts.monthlyPersonalSpend,
    startingCash: opts.cashAfterReserve,
    withholdingRatio: b.grossIncome > 0 ? b.withholdingCredits / b.grossIncome : 0,
    yearsToRetirement: Math.max(0, opts.yearsToRetirement),
    realReturn: opts.realReturn,
  };
}
