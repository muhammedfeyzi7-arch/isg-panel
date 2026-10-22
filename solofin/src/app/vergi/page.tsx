"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { DemoNotice, PageHeader } from "@/components/layout/AppShell";
import { MoneyLineChart } from "@/components/charts/Charts";
import { Badge, Card, CardHeader, Explain, Field, Input, Row, Segmented, Switch } from "@/components/ui";
import { TAXPAYER_LABEL } from "@/lib/data/schema";
import { useStore } from "@/lib/data/store";
import { useFinance } from "@/lib/data/useFinance";
import { formatDate, monthLabel } from "@/lib/finance/dates";
import { formatMoney, formatPercent, parseMoneyInput } from "@/lib/finance/money";
import { buildTaxBasis, countsForTax, monthlySeries, projectYear, taxInputFromBasis } from "@/lib/finance/summary";
import { computeProgressiveTax, computeVat, deductionImpact, estimateProvisionalTax } from "@/lib/finance/tax/engine";
import { allRuleMetas, type Verification } from "@/lib/finance/tax/rules";

const VERIFICATION_LABEL: Record<Verification, { label: string; tone: "positive" | "warning" | "negative" }> = {
  official: { label: "Resmî kaynakla doğrulandı", tone: "positive" },
  secondary: { label: "İkincil kaynak", tone: "warning" },
  unverified: { label: "Doğrulanmadı", tone: "negative" },
};

export default function TaxPage() {
  const { transactions, settings, today } = useStore();
  const { rules, ruleFallback } = useFinance();
  const [period, setPeriod] = useState<"projected" | "ytd">("projected");
  const [includeAssumed, setIncludeAssumed] = useState(true);
  const [extraExpense, setExtraExpense] = useState("50.000");

  const projection = useMemo(() => projectYear(transactions, settings, rules, today, { includeAssumed }), [transactions, settings, rules, today, includeAssumed]);
  const basis = period === "projected" ? projection.projectedBasis : projection.ytd;
  const tax = period === "projected" ? projection.projectedTax : projection.ytdTax;
  const allExpenses = basis.confirmedDeductible + basis.assumedDeductible + basis.unknownExpenses + basis.nonDeductible;
  const netEarnings = basis.grossIncome - allExpenses - basis.socialSecurity - tax.incomeTax;

  const totalTax = tax.slices.reduce((s, x) => s + x.taxInSlice, 0);

  // KDV — gelir vergisinden ayrı
  const vat = useMemo(() => {
    const ytd = buildTaxBasis(transactions, settings, rules, `${settings.taxYear}-01-01`, today);
    const month = buildTaxBasis(transactions, settings, rules, `${today.slice(0, 7)}-01`, today);
    return { ytd: computeVat(ytd.salesForVat, ytd.purchasesForVat), month: computeVat(month.salesForVat, month.purchasesForVat) };
  }, [transactions, settings, rules, today]);

  // Geçici vergi dönemleri
  const provisional = useMemo(() => {
    let paid = 0;
    return rules.provisionalTax.quarters.map((q) => {
      const end = `${settings.taxYear}-${String(q.endMonth).padStart(2, "0")}-31`;
      const due = `${settings.taxYear}-${String(q.dueMonth).padStart(2, "0")}-${String(q.dueDay).padStart(2, "0")}`;
      const b = buildTaxBasis(transactions, settings, rules, `${settings.taxYear}-01-01`, end);
      const profit = Math.max(0, b.grossIncome - b.confirmedDeductible - (includeAssumed ? b.assumedDeductible : 0) - b.depreciation - (settings.deductSocialSecurity ? b.socialSecurity : 0));
      const est = Math.max(0, estimateProvisionalTax(profit, paid, rules) - b.withholdingCredits);
      paid += est;
      return { ...q, due, profit, est, past: due < today, complete: end.slice(0, 7) < today.slice(0, 7) };
    });
  }, [transactions, settings, rules, today, includeAssumed]);

  // Gider etkisi
  const extra = parseMoneyInput(extraExpense) ?? 0;
  const impact = useMemo(
    () => deductionImpact(taxInputFromBasis(projection.projectedBasis, settings, { includeAssumed }), extra, rules),
    [projection.projectedBasis, settings, includeAssumed, extra, rules],
  );

  // Kümülatif gelir ve yaklaşık kümülatif vergi
  const cumulative = useMemo(() => {
    const counted = transactions.filter((t) => countsForTax(t, settings));
    const actual = monthlySeries(counted, projection.months.map((m) => m.month));
    let inc = 0;
    let net = 0;
    return projection.months.map((m, i) => {
      const src = m.projected ? m : actual[i];
      inc += src.income;
      net += src.income - src.expense;
      return { month: m.month, gelir: inc, vergi: computeProgressiveTax(Math.max(0, net), rules.incomeTax.brackets).tax };
    });
  }, [projection, transactions, settings, rules]);

  return (
    <>
      <PageHeader title="Vergi simülatörü" description={`${rules.label} · ${TAXPAYER_LABEL[settings.taxpayerType]}`} />
      <DemoNotice what="Hesaplamalar" />

      <div role="note" className="mb-4 flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
        <ShieldAlert aria-hidden className="h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="font-semibold text-fg">Demo tahmini — kesin vergi yükümlülüğü değildir</p>
          <p className="mt-0.5 text-muted">
            Vergi kuralları resmî mevzuat metniyle birebir doğrulanmamıştır. Sonuçlar karar desteği içindir; beyan ve ödeme öncesinde mali müşavirine danış.
            {ruleFallback && ` ${settings.taxYear} için kural seti yok; ${rules.year} kuralları kullanıldı.`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Dönem"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "projected", label: "Yıl sonu tahmini" },
            { value: "ytd", label: "Bugüne kadar" },
          ]}
        />
        <div className="sm:w-80">
          <Switch label="Varsayımsal giderleri dahil et" description="'İndirilebilir (varsayım)' işaretli giderler" checked={includeAssumed} onChange={setIncludeAssumed} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Gelir vergisi hesabı</h2>
            <Badge tone="warning">Demo tahmini</Badge>
          </div>
          <div className="mt-3">
            <Row label="Brüt gelir" value={formatMoney(basis.grossIncome)} />
            <Row label="− İndirilebilir gider (onaylı)" value={formatMoney(basis.confirmedDeductible)} />
            <Row label="− İndirilebilir gider (varsayım)" value={includeAssumed ? formatMoney(basis.assumedDeductible) : "dahil değil"} />
            <Row label="− Amortisman" value={formatMoney(basis.depreciation)} />
            <Row label="− Bağ-Kur primi" value={formatMoney(tax.socialSecurityDeduction)} hint={!settings.deductSocialSecurity ? "Ayarlarda kapalı" : undefined} />
            {tax.youngEntrepreneurExemption > 0 && <Row label="− Genç girişimci istisnası" value={formatMoney(tax.youngEntrepreneurExemption)} />}
            <Row label="Tahmini vergi matrahı" value={formatMoney(tax.taxableBase)} strong />
            <Row label="Tahmini gelir vergisi" value={formatMoney(tax.incomeTax)} strong />
            <Row label="− Kaynakta kesilen stopaj" value={formatMoney(tax.withholdingCredits)} />
            <Row label="− Ödenen geçici vergi" value={formatMoney(tax.provisionalPaid)} />
            <Row
              label={tax.remainingPayable >= 0 ? "Tahmini kalan ödeme" : "Mahsup / iade edilebilir"}
              value={formatMoney(Math.abs(tax.remainingPayable))}
              strong
              tone={tax.remainingPayable >= 0 ? "warning" : "positive"}
            />
            <Row label="Tahmini net kazanç" value={formatMoney(netEarnings)} strong tone="positive" hint="Gelir − tüm iş giderleri − prim − gelir vergisi" />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
            <span>Efektif oran: <strong className="text-fg">{formatPercent(tax.effectiveRate)}</strong></span>
            <span>Marjinal oran: <strong className="text-fg">{formatPercent(tax.marginalRate, 0)}</strong></span>
            {basis.unknownExpenses > 0 && <span>Değerlendirilmemiş gider: {formatMoney(basis.unknownExpenses)} (matraha dahil değil)</span>}
          </div>
          {tax.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {tax.notes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          )}
          <Explain className="mt-4">
            {projection.assumptions.map((a) => (
              <p key={a}>• {a}</p>
            ))}
            <p>• Artan oranlı tarifede her dilimin oranı yalnızca o dilime giren tutara uygulanır.</p>
            <p>• Zarar mahsubu, damga vergisi, diğer kazanç türleri ve özel indirimler modellenmedi.</p>
          </Explain>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Vergi dilimi dağılımı</h2>
            <p className="mt-0.5 text-sm text-muted">Matrahın her dilime düşen kısmı ve o dilimin vergisi</p>
            <div className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Vergi matrahının dilimlere dağılımı">
              {tax.slices.map((s, i) =>
                s.taxableInSlice > 0 ? (
                  <div key={i} style={{ width: `${(s.taxableInSlice / Math.max(1, tax.taxableBase)) * 100}%`, background: `rgb(var(--primary) / ${0.3 + i * 0.17})` }} />
                ) : null,
              )}
            </div>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="pb-2 font-medium">Dilim</th>
                  <th scope="col" className="pb-2 text-right font-medium">Matrah</th>
                  <th scope="col" className="pb-2 text-right font-medium">Vergi</th>
                </tr>
              </thead>
              <tbody className="tnum divide-y divide-border">
                {tax.slices.map((s, i) => (
                  <tr key={i} className={clsx(s.taxableInSlice === 0 && "text-subtle")}>
                    <th scope="row" className="py-2 text-left font-normal">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: `rgb(var(--primary) / ${0.3 + i * 0.17})` }} aria-hidden />
                      %{Math.round(s.rate * 100)} <span className="text-xs text-subtle">({s.to === null ? `${formatMoney(s.from)} üzeri` : `${formatMoney(s.to)}'ye kadar`})</span>
                    </th>
                    <td className="py-2 text-right">{formatMoney(s.taxableInSlice)}</td>
                    <td className="py-2 text-right">{formatMoney(s.taxInSlice)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <th scope="row" className="py-2 text-left">Toplam</th>
                  <td className="py-2 text-right">{formatMoney(tax.taxableBase)}</td>
                  <td className="py-2 text-right">{formatMoney(totalTax)}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Bir gider vergi açısından kabul edilirse</h2>
            <p className="mt-0.5 text-sm text-muted">Yıl sonu tahmini üzerinden. Daha fazla harcamaya teşvik değildir.</p>
            <Field label="Gider tutarı (KDV hariç)" htmlFor="extra" className="mt-3">
              <Input id="extra" inputMode="decimal" value={extraExpense} onChange={(e) => setExtraExpense(e.target.value)} />
            </Field>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-muted">Vergi farkı</p>
                <p className="tnum mt-1 font-semibold text-positive">{formatMoney(impact.taxDifference)}</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-muted">Net maliyet</p>
                <p className="tnum mt-1 font-semibold">{formatMoney(impact.netCost)}</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-muted">Net kazanç etkisi</p>
                <p className="tnum mt-1 font-semibold text-negative">−{formatMoney(impact.netCost)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">
              {extra > 0
                ? `${formatMoney(extra)} tutarındaki gider kabul edilirse tahmini vergin ${formatMoney(impact.taxDifference)} azalır; ancak harcamanın kendisi net kazancını ${formatMoney(impact.netCost)} düşürür.`
                : "Bir tutar gir."}
            </p>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Yıl sonu tahmini" subtitle="Kümülatif gelir ve yaklaşık kümülatif gelir vergisi" />
          <div className="px-2 pb-4 pt-2 sm:px-4">
            <MoneyLineChart
              ariaLabel="Aylara göre kümülatif gelir ve tahmini vergi"
              data={cumulative}
              xKey="month"
              xFormatter={(m) => monthLabel(m)}
              series={[
                { key: "gelir", name: "Kümülatif gelir" },
                { key: "vergi", name: "Tahmini vergi", color: "var(--series-2)" },
              ]}
            />
            <p className="px-2 text-xs text-subtle">Gerçekleşen aylardan sonrası tahmindir. Kümülatif vergi, Bağ-Kur ve amortisman hariç yaklaşık bir göstergedir.</p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">KDV (ayrı hesap)</h2>
          <p className="mt-0.5 text-sm text-muted">KDV gelirin parçası değildir; tahsil edilip devlete aktarılır.</p>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-subtle">Bu ay</p>
          <Row label="Hesaplanan KDV" value={formatMoney(vat.month.outputVat)} />
          <Row label="İndirilecek KDV" value={formatMoney(vat.month.inputVat)} />
          <Row label={vat.month.net >= 0 ? "Ödenecek (tahmini)" : "Devreden"} value={formatMoney(Math.abs(vat.month.net))} strong />
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-subtle">Yıl başından beri</p>
          <Row label="Hesaplanan KDV" value={formatMoney(vat.ytd.outputVat)} />
          <Row label="İndirilecek KDV" value={formatMoney(vat.ytd.inputVat)} />
          <p className="mt-3 text-xs text-subtle">Aylık beyan varsayıldı. Tevkifat, istisna koşulları ve devreden KDV zinciri ayrıntılı modellenmedi.</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Geçici vergi dönemleri</h2>
          <p className="mt-0.5 text-sm text-muted">Kümülatif dönem kazancı × %{Math.round(rules.provisionalTax.rate * 100)} − önceki ödemeler − stopaj (basitleştirilmiş)</p>
          <ul className="mt-3 divide-y divide-border">
            {provisional.map((q) => (
              <li key={q.label} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{q.label}</p>
                  <p className="text-xs text-subtle">
                    Son ödeme {formatDate(q.due)} · {q.past ? "geçti" : q.complete ? "dönem kapandı" : "dönem devam ediyor"}
                  </p>
                </div>
                <span className="tnum font-medium">{formatMoney(q.est)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-subtle">Ayarlarda girdiğin ödenmiş geçici vergi: {formatMoney(settings.provisionalTaxPaid)}</p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Kullanılan kurallar</h2>
          <p className="mt-0.5 text-sm text-muted">Kural seti {rules.id}</p>
          <ul className="mt-3 divide-y divide-border">
            {allRuleMetas(rules).map(({ name, meta }) => {
              const v = VERIFICATION_LABEL[meta.verification];
              return (
                <li key={name} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{name}</p>
                    <Badge tone={v.tone}>
                      {meta.verification === "official" ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
                      {v.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {meta.source}
                    {meta.sourceUrl && (
                      <>
                        {" · "}
                        <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                          kaynak
                        </a>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-subtle">
                    Yürürlük {formatDate(meta.effectiveFrom)} · Son kontrol {meta.lastVerifiedAt ? formatDate(meta.lastVerifiedAt) : "yok"}
                  </p>
                  {meta.note && <p className="mt-1 text-xs text-subtle">{meta.note}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
