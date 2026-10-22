"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, Button, Card, Select } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import { useFinance } from "@/lib/data/useFinance";
import { downloadText } from "@/lib/download";
import { exportTransactionsCsv, toCsv } from "@solofin/core/finance/csv";
import { endOfMonth, formatDate, monthLabel } from "@solofin/core/finance/dates";
import { formatMoney, fromKurus } from "@solofin/core/finance/money";
import { baselineFromProjection, compareScenario } from "@solofin/core/finance/scenarios";
import { RETURN_PROFILES } from "@solofin/core/finance/retirement";
import { categoryBreakdown, lastNMonths, totals } from "@solofin/core/finance/summary";

export default function ReportsPage() {
  const { transactions, settings, today, mode, scenarios, retirement } = useStore();
  const { rules, projection, safe } = useFinance();
  const months = useMemo(() => lastNMonths(today, 12).reverse(), [today]);
  const [month, setMonth] = useState(months[0]);

  const from = `${month}-01`;
  const to = endOfMonth(from) > today ? today : endOfMonth(from);
  const t = totals(transactions, from, to);
  const incomeCats = categoryBreakdown(transactions, "income", from, to);
  const expenseCats = categoryBreakdown(transactions, "expense", from, to);
  const monthTx = transactions.filter((x) => x.date >= from && x.date <= to);

  const baseline = useMemo(
    () =>
      baselineFromProjection(projection, {
        cashAfterReserve: Math.max(0, settings.cashBalance - safe.taxReserve.total),
        monthlyPersonalSpend: settings.monthlyPersonalSpend,
        deductSocialSecurity: settings.deductSocialSecurity,
        youngEntrepreneur: settings.youngEntrepreneur,
        yearsToRetirement: retirement.targetAge - retirement.currentAge,
        realReturn: RETURN_PROFILES[1].realReturn,
      }),
    [projection, settings, safe.taxReserve.total, retirement],
  );
  const scenarioRows = scenarios.map((s) => ({ s, c: compareScenario(baseline, s.levers, rules) }));

  const sourceLabel = mode === "demo" ? "Demo verisi (kurgusal)" : "Kullanıcı verisi (bu tarayıcıda saklanan)";
  const tax = projection.projectedTax;

  function exportSummaryCsv() {
    const rows: (string | number)[][] = [
      ["SOLOFIN raporu", `${monthLabel(month, true)} ${month.slice(0, 4)}`],
      ["Veri kaynağı", sourceLabel],
      ["Oluşturulma", new Date().toISOString()],
      [],
      ["Kalem", "Tutar (TL)"],
      ["Gelir", fromKurus(t.income)],
      ["İş gideri", fromKurus(t.expense)],
      ["Kişisel harcama", fromKurus(t.personal)],
      ["Net (gelir − iş gideri)", fromKurus(t.net)],
      [],
      ["Gelir kategorisi", "Tutar (TL)"],
      ...incomeCats.map((c) => [c.category, fromKurus(c.amount)]),
      [],
      ["Gider kategorisi", "Tutar (TL)"],
      ...expenseCats.map((c) => [c.category, fromKurus(c.amount)]),
      [],
      ["Yıl sonu tahmini (demo tahmini)", ""],
      ["Brüt gelir", fromKurus(projection.projectedBasis.grossIncome)],
      ["Vergi matrahı", fromKurus(tax.taxableBase)],
      ["Tahmini gelir vergisi", fromKurus(tax.incomeTax)],
      ["Tahmini net kazanç", fromKurus(projection.projectedNetEarnings)],
      [],
      ["Senaryo", "Net kazanç farkı (TL)", "Vergi farkı (TL)", "Nakit farkı (TL)"],
      ...scenarioRows.map(({ s, c }) => [s.name, fromKurus(c.diff.netEarnings), fromKurus(c.diff.tax), fromKurus(c.diff.endCash)]),
    ];
    downloadText(`solofin-rapor-${month}.csv`, toCsv(rows));
  }

  return (
    <>
      <PageHeader
        title="Raporlar"
        description="Aylık özet, döküm, vergi özeti, senaryolar ve yıl sonu tahmini."
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Select aria-label="Rapor ayı" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m, true)} {m.slice(0, 4)}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={exportSummaryCsv}>
              <Download className="h-4 w-4" aria-hidden /> Özet CSV
            </Button>
            <Button variant="secondary" onClick={() => downloadText(`solofin-islemler-${month}.csv`, exportTransactionsCsv(monthTx))}>
              <Download className="h-4 w-4" aria-hidden /> İşlemler CSV
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Yazdır / PDF
            </Button>
          </div>
        }
      />

      <article className="space-y-4" aria-label="Rapor">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-muted">SOLOFIN · FİNANS RAPORU</p>
              <h2 className="mt-1 text-xl font-semibold">
                {monthLabel(month, true)} {month.slice(0, 4)}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Dönem: {formatDate(from)} – {formatDate(to)} · Oluşturulma: {formatDate(today)}
              </p>
            </div>
            <Badge tone={mode === "demo" ? "warning" : "primary"}>Kaynak: {sourceLabel}</Badge>
          </div>

          <h3 className="mt-6 text-sm font-semibold">1. Aylık finans özeti</h3>
          <table className="mt-2 w-full text-sm">
            <tbody className="tnum divide-y divide-border">
              <ReportRow label="Gelir (KDV hariç)" value={formatMoney(t.income)} />
              <ReportRow label="İş gideri (KDV hariç)" value={formatMoney(t.expense)} />
              <ReportRow label="Kişisel harcama (kayıtlı)" value={formatMoney(t.personal)} />
              <ReportRow label="Net (gelir − iş gideri)" value={formatMoney(t.net)} strong />
              <ReportRow label="İşlem sayısı" value={String(monthTx.length)} />
            </tbody>
          </table>

          <h3 className="mt-6 text-sm font-semibold">2. Gelir ve gider dökümü</h3>
          <div className="mt-2 grid items-start gap-6 md:grid-cols-2">
            <BreakdownTable title="Gelir kategorileri" rows={incomeCats} total={t.income} />
            <BreakdownTable title="Gider kategorileri" rows={expenseCats} total={t.expense + t.personal} />
          </div>
        </Card>

        <Card className="print-break p-6">
          <h3 className="text-sm font-semibold">3. Vergi hesaplama özeti — {settings.taxYear} yıl sonu tahmini</h3>
          <p className="mt-1 text-xs text-warning">Demo tahmini: kurallar ({rules.id}) resmî mevzuatla birebir doğrulanmamıştır.</p>
          <table className="mt-2 w-full text-sm">
            <tbody className="tnum divide-y divide-border">
              <ReportRow label="Brüt gelir" value={formatMoney(projection.projectedBasis.grossIncome)} />
              <ReportRow label="İndirilebilir giderler + amortisman" value={formatMoney(tax.deductibleExpenses)} />
              <ReportRow label="Bağ-Kur indirimi" value={formatMoney(tax.socialSecurityDeduction)} />
              <ReportRow label="Tahmini vergi matrahı" value={formatMoney(tax.taxableBase)} strong />
              <ReportRow label="Tahmini gelir vergisi" value={formatMoney(tax.incomeTax)} strong />
              <ReportRow label="Stopaj + geçici vergi mahsubu" value={formatMoney(tax.withholdingCredits + tax.provisionalPaid)} />
              <ReportRow label="Tahmini kalan ödeme" value={formatMoney(tax.remainingPayable)} />
              <ReportRow label="Güncel vergi rezervi (gelir vergisi + KDV)" value={formatMoney(safe.taxReserve.total)} />
            </tbody>
          </table>

          <h3 className="mt-6 text-sm font-semibold">4. Senaryo karşılaştırması</h3>
          {scenarioRows.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Kayıtlı senaryo yok. Senaryolar sayfasından kaydedebilirsin.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="py-2 font-medium">Senaryo</th>
                    <th scope="col" className="py-2 text-right font-medium">Net kazanç farkı</th>
                    <th scope="col" className="py-2 text-right font-medium">Vergi farkı</th>
                    <th scope="col" className="py-2 text-right font-medium">12. ay nakit farkı</th>
                  </tr>
                </thead>
                <tbody className="tnum divide-y divide-border">
                  {scenarioRows.map(({ s, c }) => (
                    <tr key={s.id}>
                      <th scope="row" className="py-2 text-left font-normal">
                        {s.name}
                      </th>
                      <td className="py-2 text-right">{formatMoney(c.diff.netEarnings, "TRY", { signed: true })}</td>
                      <td className="py-2 text-right">{formatMoney(c.diff.tax, "TRY", { signed: true })}</td>
                      <td className="py-2 text-right">{formatMoney(c.diff.endCash, "TRY", { signed: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="mt-6 text-sm font-semibold">5. Yıl sonu tahmini</h3>
          <p className="mt-1 text-xs text-muted">
            Vergi esasına göre: {settings.taxpayerType === "serbest_meslek" ? "serbest meslekte yalnızca tahsil edilmiş / ödenmiş kayıtlar sayılır" : "tahakkuk eden tüm kayıtlar sayılır"}; bu nedenle aylık özetteki tutarlardan farklı olabilir.
          </p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="py-2 font-medium">Ay</th>
                <th scope="col" className="py-2 text-right font-medium">Gelir</th>
                <th scope="col" className="py-2 text-right font-medium">Gider</th>
                <th scope="col" className="py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="tnum divide-y divide-border">
              {projection.months.map((m) => (
                <tr key={m.month} className={m.projected ? "text-muted" : undefined}>
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {monthLabel(m.month, true)} {m.projected && <span className="text-xs">(tahmin)</span>}
                  </th>
                  <td className="py-1.5 text-right">{formatMoney(m.income)}</td>
                  <td className="py-1.5 text-right">{formatMoney(m.expense)}</td>
                  <td className="py-1.5 text-right">{formatMoney(m.net)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="py-2 text-left">Tahmini net kazanç (vergi ve prim sonrası)</th>
                <td colSpan={3} className="py-2 text-right">
                  {formatMoney(projection.projectedNetEarnings)}
                </td>
              </tr>
            </tbody>
          </table>
          <ul className="mt-4 space-y-1 text-xs text-muted">
            {projection.assumptions.map((a) => (
              <li key={a}>• {a}</li>
            ))}
            <li>• Bu rapor genel bilgilendirme amaçlıdır; vergi veya yatırım tavsiyesi değildir.</li>
          </ul>
        </Card>
      </article>
    </>
  );
}

function ReportRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? "font-semibold" : undefined}>
      <th scope="row" className="py-2 text-left font-normal text-muted">
        {label}
      </th>
      <td className="py-2 text-right">{value}</td>
    </tr>
  );
}

function BreakdownTable({ title, rows, total }: { title: string; rows: { category: string; amount: number }[]; total: number }) {
  return (
    <table className="w-full text-sm">
      <caption className="pb-1 text-left text-xs font-medium text-muted">{title}</caption>
      <tbody className="tnum divide-y divide-border">
        {rows.length === 0 && (
          <tr>
            <td className="py-2 text-muted">Kayıt yok</td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.category}>
            <th scope="row" className="py-1.5 text-left font-normal">
              {r.category}
            </th>
            <td className="py-1.5 text-right">{formatMoney(r.amount)}</td>
            <td className="w-14 py-1.5 text-right text-xs text-subtle">{total > 0 ? `%${Math.round((r.amount / total) * 100)}` : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
