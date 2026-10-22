import type { Settings, Transaction } from "../data/schema";
import { diffDays } from "./dates";
import { formatMoney, type Kurus } from "./money";
import type { CashEvent, Resilience, SafeToSpend } from "./cashflow";
import type { YearProjection } from "./summary";
import { marginalRate } from "./tax/engine";
import type { TaxRuleSet } from "./tax/rules";

export interface Alert {
  id: string;
  severity: 3 | 2 | 1; // 3 = kritik, 2 = uyarı, 1 = bilgi
  title: string;
  detail: string;
  href?: string;
}

/** En önemli finansal uyarılar (önem sırasına göre). Yalnızca motor çıktılarından türetilir. */
export function buildAlerts(args: {
  txs: readonly Transaction[];
  settings: Settings;
  rules: TaxRuleSet;
  today: string;
  safe: SafeToSpend;
  projection: YearProjection;
  resilience: Resilience;
  events: readonly CashEvent[];
}): Alert[] {
  const { txs, settings, rules, today, safe, projection, resilience, events } = args;
  const out: Alert[] = [];

  if (safe.rawAmount < 0) {
    out.push({
      id: "shortfall",
      severity: 3,
      title: "Yükümlülükler nakdi aşıyor",
      detail: `Vergi rezervi ve 30 günlük ödemelerden sonra ${formatMoney(-safe.rawAmount)} açık görünüyor.`,
      href: "/nakit-akisi",
    });
  }

  const overdue = txs.filter((t) => t.kind === "income" && t.status === "overdue");
  if (overdue.length) {
    const total = overdue.reduce((s, t) => s + t.amount, 0);
    const oldest = overdue.reduce((a, b) => ((a.dueDate ?? a.date) < (b.dueDate ?? b.date) ? a : b));
    out.push({
      id: "overdue",
      severity: 2,
      title: `${overdue.length} gecikmiş tahsilat`,
      detail: `${formatMoney(total)} (KDV hariç) tahsil edilmedi. En eskisi ${Math.max(0, diffDays(today, oldest.dueDate ?? oldest.date))} gün gecikmede: ${oldest.counterparty || oldest.description}.`,
      href: "/islemler?durum=overdue",
    });
  }

  const taxDue = events.find((e) => (e.kind === "tax" || e.kind === "vat") && diffDays(e.date, today) <= 14);
  if (taxDue) {
    out.push({
      id: "taxdue",
      severity: 2,
      title: `${diffDays(taxDue.date, today)} gün içinde vergi ödemesi`,
      detail: `${taxDue.label}: tahmini ${formatMoney(-taxDue.amount)}. Tutar vergi rezervinden ayrılmıştır.`,
      href: "/vergi",
    });
  }

  if (resilience.emergencyTarget > 0 && resilience.emergencyCoverage < 1) {
    out.push({
      id: "emergency",
      severity: resilience.emergencyCoverage < 0.5 ? 2 : 1,
      title: "Acil durum fonu hedefin altında",
      detail: `${settings.emergencyMonths} aylık hedefin %${Math.round(resilience.emergencyCoverage * 100)}'i karşılanıyor.`,
      href: "/nakit-akisi",
    });
  }

  const unknown = txs.filter((t) => t.kind === "expense" && t.deductibility === "unknown" && t.date.startsWith(String(settings.taxYear)));
  if (unknown.length) {
    out.push({
      id: "unknown-deductibility",
      severity: 1,
      title: `${unknown.length} giderin vergisel durumu belirsiz`,
      detail: "Bu giderler vergi hesabında indirilebilir sayılmadı. Mali müşavirinle doğrulayıp işaretleyebilirsin.",
      href: "/islemler?vergisel=unknown",
    });
  }

  const base: Kurus = projection.projectedTax.taxableBase;
  const ytdRate = marginalRate(projection.ytdTax.taxableBase, rules.incomeTax.brackets);
  const projRate = marginalRate(base, rules.incomeTax.brackets);
  if (projRate > ytdRate) {
    out.push({
      id: "bracket",
      severity: 1,
      title: `Yıl sonunda %${Math.round(projRate * 100)} dilimine geçmen bekleniyor`,
      detail: "Mevcut tempoyla ek kazancın daha yüksek oranla vergilenecek. Vergi rezervi buna göre hesaplandı.",
      href: "/vergi",
    });
  }

  return out.sort((a, b) => b.severity - a.severity);
}
