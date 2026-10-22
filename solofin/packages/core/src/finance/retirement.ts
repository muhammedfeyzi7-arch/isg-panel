import type { RetirementInput } from "../data/schema";
import type { Kurus } from "./money";

export interface ReturnProfile {
  id: "cautious" | "moderate" | "high";
  label: string;
  /** Enflasyon üzerindeki varsayımsal yıllık reel getiri */
  realReturn: number;
}

export const RETURN_PROFILES: ReturnProfile[] = [
  { id: "cautious", label: "Temkinli", realReturn: 0.01 },
  { id: "moderate", label: "Orta", realReturn: 0.03 },
  { id: "high", label: "Yüksek (varsayımsal)", realReturn: 0.05 },
];

/** Fisher denklemi: nominal = (1 + reel)(1 + enflasyon) − 1 */
export function nominalFromReal(real: number, inflation: number): number {
  return (1 + real) * (1 + inflation) - 1;
}

export function realFromNominal(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Gelecekteki nominal tutarın bugünkü satın alma gücü */
export function deflate(nominal: Kurus, inflation: number, years: number): Kurus {
  return Math.round(nominal / Math.pow(1 + inflation, years));
}

export interface RetirementProjection {
  profile: ReturnProfile;
  nominalReturn: number;
  years: number;
  /** Bugünün parasıyla (reel) birikim */
  realBalance: Kurus;
  /** Hedef yaştaki nominal birikim */
  nominalBalance: Kurus;
  /** Bugünün parasıyla gereken birikim */
  requiredReal: Kurus;
  gapReal: Kurus;
  /** Hedefe ulaşmak için gereken aylık katkı (bugünün parasıyla) */
  requiredMonthly: Kurus;
  /** Sürdürülebilir aylık emeklilik geliri (bugünün parasıyla) */
  sustainableMonthlyReal: Kurus;
  yearly: { age: number; real: Kurus; nominal: Kurus; contributed: Kurus }[];
}

/**
 * Varsayım: aylık katkı enflasyonla birlikte artar (reel olarak sabittir). Hesap reel değerlerle yapılır,
 * nominal tutar enflasyonla geri şişirilir. Vergiler ve fon giderleri modellenmez.
 */
export function projectRetirement(input: RetirementInput, profile: ReturnProfile): RetirementProjection {
  const years = Math.max(0, input.targetAge - input.currentAge);
  const months = years * 12;
  const rm = Math.pow(1 + profile.realReturn, 1 / 12) - 1;
  let real = input.currentSavings;
  let contributed = input.currentSavings;
  const yearly: RetirementProjection["yearly"] = [{ age: input.currentAge, real, nominal: real, contributed }];
  for (let m = 1; m <= months; m++) {
    real = real * (1 + rm) + input.monthlyContribution;
    contributed += input.monthlyContribution;
    if (m % 12 === 0) {
      const y = m / 12;
      yearly.push({ age: input.currentAge + y, real: Math.round(real), nominal: Math.round(real * Math.pow(1 + input.inflation, y)), contributed });
    }
  }
  const realBalance = Math.round(real);
  const requiredReal = Math.round((input.targetMonthlyBudget * 12) / input.withdrawalRate);
  const gapReal = Math.max(0, requiredReal - realBalance);

  const growth = Math.pow(1 + rm, months);
  const fvExisting = input.currentSavings * growth;
  const annuity = rm === 0 ? months : (growth - 1) / rm;
  const requiredMonthly = months > 0 ? Math.max(0, Math.ceil((requiredReal - fvExisting) / annuity)) : 0;

  return {
    profile,
    nominalReturn: nominalFromReal(profile.realReturn, input.inflation),
    years,
    realBalance,
    nominalBalance: Math.round(real * Math.pow(1 + input.inflation, years)),
    requiredReal,
    gapReal,
    requiredMonthly,
    sustainableMonthlyReal: Math.round((realBalance * input.withdrawalRate) / 12),
    yearly,
  };
}
