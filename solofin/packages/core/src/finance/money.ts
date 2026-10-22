/**
 * Para aritmetiği. Tüm tutarlar kuruş (1/100 TL) cinsinden tamsayı olarak tutulur.
 * Kayan nokta yalnızca oran çarpımında kullanılır ve sonuç hemen yuvarlanır.
 */
export type Kurus = number;

export const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** TL (ondalıklı) → kuruş */
export function toKurus(amount: number): Kurus {
  if (!Number.isFinite(amount)) throw new RangeError("Geçersiz tutar");
  return Math.round(amount * 100);
}

/** kuruş → TL (ondalıklı) */
export function fromKurus(k: Kurus): number {
  return k / 100;
}

/** Bir tutarı oranla çarpar ve en yakın kuruşa yuvarlar (yarım değerler yukarı). */
export function applyRate(k: Kurus, rate: number): Kurus {
  return Math.round(k * rate);
}

export function sum(values: readonly Kurus[]): Kurus {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(currency: Currency, fractionDigits: number) {
  const key = `${currency}-${fractionDigits}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, f);
  }
  return f;
}

/** ₺12.345 veya ₺12.345,67 biçiminde gösterir. */
export function formatMoney(
  k: Kurus,
  currency: Currency = "TRY",
  opts: { cents?: boolean; signed?: boolean } = {},
): string {
  const digits = opts.cents ? 2 : 0;
  const text = formatter(currency, digits).format(fromKurus(k));
  if (opts.signed && k > 0) return `+${text}`;
  return text;
}

/** Grafik eksenleri için kısa gösterim: 1,2 Mn / 450 B */
export function formatCompact(k: Kurus): string {
  const tl = fromKurus(k);
  const abs = Math.abs(tl);
  if (abs >= 1_000_000) return `${(tl / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mn`;
  if (abs >= 1_000) return `${(tl / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} B`;
  return tl.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function formatPercent(ratio: number, digits = 1): string {
  return `%${(ratio * 100).toLocaleString("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}`;
}

/** Kullanıcı girişini (ör. "12.500,75" veya "12500.75") kuruşa çevirir. Geçersizse null. */
export function parseMoneyInput(input: string): Kurus | null {
  const trimmed = input.trim().replace(/[₺\s]/g, "");
  if (!trimmed) return null;
  let normalized = trimmed;
  if (/,\d{1,2}$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, "");
  } else {
    normalized = trimmed.replace(/,/g, "");
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return toKurus(Number(normalized));
}
