import { applyRate, type Kurus } from "../money";
import { isFullyVerified, type Bracket, type TaxRuleSet } from "./rules";

export interface BracketSlice {
  from: Kurus;
  to: Kurus | null;
  rate: number;
  /** Bu dilime düşen matrah */
  taxableInSlice: Kurus;
  taxInSlice: Kurus;
}

/**
 * Artan oranlı tarife: her dilimin oranı YALNIZCA o dilime düşen tutara uygulanır.
 * Negatif matrah sıfır kabul edilir.
 */
export function computeProgressiveTax(base: Kurus, brackets: readonly Bracket[]): { tax: Kurus; slices: BracketSlice[] } {
  const taxable = Math.max(0, Math.round(base));
  const slices: BracketSlice[] = [];
  let lower = 0;
  let tax = 0;
  for (const b of brackets) {
    const upper = b.upTo;
    const inSlice = Math.max(0, Math.min(taxable, upper ?? Number.POSITIVE_INFINITY) - lower);
    const sliceTax = applyRate(inSlice, b.rate);
    slices.push({ from: lower, to: upper, rate: b.rate, taxableInSlice: inSlice, taxInSlice: sliceTax });
    tax += sliceTax;
    if (upper === null || taxable <= upper) {
      // kalan dilimleri sıfır olarak ekle (görselleştirme tutarlılığı için)
      const idx = brackets.indexOf(b);
      let lo = upper ?? lower;
      for (const rest of brackets.slice(idx + 1)) {
        slices.push({ from: lo, to: rest.upTo, rate: rest.rate, taxableInSlice: 0, taxInSlice: 0 });
        lo = rest.upTo ?? lo;
      }
      break;
    }
    lower = upper;
  }
  return { tax, slices };
}

/** Matrahın düştüğü marjinal oran */
export function marginalRate(base: Kurus, brackets: readonly Bracket[]): number {
  for (const b of brackets) if (b.upTo === null || base <= b.upTo) return b.rate;
  return brackets[brackets.length - 1].rate;
}

export interface IncomeTaxInput {
  grossIncome: Kurus;
  /** İndirilebilir olarak onaylanmış giderler */
  confirmedDeductible: Kurus;
  /** Kategori varsayımına göre indirilebilir sayılan giderler */
  assumedDeductible: Kurus;
  /** Varsayılan indirilebilir giderler hesaba katılsın mı */
  includeAssumed: boolean;
  /** Amortisman yoluyla bu yıl gider yazılan tutar */
  depreciation?: Kurus;
  /** Yıllık sosyal güvenlik primi */
  socialSecurity: Kurus;
  deductSocialSecurity: boolean;
  youngEntrepreneur: boolean;
  /** Kaynakta kesilen stopajlar (mahsup edilir) */
  withholdingCredits: Kurus;
  /** Ödenmiş geçici vergiler (mahsup edilir) */
  provisionalPaid: Kurus;
}

export interface IncomeTaxResult {
  grossIncome: Kurus;
  deductibleExpenses: Kurus;
  socialSecurityDeduction: Kurus;
  /** Kazanç (gelir − indirilebilir giderler − prim). Negatif olabilir (zarar). */
  profit: Kurus;
  youngEntrepreneurExemption: Kurus;
  taxableBase: Kurus;
  incomeTax: Kurus;
  slices: BracketSlice[];
  effectiveRate: number;
  marginalRate: number;
  withholdingCredits: Kurus;
  provisionalPaid: Kurus;
  /** Pozitif: ödenecek; negatif: mahsup/iade edilebilir fazla ödeme */
  remainingPayable: Kurus;
  isLoss: boolean;
  isDemoEstimate: boolean;
  ruleSetId: string;
  notes: string[];
}

export function computeIncomeTax(input: IncomeTaxInput, rules: TaxRuleSet): IncomeTaxResult {
  const notes: string[] = [];
  const deductible =
    input.confirmedDeductible + (input.includeAssumed ? input.assumedDeductible : 0) + (input.depreciation ?? 0);
  if (!input.includeAssumed && input.assumedDeductible > 0) {
    notes.push("Varsayımsal indirilebilir giderler matraha dahil edilmedi.");
  }
  const ssDeduction = input.deductSocialSecurity && rules.socialSecurity.deductible ? input.socialSecurity : 0;
  const profit = input.grossIncome - deductible - ssDeduction;
  const isLoss = profit < 0;
  if (isLoss) notes.push("Dönem zararı oluştu; gelir vergisi doğmaz. Zararın sonraki yıllara devri modellenmedi.");

  const positiveProfit = Math.max(0, profit);
  const exemption = input.youngEntrepreneur ? Math.min(positiveProfit, rules.youngEntrepreneur.exemptionAmount) : 0;
  if (exemption > 0) notes.push("Genç girişimci istisnası kullanıcı beyanına göre uygulandı.");

  const taxableBase = positiveProfit - exemption;
  const { tax, slices } = computeProgressiveTax(taxableBase, rules.incomeTax.brackets);

  const credits = input.withholdingCredits + input.provisionalPaid;
  const remaining = tax - credits;
  if (remaining < 0) notes.push("Mahsup edilecek vergiler hesaplanan vergiyi aşıyor; fark mahsup/iade konusu olabilir.");

  return {
    grossIncome: input.grossIncome,
    deductibleExpenses: deductible,
    socialSecurityDeduction: ssDeduction,
    profit,
    youngEntrepreneurExemption: exemption,
    taxableBase,
    incomeTax: tax,
    slices,
    effectiveRate: input.grossIncome > 0 ? tax / input.grossIncome : 0,
    marginalRate: marginalRate(taxableBase, rules.incomeTax.brackets),
    withholdingCredits: input.withholdingCredits,
    provisionalPaid: input.provisionalPaid,
    remainingPayable: remaining,
    isLoss,
    isDemoEstimate: !isFullyVerified(rules),
    ruleSetId: rules.id,
    notes,
  };
}

export interface VatResult {
  outputVat: Kurus;
  inputVat: Kurus;
  /** Pozitif: ödenecek KDV; negatif: devreden KDV */
  net: Kurus;
  payable: Kurus;
  carryForward: Kurus;
}

/** KDV gelir vergisinden bağımsız hesaplanır: hesaplanan KDV − indirilecek KDV. */
export function computeVat(
  sales: readonly { amount: Kurus; vatRate: number }[],
  purchases: readonly { amount: Kurus; vatRate: number }[],
  carriedIn: Kurus = 0,
): VatResult {
  const outputVat = sales.reduce((s, t) => s + applyRate(t.amount, t.vatRate), 0);
  const inputVat = purchases.reduce((s, t) => s + applyRate(t.amount, t.vatRate), 0) + carriedIn;
  const net = outputVat - inputVat;
  return { outputVat, inputVat, net, payable: Math.max(0, net), carryForward: Math.max(0, -net) };
}

/**
 * Bir giderin vergi açısından kabul edilmesi durumunda oluşabilecek fark.
 * Kullanıcıyı harcamaya teşvik etmez; yalnızca "kabul edilirse" farkı gösterir.
 */
export function deductionImpact(
  base: IncomeTaxInput,
  expense: Kurus,
  rules: TaxRuleSet,
): { without: IncomeTaxResult; with: IncomeTaxResult; taxDifference: Kurus; netCost: Kurus } {
  const without = computeIncomeTax(base, rules);
  const withExp = computeIncomeTax({ ...base, confirmedDeductible: base.confirmedDeductible + expense }, rules);
  const taxDifference = without.incomeTax - withExp.incomeTax;
  return { without, with: withExp, taxDifference, netCost: expense - taxDifference };
}

/** Geçici vergi tahmini: kümülatif dönem kazancı × oran − önceki ödemeler (basitleştirilmiş). */
export function estimateProvisionalTax(
  cumulativeProfit: Kurus,
  previouslyPaid: Kurus,
  rules: TaxRuleSet,
): Kurus {
  return Math.max(0, applyRate(Math.max(0, cumulativeProfit), rules.provisionalTax.rate) - previouslyPaid);
}
