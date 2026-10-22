import type { RecurringItem, Settings, Transaction } from "../data/schema";
import { addDays, addMonths, diffDays, monthKey, monthOf, yearOf } from "./dates";
import { applyRate, type Kurus } from "./money";
import { cashAmount, isBusinessExpense, monthVat, projectYear, type YearProjection } from "./summary";
import type { TaxRuleSet } from "./tax/rules";

export interface CashEvent {
  date: string;
  label: string;
  amount: Kurus; // + giriş, − çıkış
  kind: "income" | "expense" | "tax" | "vat";
  source: "pending" | "recurring" | "estimate";
  /** Vergi rezervinden karşılanır (kullanılabilir tutardan ikinci kez düşülmez) */
  coveredByReserve?: boolean;
}

/** Tekrarlayan bir kalemin [from, to] aralığındaki gerçekleşme tarihleri */
export function occurrences(item: RecurringItem, from: string, to: string): string[] {
  if (!item.active || item.recurrence === "none") return [];
  const step = item.recurrence === "monthly" ? 1 : item.recurrence === "quarterly" ? 3 : 12;
  const out: string[] = [];
  let cur = `${item.startDate.slice(0, 7)}-${String(item.dayOfMonth).padStart(2, "0")}`;
  if (cur < item.startDate) cur = addMonths(cur, step);
  for (let guard = 0; guard < 600 && cur <= to; guard++) {
    if (cur >= from && (!item.endDate || cur <= item.endDate)) out.push(cur);
    cur = addMonths(cur, step);
  }
  return out;
}

/** Tekrarlayan kalemin o ay için zaten kayıtlı bir işlemi var mı? (çift sayımı önler) */
function alreadyRecorded(item: RecurringItem, date: string, txs: readonly Transaction[]) {
  const mk = monthKey(date);
  return txs.some((t) => t.recurringId === item.id && monthKey(t.date) === mk);
}

export interface ForecastOptions {
  /** Bekleyen tahsilatlara eklenecek gecikme (gün) */
  collectionDelayDays?: number;
  /** Gecikmiş alacakların ne zaman tahsil edileceği varsayımı (gün) */
  overdueAssumptionDays?: number;
}

/** Bugünden itibaren [today, until] aralığındaki beklenen nakit hareketleri */
export function upcomingEvents(
  txs: readonly Transaction[],
  recurring: readonly RecurringItem[],
  settings: Settings,
  rules: TaxRuleSet,
  today: string,
  until: string,
  opts: ForecastOptions = {},
): CashEvent[] {
  const delay = opts.collectionDelayDays ?? 0;
  const overdueDays = opts.overdueAssumptionDays ?? 14;
  const events: CashEvent[] = [];

  for (const t of txs) {
    if (t.status === "paid") continue;
    const base = t.dueDate ?? t.date;
    let date = base < today ? (t.kind === "income" ? addDays(today, overdueDays) : today) : base;
    if (t.kind === "income") date = addDays(date, delay);
    if (date > until) continue;
    const label = t.counterparty || t.description || t.category;
    events.push({
      date,
      label,
      amount: t.kind === "income" ? cashAmount(t) : -cashAmount(t),
      kind: t.kind,
      source: "pending",
    });
  }

  for (const r of recurring) {
    for (const d of occurrences(r, addDays(today, 1), until)) {
      if (alreadyRecorded(r, d, txs)) continue;
      const date = r.kind === "income" ? addDays(d, delay) : d;
      if (date > until) continue;
      events.push({ date, label: r.label, amount: r.kind === "income" ? r.amount : -r.amount, kind: r.kind, source: "recurring" });
    }
  }

  // KDV: her ayın 28'inde bir önceki ayın net KDV'si ödenir (aylık beyan varsayımı).
  for (let m = 0; m < 14; m++) {
    const due = `${addMonths(`${monthKey(today)}-01`, m).slice(0, 7)}-28`;
    if (due < today || due > until) continue;
    const prev = monthKey(addMonths(due, -1));
    const vat = monthVat(txs, settings, rules, prev);
    if (vat.payable > 0) {
      events.push({ date: due, label: `KDV beyannamesi (${prev})`, amount: -vat.payable, kind: "vat", source: "estimate", coveredByReserve: true });
    }
  }

  // Geçici vergi: dönem sonu itibarıyla kümülatif kazanç üzerinden tahmin.
  const year = yearOf(today);
  if (year === settings.taxYear) {
    let paidSoFar = settings.provisionalTaxPaid;
    for (const q of rules.provisionalTax.quarters) {
      const due = `${year}-${String(q.dueMonth).padStart(2, "0")}-${String(q.dueDay).padStart(2, "0")}`;
      if (due < today || due > until) continue;
      const proj = projectYear(txs, settings, rules, `${year}-${String(q.endMonth).padStart(2, "0")}-28`);
      const cumulativeProfit = proj.ytdTax.taxableBase;
      const est = Math.max(0, applyRate(cumulativeProfit, rules.provisionalTax.rate) - paidSoFar - proj.ytd.withholdingCredits);
      paidSoFar += est;
      if (est > 0) {
        events.push({ date: due, label: `Geçici vergi — ${q.label}`, amount: -est, kind: "tax", source: "estimate", coveredByReserve: true });
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export interface TaxReserve {
  incomeTax: Kurus;
  vat: Kurus;
  total: Kurus;
  explanation: string[];
}

/**
 * Vergi rezervi = yıllık tahmini gelir vergisinin bugüne kadarki kazanca düşen payı − mahsuplar
 *                + henüz ödenmemiş KDV (içinde bulunulan ay + 28'i geçmemişse önceki ay).
 */
export function taxReserve(projection: YearProjection, txs: readonly Transaction[], settings: Settings, rules: TaxRuleSet, today: string): TaxReserve {
  const projProfit = Math.max(0, projection.projectedTax.taxableBase);
  const ytdProfit = Math.max(0, projection.ytdTax.taxableBase);
  const share = projProfit > 0 ? Math.min(1, ytdProfit / projProfit) : 0;
  const accrued = Math.round(projection.projectedTax.incomeTax * share);
  const incomeTax = Math.max(0, accrued - projection.ytd.withholdingCredits - settings.provisionalTaxPaid);

  const months = [monthKey(today)];
  if (Number(today.slice(8, 10)) <= 28) months.push(monthKey(addMonths(today, -1)));
  const vat = months.reduce((s, m) => s + monthVat(txs, settings, rules, m).payable, 0);

  return {
    incomeTax,
    vat,
    total: incomeTax + vat,
    explanation: [
      "Gelir vergisi payı: yıl sonu tahmini verginin, bugüne kadarki kazancın yıllık kazanca oranı kadarı.",
      "Kaynakta kesilen stopajlar ve ödenen geçici vergiler bu paydan düşüldü.",
      "KDV: içinde bulunulan ayın ve henüz beyan edilmemiş önceki ayın net KDV'si.",
    ],
  };
}

export interface SafeToSpend {
  cashBalance: Kurus;
  taxReserve: TaxReserve;
  upcomingObligations: Kurus;
  safetyBuffer: Kurus;
  expectedInflows: Kurus;
  safeAmount: Kurus;
  /** Negatifse açık var demektir */
  rawAmount: Kurus;
  obligations: CashEvent[];
}

/** "Bugün güvenle kullanabileceğin tahmini tutar". Beklenen tahsilatlar ihtiyatlılık gereği DAHİL EDİLMEZ. */
export function safeToSpend(
  txs: readonly Transaction[],
  recurring: readonly RecurringItem[],
  settings: Settings,
  rules: TaxRuleSet,
  today: string,
  projection: YearProjection = projectYear(txs, settings, rules, today),
): SafeToSpend {
  const reserve = taxReserve(projection, txs, settings, rules, today);
  const events = upcomingEvents(txs, recurring, settings, rules, today, addDays(today, 30));
  const obligations = events.filter((e) => e.amount < 0 && !e.coveredByReserve);
  const upcomingObligations = -obligations.reduce((s, e) => s + e.amount, 0);
  const expectedInflows = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const raw = settings.cashBalance - reserve.total - upcomingObligations - settings.safetyBuffer;
  return {
    cashBalance: settings.cashBalance,
    taxReserve: reserve,
    upcomingObligations,
    safetyBuffer: settings.safetyBuffer,
    expectedInflows,
    safeAmount: Math.max(0, raw),
    rawAmount: raw,
    obligations,
  };
}

export interface DailyPoint {
  date: string;
  balance: Kurus;
}

/** Günlük bakiye projeksiyonu */
export function dailyBalance(startBalance: Kurus, events: readonly CashEvent[], from: string, days: number): DailyPoint[] {
  const out: DailyPoint[] = [];
  let bal = startBalance;
  const byDate = new Map<string, Kurus>();
  for (const e of events) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount);
  for (let i = 0; i <= days; i++) {
    const d = addDays(from, i);
    bal += byDate.get(d) ?? 0;
    out.push({ date: d, balance: bal });
  }
  return out;
}

export interface Resilience {
  available: Kurus;
  monthlyOutflow: Kurus;
  monthlyInflow: Kurus;
  rows: { drop: number; monthlyGap: Kurus; months: number | null }[];
  emergencyTarget: Kurus;
  emergencyCoverage: number;
  assumptions: string[];
}

/**
 * Finansal dayanıklılık: (nakit − vergi rezervi) / aylık açık.
 * Aylık çıkış = ortalama iş gideri + kişisel harcama. Aylık giriş = ortalama net tahsilat × (1 − düşüş).
 * months = null → aylık açık yok (süresiz dayanır).
 */
export function resilience(
  projection: YearProjection,
  settings: Settings,
  reserve: TaxReserve,
  drops: readonly number[] = [0, 0.3, 0.5, 1],
): Resilience {
  const available = Math.max(0, settings.cashBalance - reserve.total);
  const monthlyOutflow = projection.avgMonthlyExpense + settings.monthlyPersonalSpend;
  const annualTaxRate = projection.projectedBasis.grossIncome > 0 ? projection.projectedTax.incomeTax / projection.projectedBasis.grossIncome : 0;
  const monthlyInflow = Math.round(projection.avgMonthlyIncome * (1 - annualTaxRate));
  const rows = drops.map((drop) => {
    const inflow = Math.round(monthlyInflow * (1 - drop));
    const gap = monthlyOutflow - inflow;
    return { drop, monthlyGap: gap, months: gap <= 0 ? null : Math.floor((available / gap) * 10) / 10 };
  });
  const emergencyTarget = settings.emergencyMonths * monthlyOutflow;
  return {
    available,
    monthlyOutflow,
    monthlyInflow,
    rows,
    emergencyTarget,
    emergencyCoverage: emergencyTarget > 0 ? available / emergencyTarget : 1,
    assumptions: [
      "Kullanılabilir nakit = banka bakiyesi − vergi rezervi.",
      "Aylık gelir, son 6 tamamlanmış ayın ortalamasından ortalama efektif vergi oranı düşülerek hesaplandı.",
      "Aylık çıkış = ortalama iş gideri + ayarlardaki kişisel harcama.",
      "Gelir düşüşü senaryolarında giderlerin sabit kaldığı varsayıldı.",
    ],
  };
}

/** Yıl sonuna kadar aylık nakit projeksiyonu (ortalama + bekleyen kalemler) */
export function monthlyCashProjection(
  projection: YearProjection,
  events: readonly CashEvent[],
  settings: Settings,
  today: string,
): { month: string; inflow: Kurus; outflow: Kurus; balance: Kurus }[] {
  const out: { month: string; inflow: Kurus; outflow: Kurus; balance: Kurus }[] = [];
  let balance = settings.cashBalance;
  const curMonth = monthOf(today);
  for (const p of projection.months) {
    const m = Number(p.month.slice(5, 7));
    if (m < curMonth) continue;
    const evs = events.filter((e) => monthKey(e.date) === p.month);
    const evIn = evs.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const evOut = -evs.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    // Bu ay için kalan gün oranı kadar değişken gelir/gider ortalaması eklenir (kayıtlı kalemlere ek olarak değil, bunların yerine maksimum alınır)
    const fraction = m === curMonth ? Math.max(0, 1 - Number(today.slice(8, 10)) / 30) : 1;
    const inflow = Math.max(evIn, Math.round(projection.avgMonthlyIncome * fraction));
    const outflow = Math.max(evOut, Math.round((projection.avgMonthlyExpense + settings.monthlyPersonalSpend) * fraction));
    balance += inflow - outflow;
    out.push({ month: p.month, inflow, outflow, balance });
  }
  return out;
}

export function daysUntil(date: string, today: string) {
  return diffDays(date, today);
}

export { isBusinessExpense };
