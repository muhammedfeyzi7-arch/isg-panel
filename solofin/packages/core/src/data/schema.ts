import { z } from "zod";
import { CURRENCIES } from "../finance/money";

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Geçersiz tarih");

export const INCOME_CATEGORIES = [
  "Proje Geliri",
  "Danışmanlık",
  "Aylık Hizmet (Retainer)",
  "Lisans / Telif",
  "İçerik / Sponsorluk",
  "Diğer Gelir",
] as const;

export const EXPENSE_CATEGORIES = [
  "Ekipman",
  "Yazılım / Abonelik",
  "Ofis / Kira",
  "İletişim",
  "Ulaşım / Seyahat",
  "Muhasebe / Hukuk",
  "Eğitim",
  "Pazarlama",
  "Sosyal Güvenlik (Bağ-Kur)",
  "Kişisel",
  "Diğer Gider",
] as const;

export const TX_STATUS = ["paid", "pending", "overdue"] as const;
export const TX_STATUS_LABEL: Record<(typeof TX_STATUS)[number], string> = {
  paid: "Ödendi",
  pending: "Bekliyor",
  overdue: "Gecikmiş",
};

/**
 * Vergisel sınıflandırma kullanıcının kategori etiketinden AYRI tutulur.
 * - unknown: değerlendirilmedi (hesaplamada indirilebilir sayılmaz)
 * - assumed_deductible: kategori varsayılanına göre indirilebilir VARSAYILDI (doğrulanmadı)
 * - confirmed_deductible: kullanıcı/mali müşavir onayladı
 * - non_deductible: indirilemez (ör. kişisel harcama)
 */
export const DEDUCTIBILITY = ["unknown", "assumed_deductible", "confirmed_deductible", "non_deductible"] as const;
export type Deductibility = (typeof DEDUCTIBILITY)[number];
export const DEDUCTIBILITY_LABEL: Record<Deductibility, string> = {
  unknown: "Değerlendirilmedi",
  assumed_deductible: "İndirilebilir (varsayım)",
  confirmed_deductible: "İndirilebilir (onaylı)",
  non_deductible: "İndirilemez",
};

export const RECURRENCE = ["none", "monthly", "quarterly", "yearly"] as const;

export const transactionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  source: z.enum(["demo", "user", "import"]),
  kind: z.enum(["income", "expense"]),
  date: isoDate,
  /** Vade / beklenen ödeme tarihi (bekleyen işlemler için) */
  dueDate: isoDate.optional(),
  /** Kuruş, KDV hariç tutar. Her zaman pozitif. */
  amount: z.number().int().positive("Tutar sıfırdan büyük olmalı"),
  currency: z.enum(CURRENCIES),
  /** KDV oranı (0, 0.01, 0.10, 0.20) */
  vatRate: z.number().min(0).max(1),
  category: z.string().min(1, "Kategori gerekli").max(60),
  counterparty: z.string().max(120).default(""),
  description: z.string().max(200).default(""),
  status: z.enum(TX_STATUS),
  documentRef: z.string().max(120).optional(),
  /** Gelir: kaynakta kesilen stopaj oranı (ör. serbest meslek makbuzu %20) */
  withholdingRate: z.number().min(0).max(1).default(0),
  deductibility: z.enum(DEDUCTIBILITY).default("unknown"),
  recurringId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;

/** Form girdisi (kimlik ve zaman damgaları sistem tarafından atanır) */
export const transactionInputSchema = transactionSchema.omit({
  id: true,
  userId: true,
  source: true,
  createdAt: true,
  updatedAt: true,
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const recurringItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.enum(["income", "expense"]),
  label: z.string().min(1).max(80),
  category: z.string(),
  amount: z.number().int().positive(),
  recurrence: z.enum(RECURRENCE),
  /** Ayın kaçıncı günü (1–28) */
  dayOfMonth: z.number().int().min(1).max(28),
  startDate: isoDate,
  endDate: isoDate.optional(),
  active: z.boolean(),
});
export type RecurringItem = z.infer<typeof recurringItemSchema>;

export const TAXPAYER_TYPES = ["serbest_meslek", "ticari_bilanco", "ticari_isletme"] as const;
export type TaxpayerType = (typeof TAXPAYER_TYPES)[number];
export const TAXPAYER_LABEL: Record<TaxpayerType, string> = {
  serbest_meslek: "Serbest meslek kazancı (gerçek usul)",
  ticari_isletme: "Ticari kazanç — işletme hesabı",
  ticari_bilanco: "Ticari kazanç — bilanço esası",
};

export const settingsSchema = z.object({
  currency: z.enum(CURRENCIES),
  country: z.literal("TR"),
  taxYear: z.number().int().min(2025).max(2030),
  taxpayerType: z.enum(TAXPAYER_TYPES),
  theme: z.enum(["system", "light", "dark"]),
  locale: z.enum(["tr"]),
  /** Kullanıcının beyan ettiği güncel banka bakiyesi (kuruş) */
  cashBalance: z.number().int(),
  /** Aylık kişisel yaşam gideri (kuruş) — dayanıklılık hesapları için */
  monthlyPersonalSpend: z.number().int().nonnegative(),
  /** Acil durum fonu hedefi (ay) */
  emergencyMonths: z.number().int().min(0).max(24),
  /** Güvenlik payı: kullanılabilir tutardan düşülecek tampon (kuruş) */
  safetyBuffer: z.number().int().nonnegative(),
  /** "Sosyal Güvenlik (Bağ-Kur)" kategorisindeki giderler matrahtan indirilsin mi (varsayım) */
  deductSocialSecurity: z.boolean(),
  /** Bu yıl şimdiye kadar ödenen geçici vergi (kuruş) */
  provisionalTaxPaid: z.number().int().nonnegative(),
  /** Genç girişimci istisnası uygulanıyor mu (kullanıcı beyanı) */
  youngEntrepreneur: z.boolean(),
  notifications: z.object({
    upcomingPayments: z.boolean(),
    taxReminders: z.boolean(),
    weeklySummary: z.boolean(),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

export const scenarioLeversSchema = z.object({
  /** Tek seferlik ekipman/yatırım alımı (kuruş, KDV hariç) */
  oneOffPurchase: z.number().int().nonnegative(),
  oneOffPurchaseDeductible: z.boolean(),
  /** Fiyat değişimi (oran, 0.10 = %10 zam) */
  priceChange: z.number().min(-1).max(5),
  /** Gelir kaybı (oran, 0.30 = %30 düşüş). priceChange ile çarpımsal uygulanır. */
  incomeDrop: z.number().min(0).max(1),
  /** Yeni müşteriden aylık gelir (kuruş) */
  newClientMonthly: z.number().int().nonnegative(),
  /** Tahsilat gecikmesi (gün) */
  collectionDelayDays: z.number().int().min(0).max(180),
  /** Aylık gider artışı (kuruş) */
  monthlyExpenseIncrease: z.number().int().nonnegative(),
  /** Emeklilik için ek aylık birikim (kuruş) */
  extraMonthlySavings: z.number().int().nonnegative(),
});
export const scenarioSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(80),
  createdAt: z.string(),
  levers: scenarioLeversSchema,
});

export type ScenarioLevers = z.infer<typeof scenarioLeversSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;

export const retirementInputSchema = z.object({
  currentAge: z.number().int().min(18).max(80),
  targetAge: z.number().int().min(30).max(85),
  currentSavings: z.number().int().nonnegative(),
  monthlyContribution: z.number().int().nonnegative(),
  inflation: z.number().min(0).max(1),
  /** Hedeflenen aylık emeklilik bütçesi, BUGÜNÜN parasıyla (kuruş) */
  targetMonthlyBudget: z.number().int().nonnegative(),
  /** Emeklilikte sürdürülebilir çekim oranı (yıllık) */
  withdrawalRate: z.number().min(0.01).max(0.1),
});
export type RetirementInput = z.infer<typeof retirementInputSchema>;
