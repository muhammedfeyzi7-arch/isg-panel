import type { Kurus } from "../money";

/**
 * Vergi kuralı meta verisi. Her kural; kaynak, yürürlük tarihi ve son doğrulama bilgisini taşır.
 * `verification` alanı:
 *  - "official": resmî kaynaktan (Resmî Gazete / GİB) birebir doğrulandı
 *  - "secondary": ikincil kaynaklarla karşılaştırıldı, resmî metinle birebir doğrulanmadı
 *  - "unverified": türetilmiş veya varsayılan değer; doğrulanmadı
 * Uygulama yalnızca TÜM kurallar "official" ise sonucu demo olmayan tahmin olarak gösterir.
 */
export type Verification = "official" | "secondary" | "unverified";

export interface RuleMeta {
  source: string;
  sourceUrl?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  lastVerifiedAt: string | null;
  verification: Verification;
  note?: string;
}

export interface Bracket {
  /** Dilimin üst sınırı (kuruş). null = sınırsız */
  upTo: Kurus | null;
  rate: number;
}

export interface TaxRuleSet {
  id: string;
  country: "TR";
  year: number;
  label: string;
  incomeTax: { brackets: Bracket[]; meta: RuleMeta };
  /** Serbest meslek ödemelerinde kaynakta kesilen gelir vergisi stopajı */
  withholding: { serbestMeslekRate: number; meta: RuleMeta };
  /** Geçici vergi: dönem kazancına uygulanan oran ve dönemler */
  provisionalTax: { rate: number; quarters: { label: string; endMonth: number; dueMonth: number; dueDay: number }[]; meta: RuleMeta };
  vat: { standardRate: number; reducedRates: number[]; meta: RuleMeta };
  youngEntrepreneur: { exemptionAmount: Kurus; meta: RuleMeta };
  socialSecurity: { deductible: boolean; meta: RuleMeta };
  /** Doğrudan gider yazılabilecek demirbaş sınırı ve varsayılan faydalı ömür */
  directExpenseThreshold: { amount: Kurus; defaultUsefulLifeYears: number; meta: RuleMeta };
}

const TL = (n: number): Kurus => n * 100;

const SECONDARY_2026: RuleMeta = {
  source: "Gelir Vergisi Genel Tebliği (Seri No: 332), 31.12.2025 tarihli Resmî Gazete — ikincil kaynaklar üzerinden",
  sourceUrl: "https://www.alomaliye.com/2025/12/31/2026-yili-vergi-dilimleri/amp/",
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  lastVerifiedAt: "2026-10-22",
  verification: "secondary",
  note: "Dilim tutarları birden fazla ikincil kaynakla ve birikimli vergi aritmetiğiyle karşılaştırıldı; Resmî Gazete metniyle birebir doğrulanmadı.",
};

const SECONDARY_2025: RuleMeta = {
  ...SECONDARY_2026,
  source: "GVK 103. madde, 2025 yılı tarifesi — ikincil kaynaklar üzerinden",
  sourceUrl: "https://kolayik.com/blog/2025-gelir-vergisi-tarifesi-ve-dilimleri",
  effectiveFrom: "2025-01-01",
  effectiveTo: "2025-12-31",
};

const STATUTE_UNVERIFIED = (from: string, source: string, note?: string): RuleMeta => ({
  source,
  effectiveFrom: from,
  lastVerifiedAt: null,
  verification: "unverified",
  note,
});

export const TR_2026: TaxRuleSet = {
  id: "TR-2026-v1",
  country: "TR",
  year: 2026,
  label: "Türkiye 2026 (ücret dışı gelirler)",
  incomeTax: {
    brackets: [
      { upTo: TL(190_000), rate: 0.15 },
      { upTo: TL(400_000), rate: 0.2 },
      { upTo: TL(1_000_000), rate: 0.27 },
      { upTo: TL(5_300_000), rate: 0.35 },
      { upTo: null, rate: 0.4 },
    ],
    meta: SECONDARY_2026,
  },
  withholding: {
    serbestMeslekRate: 0.2,
    meta: STATUTE_UNVERIFIED("2026-01-01", "GVK 94/2-b (serbest meslek stopajı)", "Oran genel bilgi olarak alınmıştır; istisnai durumlar modellenmedi."),
  },
  provisionalTax: {
    rate: 0.15,
    quarters: [
      { label: "1. dönem (Ocak–Mart)", endMonth: 3, dueMonth: 5, dueDay: 17 },
      { label: "2. dönem (Nisan–Haziran)", endMonth: 6, dueMonth: 8, dueDay: 17 },
      { label: "3. dönem (Temmuz–Eylül)", endMonth: 9, dueMonth: 11, dueDay: 17 },
    ],
    meta: STATUTE_UNVERIFIED("2026-01-01", "GVK mükerrer 120; 7524 sayılı Kanun sonrası 4. dönem kaldırıldı", "Kümülatif kazanç × %15 − önceki dönem ödemeleri olarak basitleştirildi."),
  },
  vat: {
    standardRate: 0.2,
    reducedRates: [0.1, 0.01],
    meta: STATUTE_UNVERIFIED("2023-07-10", "KDV Kanunu ve ilgili Cumhurbaşkanı Kararları"),
  },
  youngEntrepreneur: {
    exemptionAmount: TL(400_000),
    meta: STATUTE_UNVERIFIED(
      "2026-01-01",
      "GVK 20/A — genç girişimci kazanç istisnası",
      "İstisna tutarı tarifenin ikinci dilim üst sınırına eşit varsayıldı; koşullar (yaş, ilk 3 yıl vb.) kullanıcı beyanına dayanır.",
    ),
  },
  socialSecurity: {
    deductible: true,
    meta: STATUTE_UNVERIFIED("2026-01-01", "GVK 68 / 89 — sosyal güvenlik primlerinin indirimi", "Bağ-Kur priminin kazançtan indirilebileceği VARSAYILDI; mükellefin durumuna göre değişebilir."),
  },
  directExpenseThreshold: {
    amount: TL(12_400),
    defaultUsefulLifeYears: 4,
    meta: STATUTE_UNVERIFIED(
      "2026-01-01",
      "VUK 313 — doğrudan gider yazma sınırı",
      "2025 tutarı (9.900 TL) yeniden değerleme oranıyla (%25,49) türetildi; resmî tutar doğrulanmadı.",
    ),
  },
};

export const TR_2025: TaxRuleSet = {
  ...TR_2026,
  id: "TR-2025-v1",
  year: 2025,
  label: "Türkiye 2025 (ücret dışı gelirler)",
  incomeTax: {
    brackets: [
      { upTo: TL(158_000), rate: 0.15 },
      { upTo: TL(330_000), rate: 0.2 },
      { upTo: TL(800_000), rate: 0.27 },
      { upTo: TL(4_300_000), rate: 0.35 },
      { upTo: null, rate: 0.4 },
    ],
    meta: SECONDARY_2025,
  },
  youngEntrepreneur: {
    exemptionAmount: TL(330_000),
    meta: { ...TR_2026.youngEntrepreneur.meta, effectiveFrom: "2025-01-01" },
  },
  directExpenseThreshold: {
    amount: TL(9_900),
    defaultUsefulLifeYears: 4,
    meta: STATUTE_UNVERIFIED("2025-01-01", "VUK 313 — doğrudan gider yazma sınırı"),
  },
};

export const RULE_SETS: Record<number, TaxRuleSet> = {
  2025: TR_2025,
  2026: TR_2026,
};

/** İstenen yıl için kural seti. Yoksa en yakın yılı döner ve `fallback` işaretler. */
export function getRuleSet(year: number): { rules: TaxRuleSet; fallback: boolean } {
  if (RULE_SETS[year]) return { rules: RULE_SETS[year], fallback: false };
  const years = Object.keys(RULE_SETS).map(Number).sort((a, b) => a - b);
  const nearest = years.reduce((best, y) => (Math.abs(y - year) < Math.abs(best - year) ? y : best), years[0]);
  return { rules: RULE_SETS[nearest], fallback: true };
}

export function allRuleMetas(rules: TaxRuleSet): { name: string; meta: RuleMeta }[] {
  return [
    { name: "Gelir vergisi tarifesi", meta: rules.incomeTax.meta },
    { name: "Serbest meslek stopajı", meta: rules.withholding.meta },
    { name: "Geçici vergi", meta: rules.provisionalTax.meta },
    { name: "KDV oranları", meta: rules.vat.meta },
    { name: "Genç girişimci istisnası", meta: rules.youngEntrepreneur.meta },
    { name: "Bağ-Kur primi indirimi", meta: rules.socialSecurity.meta },
    { name: "Doğrudan gider yazma sınırı", meta: rules.directExpenseThreshold.meta },
  ];
}

export function isFullyVerified(rules: TaxRuleSet): boolean {
  return allRuleMetas(rules).every((r) => r.meta.verification === "official");
}
