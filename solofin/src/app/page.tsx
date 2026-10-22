"use client";

import clsx from "clsx";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, Info, OctagonAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { DemoNotice, PageHeader } from "@/components/layout/AppShell";
import { Badge, Card, CardHeader, Explain, Row } from "@/components/ui";
import { MoneyBarChart, MoneyLineChart } from "@/components/charts/Charts";
import { useStore } from "@/lib/data/store";
import { useFinance } from "@/lib/data/useFinance";
import { buildAlerts } from "@/lib/finance/alerts";
import { addDays, addMonths, formatDate, monthLabel } from "@/lib/finance/dates";
import { dailyBalance } from "@/lib/finance/cashflow";
import { formatMoney } from "@/lib/finance/money";
import { lastNMonths, monthlySeries, totals } from "@/lib/finance/summary";
import { TX_STATUS_LABEL } from "@/lib/data/schema";

function Delta({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) return <span className="text-xs text-subtle">önceki dönem verisi yok</span>;
  const ratio = (current - previous) / Math.abs(previous);
  const up = ratio >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-positive" : "text-negative")}>
      <Icon aria-hidden className="h-3.5 w-3.5" />%{Math.abs(Math.round(ratio * 100))}
      <span className="ml-1 font-normal text-subtle">geçen aya göre</span>
    </span>
  );
}

export default function DashboardPage() {
  const { transactions, settings, today } = useStore();
  const { rules, projection, safe, events90, resilience } = useFinance();

  const mtd = useMemo(() => {
    const from = `${today.slice(0, 7)}-01`;
    const prevFrom = addMonths(from, -1);
    const prevTo = addMonths(today, -1);
    return { cur: totals(transactions, from, today), prev: totals(transactions, prevFrom, prevTo) };
  }, [transactions, today]);

  const months = useMemo(() => monthlySeries(transactions, lastNMonths(today, 6)), [transactions, today]);
  const events30 = useMemo(() => events90.filter((e) => e.date <= addDays(today, 30)), [events90, today]);
  const balance30 = useMemo(() => dailyBalance(settings.cashBalance, events30, today, 30), [settings.cashBalance, events30, today]);
  const alerts = useMemo(
    () => buildAlerts({ txs: transactions, settings, rules, today, safe, projection, resilience, events: events90 }).slice(0, 3),
    [transactions, settings, rules, today, safe, projection, resilience, events90],
  );
  const recent = transactions.slice(0, 6);
  const minBalance = Math.min(...balance30.map((b) => b.balance));

  return (
    <>
      <PageHeader title="Finansal merkez" description={`${formatDate(today)} itibarıyla · Vergi yılı ${settings.taxYear}`} />
      <DemoNotice />

      {/* Birincil değer */}
      <Card className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
          <div className="bg-gradient-to-br from-[#0b1a3a] to-[#0a1226] p-6 text-white sm:p-8">
            <p className="text-sm text-white/70">Bugün güvenle kullanabileceğin tahmini tutar</p>
            <p className="tnum mt-2 text-4xl font-semibold tracking-tight sm:text-5xl" data-testid="safe-amount">
              {formatMoney(safe.safeAmount)}
            </p>
            {safe.rawAmount < 0 ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-1 text-sm text-red-200">
                <OctagonAlert aria-hidden className="h-4 w-4" /> {formatMoney(-safe.rawAmount)} açık var
              </p>
            ) : (
              <p className="mt-3 max-w-md text-sm text-white/70">
                Vergi rezervi, önümüzdeki 30 günün ödemeleri ve güvenlik payı ayrıldıktan sonra kalan tutar. Beklenen tahsilatlar ihtiyatlılık gereği dahil edilmedi.
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="text-white/60">
                Beklenen tahsilat (30 gün): <span className="tnum font-medium text-white">{formatMoney(safe.expectedInflows)}</span>
              </span>
              <span className="text-white/60">
                30 günde en düşük bakiye: <span className="tnum font-medium text-white">{formatMoney(minBalance)}</span>
              </span>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-sm font-medium">Hesaplama</p>
            <div className="mt-2 divide-y divide-border/0">
              <Row label="Banka bakiyesi (senin girdiğin)" value={formatMoney(safe.cashBalance)} />
              <Row label="− Vergi rezervi" value={formatMoney(safe.taxReserve.total)} hint={`Gelir vergisi ${formatMoney(safe.taxReserve.incomeTax)} · KDV ${formatMoney(safe.taxReserve.vat)}`} />
              <Row label="− 30 gün içindeki ödemeler" value={formatMoney(safe.upcomingObligations)} />
              <Row label="− Güvenlik payı" value={formatMoney(safe.safetyBuffer)} />
              <Row label="Kullanılabilir" value={formatMoney(safe.safeAmount)} strong tone={safe.rawAmount < 0 ? "negative" : "positive"} />
            </div>
            <Explain className="mt-3">
              <p>Vergi rezervi banka bakiyesinden ayrı bir kavramdır: bakiyendeki paranın bir kısmı gelecekte ödeyeceğin vergilere aittir.</p>
              {safe.taxReserve.explanation.map((e) => (
                <p key={e}>• {e}</p>
              ))}
              <p>• 30 günlük ödemeler: bekleyen giderler ve tekrarlayan ödemeler (kira, abonelik, prim). Vergi ödemeleri rezervden karşılandığı için iki kez düşülmez.</p>
              <p>• Banka bakiyesini Ayarlar sayfasından güncelleyebilirsin.</p>
            </Explain>
          </div>
        </div>
      </Card>

      {/* KPI satırı */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Bu ay gelir" value={formatMoney(mtd.cur.income)} foot={<Delta current={mtd.cur.income} previous={mtd.prev.income} />} />
        <Kpi label="Bu ay iş gideri" value={formatMoney(mtd.cur.expense)} foot={<Delta current={mtd.cur.expense} previous={mtd.prev.expense} invert />} />
        <Kpi
          label="Tahmini vergi rezervi"
          value={formatMoney(safe.taxReserve.total)}
          foot={<span className="text-xs text-subtle">Yıllık tahmini gelir vergisi {formatMoney(projection.projectedTax.incomeTax)}</span>}
        />
        <Kpi
          label="Yıl sonu net kazanç tahmini"
          value={formatMoney(projection.projectedNetEarnings)}
          foot={<span className="text-xs text-subtle">Vergi ve prim sonrası · demo tahmini</span>}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Önümüzdeki 30 gün" subtitle="Beklenen bakiye (bekleyen tahsilat ve ödemeler dahil)" action={<Link href="/nakit-akisi" className="text-sm font-medium text-primary">Detay</Link>} />
          <div className="px-2 pb-4 pt-2 sm:px-4">
            <MoneyLineChart
              area
              ariaLabel="30 günlük beklenen banka bakiyesi grafiği"
              data={balance30.map((b) => ({ date: b.date, balance: b.balance }))}
              xKey="date"
              xFormatter={(d) => formatDate(d, { year: false })}
              series={[{ key: "balance", name: "Beklenen bakiye" }]}
              height={220}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Öncelikli uyarılar" subtitle="En önemli üç konu" />
          <ul className="space-y-1 p-3">
            {alerts.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">Şu an dikkat gerektiren bir durum yok.</li>}
            {alerts.map((a) => {
              const Icon = a.severity === 3 ? OctagonAlert : a.severity === 2 ? AlertTriangle : Info;
              return (
                <li key={a.id}>
                  <Link href={a.href ?? "/"} className="flex gap-3 rounded-xl p-3 hover:bg-surface-2">
                    <Icon aria-hidden className={clsx("mt-0.5 h-5 w-5 shrink-0", a.severity === 3 ? "text-negative" : a.severity === 2 ? "text-warning" : "text-primary")} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span className="sr-only">{a.severity === 3 ? "Kritik: " : a.severity === 2 ? "Uyarı: " : "Bilgi: "}</span>
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{a.detail}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Aylık özet" subtitle="Son 6 ay · KDV hariç, kişisel harcamalar hariç" />
          <div className="px-2 pb-4 pt-2 sm:px-4">
            <MoneyBarChart
              ariaLabel="Son 6 ayın gelir ve gider karşılaştırması"
              data={months.map((m) => ({ month: m.month, income: m.income, expense: m.expense }))}
              xKey="month"
              xFormatter={(m) => monthLabel(m)}
              series={[
                { key: "income", name: "Gelir" },
                { key: "expense", name: "Gider" },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Yaklaşan ödemeler" subtitle="30 gün" />
          <ul className="divide-y divide-border px-5 pb-3">
            {events30.filter((e) => e.amount < 0).length === 0 && <li className="py-6 text-center text-sm text-muted">Yaklaşan ödeme yok.</li>}
            {events30
              .filter((e) => e.amount < 0)
              .slice(0, 6)
              .map((e, i) => (
                <li key={`${e.date}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.label}</p>
                    <p className="text-xs text-subtle">
                      {formatDate(e.date, { year: false })}
                      {e.coveredByReserve && " · vergi rezervinden"}
                      {e.source === "estimate" && " · tahmini"}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-sm font-medium">{formatMoney(-e.amount)}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Son işlemler" action={<Link href="/islemler" className="inline-flex items-center text-sm font-medium text-primary">Tümü <ChevronRight className="h-4 w-4" /></Link>} />
        <ul className="divide-y divide-border px-5 pb-3">
          {recent.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.description || t.category}</p>
                <p className="truncate text-xs text-subtle">
                  {t.counterparty} · {t.category} · {formatDate(t.date)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={clsx("tnum text-sm font-semibold", t.kind === "income" ? "text-positive" : "text-fg")}>
                  {t.kind === "income" ? "+" : "−"}
                  {formatMoney(t.amount)}
                </p>
                {t.status !== "paid" && <Badge tone={t.status === "overdue" ? "negative" : "warning"}>{TX_STATUS_LABEL[t.status]}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Kpi({ label, value, foot }: { label: string; value: string; foot?: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p className="tnum mt-1.5 text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
      <div className="mt-1.5 min-h-[1rem]">{foot}</div>
    </Card>
  );
}
