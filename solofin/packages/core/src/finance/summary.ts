import type { Settings, Transaction } from "../data/schema";
import { addMonths, monthKey, monthRange, monthOf, yearOf } from "./dates";
import { applyRate, type Kurus } from "./money";
import { computeIncomeTax, computeVat, type IncomeTaxInput, type IncomeTaxResult } from "./tax/engine";
import type { TaxRuleSet } from "./tax/rules";

export const PERSONAL_CATEGORY = "Kişisel";
export const SOCIAL_SECURITY_CATEGORY = "Sosyal Güvenlik (Bağ-Kur)";
export const EQUIPMENT_CATEGORY = "Ekipman";

export function isBusinessExpense(t: Transaction): boolean {
  return t.kind === "expense" && t.category !== PERSONAL_CATEGORY;
}

/** Brüt nakit etkisi: gelir için tutar + KDV − stopaj, gider için tutar + KDV */
export function cashAmount(t: Transaction): Kurus {
  const vat = applyRate(t.amount, t.vatRate);
  if (t.kind === "income") return t.amount + vat - applyRate(t.amount, t.withholdingRate);
  return t.amount + vat;
}

/**
 * Vergi açısından dönemde dikkate alınacak işlem mi?
 * Serbest meslek kazancında tahsil esası (yalnızca ödenmiş), ticari kazançta tahakkuk esası (tüm kayıtlar) varsayılır.
 */
export function countsForTax(t: Transaction, settings: Pick<Settings, "taxpayerType">): boolean {
  if (settings.taxpayerType === "serbest_meslek") return t.status === "paid";
  return true;
}

export interface MonthPoint {
  month: string;
  income: Kurus;
  expense: Kurus;
  net: Kurus;
}

/** Belirli ay anahtarları için gelir/iş gideri toplamları (KDV hariç). Kişisel harcamalar hariç. */
export function monthlySeries(txs: readonly Transaction[], months: readonly string[]): MonthPoint[] {
  const map = new Map<string, MonthPoint>(months.map((m) => [m, { month: m, income: 0, expense: 0, net: 0 }]));
  for (const t of txs) {
    const p = map.get(monthKey(t.date));
    if (!p) continue;
    if (t.kind === "income") p.income += t.amount;
    else if (isBusinessExpense(t)) p.expense += t.amount;
  }
  for (const p of map.values()) p.net = p.income - p.expense;
  return [...map.values()];
}

export function lastNMonths(asOf: string, n: number, includeCurrent = true): string[] {
  const end = includeCurrent ? monthKey(asOf) : monthKey(addMonths(asOf, -1));
  const start = monthKey(addMonths(`${end}-01`, -(n - 1)));
  return monthRange(start, end);
}

export function totals(txs: readonly Transaction[], from: string, to: string) {
  let income = 0;
  let expense = 0;
  let personal = 0;
  for (const t of txs) {
    if (t.date < from || t.date > to) continue;
    if (t.kind === "income") income += t.amount;
    else if (isBusinessExpense(t)) expense += t.amount;
    else personal += t.amount;
  }
  return { income, expense, personal, net: income - expense };
}

export function categoryBreakdown(txs: readonly Transaction[], kind: "income" | "expense", from: string, to: string) {
  const map = new Map<string, Kurus>();
  for (const t of txs) {
    if (t.kind !== kind || t.date < from || t.date > to) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/** Bir ekipman giderinin belirli bir yıldaki vergi indirimi (doğrudan gider veya doğrusal amortisman). */
export function equipmentDeductionForYear(t: Transaction, year: number, rules: TaxRuleSet): { direct: Kurus; depreciation: Kurus } {
  const purchaseYear = yearOf(t.date);
  const { amount: threshold, defaultUsefulLifeYears: life } = rules.directExpenseThreshold;
  if (t.amount <= threshold) return { direct: purchaseYear === year ? t.amount : 0, depreciation: 0 };
  if (year < purchaseYear || year >= purchaseYear + life) return { direct: 0, depreciation: 0 };
  return { direct: 0, depreciation: Math.round(t.amount / life) };
}

export interface TaxBasis {
  grossIncome: Kurus;
  confirmedDeductible: Kurus;
  assumedDeductible: Kurus;
  unknownExpenses: Kurus;
  nonDeductible: Kurus;
  depreciation: Kurus;
  socialSecurity: Kurus;
  withholdingCredits: Kurus;
  salesForVat: { amount: Kurus; vatRate: number }[];
  purchasesForVat: { amount: Kurus; vatRate: number }[];
}

/** Bir tarih aralığındaki işlemlerden vergi matrahı bileşenlerini toplar. */
export function buildTaxBasis(
  txs: readonly Transaction[],
  settings: Pick<Settings, "taxpayerType">,
  rules: TaxRuleSet,
  from: string,
  to: string,
): TaxBasis {
  const b: TaxBasis = {
    grossIncome: 0,
    confirmedDeductible: 0,
    assumedDeductible: 0,
    unknownExpenses: 0,
    nonDeductible: 0,
    depreciation: 0,
    socialSecurity: 0,
    withholdingCredits: 0,
    salesForVat: [],
    purchasesForVat: [],
  };
  const year = yearOf(from);
  for (const t of txs) {
    const inRange = t.date >= from && t.date <= to;
    if (t.kind === "expense" && t.category === EQUIPMENT_CATEGORY && t.amount > rules.directExpenseThreshold.amount) {
      // Amortismana tabi demirbaş: önceki yıllarda alınanlar da bu yıl amortisman doğurabilir.
      if (t.date <= to && countsForTax(t, settings) && isDeductibleFlag(t)) {
        const ded = equipmentDeductionForYear(t, year, rules);
        b.depreciation += ded.depreciation;
      }
      if (inRange && countsForTax(t, settings) && t.deductibility !== "non_deductible") {
        b.purchasesForVat.push({ amount: t.amount, vatRate: t.vatRate });
      }
      continue;
    }
    if (!inRange || !countsForTax(t, settings)) continue;
    if (t.kind === "income") {
      b.grossIncome += t.amount;
      b.withholdingCredits += applyRate(t.amount, t.withholdingRate);
      b.salesForVat.push({ amount: t.amount, vatRate: t.vatRate });
      continue;
    }
    if (t.category === SOCIAL_SECURITY_CATEGORY) {
      b.socialSecurity += t.amount;
      continue;
    }
    switch (t.deductibility) {
      case "confirmed_deductible":
        b.confirmedDeductible += t.amount;
        b.purchasesForVat.push({ amount: t.amount, vatRate: t.vatRate });
        break;
      case "assumed_deductible":
        b.assumedDeductible += t.amount;
        b.purchasesForVat.push({ amount: t.amount, vatRate: t.vatRate });
        break;
      case "non_deductible":
        b.nonDeductible += t.amount;
        break;
      default:
        b.unknownExpenses += t.amount;
    }
  }
  return b;
}

function isDeductibleFlag(t: Transaction) {
  return t.deductibility === "confirmed_deductible" || t.deductibility === "assumed_deductible";
}

export function taxInputFromBasis(
  b: TaxBasis,
  settings: Pick<Settings, "deductSocialSecurity" | "youngEntrepreneur" | "provisionalTaxPaid">,
  opts: { includeAssumed: boolean },
): IncomeTaxInput {
  return {
    grossIncome: b.grossIncome,
    confirmedDeductible: b.confirmedDeductible,
    assumedDeductible: b.assumedDeductible,
    includeAssumed: opts.includeAssumed,
    depreciation: b.depreciation,
    socialSecurity: b.socialSecurity,
    deductSocialSecurity: settings.deductSocialSecurity,
    youngEntrepreneur: settings.youngEntrepreneur,
    withholdingCredits: b.withholdingCredits,
    provisionalPaid: settings.provisionalTaxPaid,
  };
}

export interface YearProjection {
  year: number;
  asOf: string;
  /** Gerçekleşen (YTD) ve tahmini aylar */
  months: (MonthPoint & { projected: boolean })[];
  ytd: TaxBasis;
  projectedBasis: TaxBasis;
  ytdTax: IncomeTaxResult;
  projectedTax: IncomeTaxResult;
  avgMonthlyIncome: Kurus;
  avgMonthlyExpense: Kurus;
  projectedNetEarnings: Kurus;
  assumptions: string[];
}

/**
 * Yıl sonu projeksiyonu: gerçekleşen aylar + kalan aylar için son 6 tamamlanmış ayın ortalaması.
 * Ortalama, vergi esasına göre sayılan işlemler üzerinden hesaplanır.
 */
export function projectYear(
  txs: readonly Transaction[],
  settings: Settings,
  rules: TaxRuleSet,
  asOf: string,
  opts: { includeAssumed?: boolean } = {},
): YearProjection {
  const includeAssumed = opts.includeAssumed ?? true;
  const year = settings.taxYear;
  const from = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const effectiveAsOf = asOf > yearEnd ? yearEnd : asOf < from ? from : asOf;

  const ytd = buildTaxBasis(txs, settings, rules, from, effectiveAsOf);
  const counted = txs.filter((t) => countsForTax(t, settings));

  const window = lastNMonths(effectiveAsOf, 6, false);
  const winSeries = monthlySeries(counted, window);
  const avgMonthlyIncome = Math.round(winSeries.reduce((s, p) => s + p.income, 0) / window.length);
  const avgMonthlyExpense = Math.round(winSeries.reduce((s, p) => s + p.expense, 0) / window.length);

  const currentMonth = monthOf(effectiveAsOf);
  const remainingMonths = asOf > yearEnd ? 0 : 12 - currentMonth;

  const allMonths = monthRange(`${year}-01`, `${year}-12`);
  const actual = monthlySeries(counted, allMonths);
  const months = actual.map((p) => {
    const m = Number(p.month.slice(5, 7));
    if (asOf <= yearEnd && m > currentMonth) {
      return { month: p.month, income: avgMonthlyIncome, expense: avgMonthlyExpense, net: avgMonthlyIncome - avgMonthlyExpense, projected: true };
    }
    return { ...p, projected: false };
  });

  // Kalan aylar için tahmini gelir/giderler, gerçekleşen kırılımla orantılı olarak eklenir.
  const extraIncome = avgMonthlyIncome * remainingMonths;
  const extraExpense = avgMonthlyExpense * remainingMonths;
  const ytdBusinessExpense = ytd.confirmedDeductible + ytd.assumedDeductible + ytd.unknownExpenses + ytd.nonDeductible;
  const share = (part: Kurus) => (ytdBusinessExpense > 0 ? Math.round((extraExpense * part) / ytdBusinessExpense) : 0);
  const withholdingRatio = ytd.grossIncome > 0 ? ytd.withholdingCredits / ytd.grossIncome : 0;
  const projectedBasis: TaxBasis = {
    ...ytd,
    grossIncome: ytd.grossIncome + extraIncome,
    confirmedDeductible: ytd.confirmedDeductible + share(ytd.confirmedDeductible),
    assumedDeductible: ytd.assumedDeductible + (ytdBusinessExpense > 0 ? share(ytd.assumedDeductible) : extraExpense),
    unknownExpenses: ytd.unknownExpenses + share(ytd.unknownExpenses),
    nonDeductible: ytd.nonDeductible + share(ytd.nonDeductible),
    socialSecurity: currentMonth > 0 ? Math.round((ytd.socialSecurity / currentMonth) * (currentMonth + remainingMonths)) : ytd.socialSecurity,
    withholdingCredits: ytd.withholdingCredits + Math.round(extraIncome * withholdingRatio),
  };

  const ytdTax = computeIncomeTax(taxInputFromBasis(ytd, settings, { includeAssumed }), rules);
  const projectedTax = computeIncomeTax(taxInputFromBasis(projectedBasis, settings, { includeAssumed }), rules);
  const projectedExpenses =
    projectedBasis.confirmedDeductible + projectedBasis.assumedDeductible + projectedBasis.unknownExpenses + projectedBasis.nonDeductible;
  const projectedNetEarnings =
    projectedBasis.grossIncome - projectedExpenses - projectedBasis.socialSecurity - projectedTax.incomeTax;

  const assumptions = [
    `Kalan ${remainingMonths} ay için son 6 tamamlanmış ayın ortalaması kullanıldı (aylık gelir ve gider).`,
    settings.taxpayerType === "serbest_meslek"
      ? "Serbest meslek kazancı için tahsil esası: yalnızca ödenmiş gelir ve giderler dikkate alındı."
      : "Ticari kazanç için tahakkuk esası: bekleyen kayıtlar da dikkate alındı.",
    includeAssumed
      ? "Kategoriye göre 'indirilebilir (varsayım)' işaretli giderler matrahtan düşüldü."
      : "Yalnızca onaylı indirilebilir giderler matrahtan düşüldü.",
    "Ekipman alımları doğrudan gider yazma sınırını aşıyorsa doğrusal amortisman uygulandı.",
  ];

  return { year, asOf, months, ytd, projectedBasis, ytdTax, projectedTax, avgMonthlyIncome, avgMonthlyExpense, projectedNetEarnings, assumptions };
}

/** Belirli bir ayın net KDV'si (hesaplanan − indirilecek) */
export function monthVat(txs: readonly Transaction[], settings: Pick<Settings, "taxpayerType">, rules: TaxRuleSet, month: string) {
  const b = buildTaxBasis(txs, settings, rules, `${month}-01`, `${month}-31`);
  return computeVat(b.salesForVat, b.purchasesForVat);
}
