"use client";

import clsx from "clsx";
import { CheckCircle2, FolderOpen, Lightbulb, RotateCcw, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DemoNotice, PageHeader } from "@/components/layout/AppShell";
import { MoneyLineChart } from "@/components/charts/Charts";
import { Badge, Button, Card, CardHeader, Field, Input, Switch } from "@/components/ui";
import type { ScenarioLevers } from "@solofin/core/data/schema";
import { useStore } from "@/lib/data/store";
import { useFinance } from "@/lib/data/useFinance";
import { formatDate } from "@solofin/core/finance/dates";
import { formatMoney, formatPercent, type Kurus } from "@solofin/core/finance/money";
import { RETURN_PROFILES } from "@solofin/core/finance/retirement";
import { baselineFromProjection, compareScenario, NEUTRAL_LEVERS, SCENARIO_PRESETS } from "@solofin/core/finance/scenarios";

function MoneyLever({ id, label, value, onChange, hint }: { id: string; label: string; value: Kurus; onChange: (v: Kurus) => void; hint?: string }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">₺</span>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          className="pl-7 tnum"
          value={value === 0 ? "" : value / 100}
          placeholder="0"
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0);
          }}
        />
      </div>
    </Field>
  );
}

function PercentLever({ id, label, value, onChange, min, max, hint }: { id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; hint?: string }) {
  const pct = Math.round(value * 100);
  return (
    <Field label={`${label}: %${pct}`} htmlFor={id} hint={hint}>
      <input id={id} type="range" min={min} max={max} step={1} value={pct} onChange={(e) => onChange(Number(e.target.value) / 100)} className="w-full accent-[rgb(var(--primary))]" aria-valuetext={`yüzde ${pct}`} />
    </Field>
  );
}

function DiffCell({ value, invert, format = formatMoney }: { value: number; invert?: boolean; format?: (v: number) => string }) {
  if (value === 0 || !Number.isFinite(value)) return <span className="text-subtle">—</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={clsx("font-semibold", good ? "text-positive" : "text-negative")}>
      {value > 0 ? "+" : "−"}
      {format(Math.abs(value))}
    </span>
  );
}

const months = (v: number) => (Number.isFinite(v) ? `${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ay` : "süresiz");

export default function ScenariosPage() {
  const store = useStore();
  const { settings, retirement, scenarios } = store;
  const { rules, projection, safe } = useFinance();

  const [levers, setLevers] = useState<ScenarioLevers>({ ...NEUTRAL_LEVERS, ...SCENARIO_PRESETS[0].levers });
  const [name, setName] = useState(SCENARIO_PRESETS[0].name);
  const [loadedId, setLoadedId] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

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
  const cmp = useMemo(() => compareScenario(baseline, levers, rules), [baseline, levers, rules]);
  const set = <K extends keyof ScenarioLevers>(k: K, v: ScenarioLevers[K]) => {
    setLevers((l) => ({ ...l, [k]: v }));
    setSaved(false);
  };

  const { baseline: b, scenario: s, diff } = cmp;
  const rows: { label: string; b: string; s: string; d: React.ReactNode }[] = [
    { label: "Yıllık gelir", b: formatMoney(b.annualIncome), s: formatMoney(s.annualIncome), d: <DiffCell value={diff.annualIncome} /> },
    { label: "Yıllık işletme gideri", b: formatMoney(b.annualExpense), s: formatMoney(s.annualExpense), d: <DiffCell value={diff.annualExpense} invert /> },
    { label: "Tek seferlik alım", b: formatMoney(0), s: formatMoney(levers.oneOffPurchase), d: <DiffCell value={levers.oneOffPurchase} invert /> },
    { label: "Vergi matrahı", b: formatMoney(b.tax.taxableBase), s: formatMoney(s.tax.taxableBase), d: <DiffCell value={s.tax.taxableBase - b.tax.taxableBase} invert /> },
    { label: "Tahmini gelir vergisi", b: formatMoney(b.tax.incomeTax), s: formatMoney(s.tax.incomeTax), d: <DiffCell value={diff.tax} invert /> },
    { label: "Net kazanç", b: formatMoney(b.netEarnings), s: formatMoney(s.netEarnings), d: <DiffCell value={diff.netEarnings} /> },
    { label: "12. ay sonu nakit", b: formatMoney(b.endCash), s: formatMoney(s.endCash), d: <DiffCell value={diff.endCash} /> },
    { label: "En düşük nakit", b: formatMoney(b.minCash), s: formatMoney(s.minCash), d: <DiffCell value={diff.minCash} /> },
    { label: "Gelirsiz dayanma süresi", b: months(b.runwayMonths), s: months(s.runwayMonths), d: <DiffCell value={diff.runwayMonths} format={(v) => months(v)} /> },
  ];
  if (levers.extraMonthlySavings > 0)
    rows.push({ label: "Emeklilikte ek birikim (bugünün parasıyla)", b: formatMoney(0), s: formatMoney(s.retirementBoost), d: <DiffCell value={s.retirementBoost} /> });

  const insight = buildInsight(levers, diff);

  return (
    <>
      <PageHeader title="Senaryo karşılaştırma" description="Bir kararın vergi, nakit ve net kazanç etkisini önümüzdeki 12 ay için gör." />
      <DemoNotice what="Baz durum" />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Hazır senaryolar">
        {SCENARIO_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setLevers({ ...NEUTRAL_LEVERS, ...p.levers });
              setName(p.name);
              setLoadedId(undefined);
              setSaved(false);
            }}
            className={clsx("shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors", name === p.name && !loadedId ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-fg")}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Varsayımlar</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLevers(NEUTRAL_LEVERS);
                setLoadedId(undefined);
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Sıfırla
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            <MoneyLever id="purchase" label="Tek seferlik ekipman / yatırım (KDV hariç)" value={levers.oneOffPurchase} onChange={(v) => set("oneOffPurchase", v)} />
            {levers.oneOffPurchase > 0 && (
              <Switch
                label="Vergi açısından gider kabul edilirse"
                description="Kabul, belgeye ve işle ilişkiye bağlıdır."
                checked={levers.oneOffPurchaseDeductible}
                onChange={(v) => set("oneOffPurchaseDeductible", v)}
              />
            )}
            <PercentLever id="price" label="Fiyat değişimi" value={levers.priceChange} min={-50} max={100} onChange={(v) => set("priceChange", v)} />
            <PercentLever id="drop" label="Gelir kaybı" value={levers.incomeDrop} min={0} max={100} onChange={(v) => set("incomeDrop", v)} />
            <MoneyLever id="client" label="Yeni müşteriden aylık gelir" value={levers.newClientMonthly} onChange={(v) => set("newClientMonthly", v)} />
            <Field label={`Tahsilat gecikmesi: ${levers.collectionDelayDays} gün`} htmlFor="delay">
              <input id="delay" type="range" min={0} max={120} step={5} value={levers.collectionDelayDays} onChange={(e) => set("collectionDelayDays", Number(e.target.value))} className="w-full accent-[rgb(var(--primary))]" />
            </Field>
            <MoneyLever id="cost" label="Aylık gider artışı" value={levers.monthlyExpenseIncrease} onChange={(v) => set("monthlyExpenseIncrease", v)} />
            <MoneyLever id="savings" label="Emeklilik için ek aylık birikim" value={levers.extraMonthlySavings} onChange={(v) => set("extraMonthlySavings", v)} hint="Orta profil (%3 reel getiri) varsayımıyla" />
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <Field label="Senaryo adı" htmlFor="sc-name">
              <Input id="sc-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button
              className="mt-3 w-full"
              onClick={() => {
                const sc = store.saveScenario(name, levers, loadedId);
                setLoadedId(sc.id);
                setSaved(true);
              }}
            >
              <Save className="h-4 w-4" aria-hidden /> {loadedId ? "Senaryoyu güncelle" : "Senaryoyu kaydet"}
            </Button>
            {saved && (
              <p role="status" className="mt-2 text-center text-xs text-positive">
                Kaydedildi
              </p>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="border-positive/30 bg-positive/5 p-5">
            <div className="flex gap-3">
              <Lightbulb aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
              <div>
                <p className="text-sm font-semibold">Özet</p>
                <p className="mt-1 text-sm text-muted" data-testid="scenario-insight">
                  {insight}
                </p>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Yan yana karşılaştırma" subtitle="Önümüzdeki 12 ay" action={b.tax.isDemoEstimate ? <Badge tone="warning">Demo tahmini</Badge> : undefined} />
            <div className="overflow-x-auto px-5 pb-5 pt-3">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="py-2 font-medium">Kalem</th>
                    <th scope="col" className="py-2 text-right font-medium">Mevcut</th>
                    <th scope="col" className="py-2 text-right font-medium">Senaryo</th>
                    <th scope="col" className="py-2 text-right font-medium">Fark</th>
                  </tr>
                </thead>
                <tbody className="tnum divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.label} className={r.label === "Net kazanç" ? "font-semibold" : undefined}>
                      <th scope="row" className="py-2.5 text-left font-normal text-muted">
                        {r.label}
                      </th>
                      <td className="py-2.5 text-right">{r.b}</td>
                      <td className="py-2.5 text-right">{r.s}</td>
                      <td className="py-2.5 text-right">{r.d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Nakit akışı etkisi" subtitle="Vergi rezervi düşülmüş nakit, ay sonu bakiyeleri" />
            <div className="px-2 pb-4 pt-2 sm:px-4">
              <MoneyLineChart
                ariaLabel="Mevcut durum ve senaryo için 12 aylık nakit bakiyesi"
                data={b.monthlyCash.map((m, i) => ({ month: `${m.month}. ay`, mevcut: m.balance, senaryo: s.monthlyCash[i].balance }))}
                xKey="month"
                series={[
                  { key: "mevcut", name: "Mevcut" },
                  { key: "senaryo", name: "Senaryo", dashed: true },
                ]}
                zeroLine
              />
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 aria-hidden className="h-4 w-4 text-primary" /> Kullanılan varsayımlar
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted">
                {cmp.assumptions.map((a) => (
                  <li key={a}>• {a}</li>
                ))}
                <li>
                  • Baz aylık gelir {formatMoney(baseline.monthlyIncome)}, gider {formatMoney(baseline.monthlyExpense)}, Bağ-Kur {formatMoney(baseline.monthlySocialSecurity)}, kişisel harcama{" "}
                  {formatMoney(baseline.monthlyPersonalSpend)}.
                </li>
              </ul>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Belirsizlikler</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted">
                {cmp.uncertainties.map((u) => (
                  <li key={u}>• {u}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-subtle">Bu hesaplama genel bilgilendirme amaçlıdır; yatırım veya vergi tavsiyesi değildir. Kesin durum için mali müşavirine danış.</p>
            </Card>
          </div>

          <Card>
            <CardHeader title="Kayıtlı senaryolar" />
            {scenarios.length === 0 ? (
              <p className="px-5 pb-5 pt-2 text-sm text-muted">Henüz kayıtlı senaryo yok.</p>
            ) : (
              <ul className="divide-y divide-border px-5 pb-3" data-testid="saved-scenarios">
                {scenarios.map((sc) => (
                  <li key={sc.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{sc.name}</p>
                      <p className="text-xs text-subtle">{formatDate(sc.createdAt.slice(0, 10))}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setLevers(sc.levers);
                          setName(sc.name);
                          setLoadedId(sc.id);
                          setSaved(false);
                        }}
                      >
                        <FolderOpen className="h-4 w-4" aria-hidden /> Aç
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${sc.name} senaryosunu sil`}
                        onClick={() => {
                          store.deleteScenario(sc.id);
                          if (loadedId === sc.id) setLoadedId(undefined);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function buildInsight(levers: ScenarioLevers, diff: ReturnType<typeof compareScenario>["diff"]): string {
  const parts: string[] = [];
  const tax = diff.tax;
  const net = diff.netEarnings;
  const isNeutral = Object.entries(levers).every(([k, v]) => (NEUTRAL_LEVERS as Record<string, unknown>)[k] === v);
  if (isNeutral) return "Bir varsayımı değiştirerek etkisini burada gör.";
  if (tax !== 0) parts.push(`Tahmini gelir vergin ${formatMoney(Math.abs(tax))} ${tax < 0 ? "azalır" : "artar"}`);
  if (net !== 0) parts.push(`12 aylık net kazancın ${formatMoney(Math.abs(net))} ${net > 0 ? "artar" : "azalır"}`);
  if (diff.minCash < 0) parts.push(`en düşük nakit seviyen ${formatMoney(-diff.minCash)} düşer`);
  let text = parts.length ? `${parts.join(", ")}.` : "Bu değişiklik 12 aylık sonuçları belirgin biçimde etkilemiyor.";
  if (levers.oneOffPurchase > 0 && tax < 0 && net < 0) {
    text += ` Vergi avantajı (${formatMoney(-tax)}) harcamanın kendisinden küçüktür; gider yalnızca işin için gerçekten gerekliyse anlamlıdır.`;
  }
  if (levers.priceChange > 0) text += ` Etkin oran: ek gelirin yaklaşık ${formatPercent(diff.annualIncome > 0 ? net / diff.annualIncome : 0, 0)}'i net kazanca dönüşür.`;
  return text;
}
