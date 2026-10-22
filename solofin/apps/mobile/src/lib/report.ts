import type { Scenario } from "@solofin/core/data/schema";
import { formatDate, monthLabel } from "@solofin/core/finance/dates";
import { formatMoney, fromKurus } from "@solofin/core/finance/money";
import type { ScenarioComparison } from "@solofin/core/finance/scenarios";
import type { YearProjection } from "@solofin/core/finance/summary";

export interface ReportData {
  month: string;
  from: string;
  to: string;
  today: string;
  sourceLabel: string;
  ruleSetId: string;
  totals: { income: number; expense: number; personal: number; net: number; count: number };
  incomeCats: { category: string; amount: number }[];
  expenseCats: { category: string; amount: number }[];
  projection: YearProjection;
  taxReserve: number;
  scenarios: { s: Scenario; c: ScenarioComparison }[];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const m = (k: number) => esc(formatMoney(k));

function rows(items: [string, string, boolean?][]) {
  return items.map(([l, v, strong]) => `<tr${strong ? ' class="strong"' : ""}><th>${esc(l)}</th><td>${v}</td></tr>`).join("");
}

/** Yazdırılabilir / PDF rapor HTML'i. Tüm kullanıcı metinleri kaçışlanır. */
export function reportHtml(d: ReportData): string {
  const tax = d.projection.projectedTax;
  const cats = (list: { category: string; amount: number }[]) =>
    list.length ? list.map((c) => `<tr><th>${esc(c.category)}</th><td>${m(c.amount)}</td></tr>`).join("") : `<tr><td colspan="2" class="muted">Kayıt yok</td></tr>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SOLOFIN raporu ${esc(d.month)}</title>
<style>
  body{font-family:-apple-system,Roboto,"Segoe UI",sans-serif;color:#0d1220;margin:32px;font-size:12px}
  h1{font-size:20px;margin:0}h2{font-size:14px;margin:24px 0 6px}
  .eyebrow{letter-spacing:.14em;font-size:10px;color:#5b6475;font-weight:600}
  .badge{display:inline-block;padding:3px 8px;border-radius:6px;background:#fdf3e4;color:#b45309;font-weight:600;font-size:10px}
  table{width:100%;border-collapse:collapse}th,td{padding:6px 0;border-bottom:1px solid #e4e7ec;text-align:left;font-weight:400}
  td{text-align:right;font-variant-numeric:tabular-nums}.strong th,.strong td{font-weight:700}.muted{color:#8a93a5}
  .grid{display:flex;gap:24px}.grid>div{flex:1}.warn{color:#b45309}
</style></head><body>
<div class="eyebrow">SOLOFIN · FİNANS RAPORU</div>
<h1>${esc(monthLabel(d.month, true))} ${esc(d.month.slice(0, 4))}</h1>
<p class="muted">Dönem: ${esc(formatDate(d.from))} – ${esc(formatDate(d.to))} · Oluşturulma: ${esc(formatDate(d.today))}</p>
<span class="badge">Kaynak: ${esc(d.sourceLabel)}</span>
<h2>1. Aylık finans özeti</h2>
<table>${rows([
    ["Gelir (KDV hariç)", m(d.totals.income)],
    ["İş gideri (KDV hariç)", m(d.totals.expense)],
    ["Kişisel harcama", m(d.totals.personal)],
    ["Net (gelir − iş gideri)", m(d.totals.net), true],
    ["İşlem sayısı", String(d.totals.count)],
  ])}</table>
<h2>2. Gelir ve gider dökümü</h2>
<div class="grid"><div><table><tr><th class="muted">Gelir kategorisi</th><td></td></tr>${cats(d.incomeCats)}</table></div>
<div><table><tr><th class="muted">Gider kategorisi</th><td></td></tr>${cats(d.expenseCats)}</table></div></div>
<h2>3. Vergi hesaplama özeti — yıl sonu tahmini</h2>
<p class="warn">Demo tahmini: kurallar (${esc(d.ruleSetId)}) resmî mevzuatla birebir doğrulanmamıştır.</p>
<table>${rows([
    ["Brüt gelir", m(d.projection.projectedBasis.grossIncome)],
    ["İndirilebilir giderler + amortisman", m(tax.deductibleExpenses)],
    ["Bağ-Kur indirimi", m(tax.socialSecurityDeduction)],
    ["Tahmini vergi matrahı", m(tax.taxableBase), true],
    ["Tahmini gelir vergisi", m(tax.incomeTax), true],
    ["Stopaj + geçici vergi mahsubu", m(tax.withholdingCredits + tax.provisionalPaid)],
    ["Tahmini kalan ödeme", m(tax.remainingPayable)],
    ["Güncel vergi rezervi", m(d.taxReserve)],
  ])}</table>
<h2>4. Senaryo karşılaştırması</h2>
${
  d.scenarios.length
    ? `<table><tr><th class="muted">Senaryo</th><td class="muted">Net kazanç farkı</td><td class="muted">Vergi farkı</td></tr>${d.scenarios
        .map(({ s, c }) => `<tr><th>${esc(s.name)}</th><td>${esc(formatMoney(c.diff.netEarnings, "TRY", { signed: true }))}</td><td>${esc(formatMoney(c.diff.tax, "TRY", { signed: true }))}</td></tr>`)
        .join("")}</table>`
    : `<p class="muted">Kayıtlı senaryo yok.</p>`
}
<h2>5. Yıl sonu tahmini</h2>
<table><tr><th class="muted">Ay</th><td class="muted">Gelir</td><td class="muted">Gider</td><td class="muted">Net</td></tr>
${d.projection.months
  .map((x) => `<tr${x.projected ? ' class="muted"' : ""}><th>${esc(monthLabel(x.month, true))}${x.projected ? " (tahmin)" : ""}</th><td>${m(x.income)}</td><td>${m(x.expense)}</td><td>${m(x.net)}</td></tr>`)
  .join("")}
<tr class="strong"><th>Tahmini net kazanç (vergi ve prim sonrası)</th><td colspan="3">${m(d.projection.projectedNetEarnings)}</td></tr></table>
<p class="muted">${d.projection.assumptions.map(esc).join("<br>")}<br>Bu rapor genel bilgilendirme amaçlıdır; vergi veya yatırım tavsiyesi değildir.</p>
</body></html>`;
}

export function reportCsvRows(d: ReportData): (string | number)[][] {
  return [
    ["SOLOFIN raporu", `${monthLabel(d.month, true)} ${d.month.slice(0, 4)}`],
    ["Veri kaynağı", d.sourceLabel],
    [],
    ["Kalem", "Tutar (TL)"],
    ["Gelir", fromKurus(d.totals.income)],
    ["İş gideri", fromKurus(d.totals.expense)],
    ["Kişisel harcama", fromKurus(d.totals.personal)],
    ["Net", fromKurus(d.totals.net)],
    [],
    ["Gelir kategorisi", "Tutar (TL)"],
    ...d.incomeCats.map((c) => [c.category, fromKurus(c.amount)]),
    [],
    ["Gider kategorisi", "Tutar (TL)"],
    ...d.expenseCats.map((c) => [c.category, fromKurus(c.amount)]),
    [],
    ["Yıl sonu tahmini (demo)", ""],
    ["Brüt gelir", fromKurus(d.projection.projectedBasis.grossIncome)],
    ["Vergi matrahı", fromKurus(d.projection.projectedTax.taxableBase)],
    ["Tahmini gelir vergisi", fromKurus(d.projection.projectedTax.incomeTax)],
    ["Tahmini net kazanç", fromKurus(d.projection.projectedNetEarnings)],
    [],
    ["Senaryo", "Net kazanç farkı (TL)", "Vergi farkı (TL)"],
    ...d.scenarios.map(({ s, c }) => [s.name, fromKurus(c.diff.netEarnings), fromKurus(c.diff.tax)]),
  ];
}
