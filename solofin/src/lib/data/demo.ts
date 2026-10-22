import { addDays, addMonths, monthKey, monthRange } from "../finance/dates";
import type { Deductibility, RecurringItem, Settings, Transaction } from "./schema";

export const DEMO_USER_ID = "demo-user";

/** Deterministik sözde rastgele sayı üreteci (mulberry32) — demo verisi her açılışta aynıdır. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TL = (n: number) => Math.round(n * 100);

export const DEFAULT_SETTINGS: Settings = {
  currency: "TRY",
  country: "TR",
  taxYear: 2026,
  taxpayerType: "serbest_meslek",
  theme: "system",
  locale: "tr",
  cashBalance: 0,
  monthlyPersonalSpend: TL(35_000),
  emergencyMonths: 6,
  safetyBuffer: TL(10_000),
  deductSocialSecurity: true,
  provisionalTaxPaid: 0,
  youngEntrepreneur: false,
  notifications: { upcomingPayments: true, taxReminders: true, weeklySummary: false },
};

export function demoSettings(today: string): Settings {
  return {
    ...DEFAULT_SETTINGS,
    taxYear: Number(today.slice(0, 4)),
    cashBalance: TL(486_250),
    provisionalTaxPaid: TL(38_400),
  };
}

/** type: tr_corporate → %20 KDV + %20 stopaj; tr_individual → %20 KDV, stopaj yok; foreign → hizmet ihracı varsayımı (KDV %0, stopaj yok) */
const CLIENTS: { name: string; type: "tr_corporate" | "tr_individual" | "foreign" }[] = [
  { name: "Nova Medya Ltd. Şti.", type: "tr_corporate" },
  { name: "Kuzey Lojistik A.Ş.", type: "tr_corporate" },
  { name: "Pera Tasarım Stüdyosu", type: "tr_individual" },
  { name: "Northwind Digital Ltd. (UK)", type: "foreign" },
  { name: "Helio Apps GmbH (DE)", type: "foreign" },
  { name: "Mavi Fintek A.Ş.", type: "tr_corporate" },
];

interface Draft {
  kind: Transaction["kind"];
  date: string;
  amount: number;
  category: string;
  counterparty: string;
  description: string;
  vatRate?: number;
  withholdingRate?: number;
  deductibility?: Deductibility;
  status?: Transaction["status"];
  dueDate?: string;
  documentRef?: string;
  recurringId?: string;
}

export function demoRecurring(today: string): RecurringItem[] {
  const start = `${monthKey(addMonths(today, -14))}-01`;
  const base = { userId: DEMO_USER_ID, startDate: start, active: true, recurrence: "monthly" as const };
  return [
    { ...base, id: "rec-retainer", kind: "income", label: "Atlas Yazılım — aylık bakım", category: "Aylık Hizmet (Retainer)", amount: TL(45_000), dayOfMonth: 5 },
    { ...base, id: "rec-rent", kind: "expense", label: "Ortak ofis kirası", category: "Ofis / Kira", amount: TL(12_000), dayOfMonth: 3 },
    { ...base, id: "rec-net", kind: "expense", label: "İnternet", category: "İletişim", amount: TL(550), dayOfMonth: 8 },
    { ...base, id: "rec-soft", kind: "expense", label: "Tasarım yazılımı aboneliği", category: "Yazılım / Abonelik", amount: TL(1_299), dayOfMonth: 1 },
    { ...base, id: "rec-acc", kind: "expense", label: "Mali müşavir", category: "Muhasebe / Hukuk", amount: TL(3_500), dayOfMonth: 20 },
    { ...base, id: "rec-bagkur", kind: "expense", label: "Bağ-Kur primi", category: "Sosyal Güvenlik (Bağ-Kur)", amount: TL(8_800), dayOfMonth: 25 },
  ];
}

/**
 * Bugüne göre geçmiş 14 ay + önümüzdeki birkaç haftalık demo işlemleri üretir.
 * Tutarlar kurgusaldır ve arayüzde "Demo verisi" olarak etiketlenir.
 */
export function generateDemoTransactions(today: string): Transaction[] {
  const rand = rng(20260101);
  const drafts: Draft[] = [];
  const startKey = monthKey(addMonths(today, -14));
  const months = monthRange(startKey, monthKey(today));
  const recurring = demoRecurring(today);

  for (const mk of months) {
    // Tekrarlayan kalemler (bu ay için yalnızca günü geçmiş olanlar kaydedilir)
    for (const r of recurring) {
      const date = `${mk}-${String(r.dayOfMonth).padStart(2, "0")}`;
      if (date > today) continue;
      drafts.push({
        kind: r.kind,
        date,
        amount: r.amount,
        category: r.category,
        counterparty: r.kind === "income" ? "Atlas Yazılım A.Ş." : r.label,
        description: r.label,
        vatRate: r.category === "Sosyal Güvenlik (Bağ-Kur)" ? 0 : 0.2,
        withholdingRate: r.kind === "income" ? 0.2 : 0,
        deductibility: r.kind === "expense" ? (r.category === "Ofis / Kira" || r.category === "Muhasebe / Hukuk" ? "confirmed_deductible" : "assumed_deductible") : "unknown",
        recurringId: r.id,
        documentRef: r.kind === "income" ? `SMM-${mk.replace("-", "")}-01` : undefined,
      });
    }
    // Proje gelirleri: ayda 1–2 proje
    const projectCount = 1 + Math.floor(rand() * 2);
    for (let p = 0; p < projectCount; p++) {
      const day = 8 + Math.floor(rand() * 18);
      const date = `${mk}-${String(day).padStart(2, "0")}`;
      if (date > today) continue;
      const client = CLIENTS[Math.floor(rand() * CLIENTS.length)];
      const amount = TL(Math.round((18_000 + rand() * 62_000) / 500) * 500);
      drafts.push({
        kind: "income",
        date,
        amount,
        category: rand() > 0.35 ? "Proje Geliri" : "Danışmanlık",
        counterparty: client.name,
        description: rand() > 0.5 ? "Web uygulaması geliştirme" : "UI/UX tasarım projesi",
        vatRate: client.type === "foreign" ? 0 : 0.2,
        withholdingRate: client.type === "tr_corporate" ? 0.2 : 0,
        documentRef: `SMM-${mk.replace("-", "")}-${p + 2}`,
      });
    }
    // Değişken giderler
    if (rand() > 0.55) {
      const date = `${mk}-${String(10 + Math.floor(rand() * 15)).padStart(2, "0")}`;
      if (date <= today)
        drafts.push({ kind: "expense", date, amount: TL(1_500 + Math.round(rand() * 4_000)), category: "Ulaşım / Seyahat", counterparty: "THY / Otel", description: "Müşteri ziyareti", vatRate: 0.2, deductibility: "assumed_deductible" });
    }
    if (rand() > 0.7) {
      const date = `${mk}-${String(5 + Math.floor(rand() * 20)).padStart(2, "0")}`;
      if (date <= today)
        drafts.push({ kind: "expense", date, amount: TL(900 + Math.round(rand() * 2_400)), category: "Eğitim", counterparty: "Online eğitim platformu", description: "Kurs / kitap", vatRate: 0.2, deductibility: "unknown" });
    }
  }

  // Bu yılın ekipman alımı (amortismana tabi örnek)
  const equipDate = `${today.slice(0, 4)}-03-14`;
  if (equipDate <= today)
    drafts.push({ kind: "expense", date: equipDate, amount: TL(49_999), category: "Ekipman", counterparty: "Tekno Market", description: "MacBook Pro 14\"", vatRate: 0.2, deductibility: "confirmed_deductible", documentRef: "FM2026001234" });
  drafts.push({ kind: "expense", date: addDays(today, -12), amount: TL(1_299), category: "Ekipman", counterparty: "Tekno Market", description: "USB-C adaptör", vatRate: 0.2, deductibility: "assumed_deductible" });
  drafts.push({ kind: "expense", date: addDays(today, -6), amount: TL(2_150), category: "Kişisel", counterparty: "Market", description: "Kişisel harcama (iş dışı)", vatRate: 0.1, deductibility: "non_deductible" });

  // Bekleyen ve gecikmiş tahsilatlar
  drafts.push({
    kind: "income", date: addDays(today, -20), dueDate: addDays(today, 10), amount: TL(38_000), category: "Proje Geliri",
    counterparty: "Mavi Fintek A.Ş.", description: "Mobil arayüz — 2. hakediş", vatRate: 0.2, withholdingRate: 0.2, status: "pending", documentRef: "SMM-BEKLEYEN-1",
  });
  drafts.push({
    kind: "income", date: addDays(today, -48), dueDate: addDays(today, -18), amount: TL(16_500), category: "Danışmanlık",
    counterparty: "Pera Tasarım Stüdyosu", description: "Marka danışmanlığı", vatRate: 0.2, withholdingRate: 0, status: "overdue",
  });
  // Yaklaşan gider ödemeleri
  drafts.push({
    kind: "expense", date: addDays(today, -2), dueDate: addDays(today, 9), amount: TL(6_800), category: "Pazarlama",
    counterparty: "Reklam ajansı", description: "Portföy sitesi yenileme", vatRate: 0.2, deductibility: "assumed_deductible", status: "pending",
  });

  const stamp = `${today}T09:00:00.000Z`;
  return drafts
    .map((d, i) => ({
      id: `demo-${String(i + 1).padStart(4, "0")}`,
      userId: DEMO_USER_ID,
      source: "demo" as const,
      kind: d.kind,
      date: d.date,
      dueDate: d.dueDate,
      amount: d.amount,
      currency: "TRY" as const,
      vatRate: d.vatRate ?? 0.2,
      category: d.category,
      counterparty: d.counterparty,
      description: d.description,
      status: d.status ?? ("paid" as const),
      documentRef: d.documentRef,
      withholdingRate: d.withholdingRate ?? 0,
      deductibility: d.kind === "income" ? ("unknown" as const) : (d.deductibility ?? "unknown"),
      recurringId: d.recurringId,
      createdAt: stamp,
      updatedAt: stamp,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
