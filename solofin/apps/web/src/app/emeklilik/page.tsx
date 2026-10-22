"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { MoneyLineChart } from "@/components/charts/Charts";
import { Badge, Button, Card, CardHeader, Explain, Field, Input, Row } from "@/components/ui";
import { retirementInputSchema, type RetirementInput } from "@solofin/core/data/schema";
import { useStore } from "@/lib/data/store";
import { formatMoney, formatPercent } from "@solofin/core/finance/money";
import { projectRetirement, RETURN_PROFILES } from "@solofin/core/finance/retirement";

type FormState = Record<keyof RetirementInput, string>;

function toForm(r: RetirementInput): FormState {
  return {
    currentAge: String(r.currentAge),
    targetAge: String(r.targetAge),
    currentSavings: String(r.currentSavings / 100),
    monthlyContribution: String(r.monthlyContribution / 100),
    inflation: String(Math.round(r.inflation * 1000) / 10),
    targetMonthlyBudget: String(r.targetMonthlyBudget / 100),
    withdrawalRate: String(Math.round(r.withdrawalRate * 1000) / 10),
  };
}

function fromForm(f: FormState) {
  return retirementInputSchema.safeParse({
    currentAge: Number(f.currentAge),
    targetAge: Number(f.targetAge),
    currentSavings: Math.round(Number(f.currentSavings) * 100),
    monthlyContribution: Math.round(Number(f.monthlyContribution) * 100),
    inflation: Number(f.inflation) / 100,
    targetMonthlyBudget: Math.round(Number(f.targetMonthlyBudget) * 100),
    withdrawalRate: Number(f.withdrawalRate) / 100,
  });
}

const FIELDS: { key: keyof RetirementInput; label: string; suffix?: string; hint?: string }[] = [
  { key: "currentAge", label: "Şu anki yaşın" },
  { key: "targetAge", label: "Hedef emeklilik yaşı" },
  { key: "currentSavings", label: "Mevcut birikim", suffix: "₺" },
  { key: "monthlyContribution", label: "Aylık katkı (bugünün parasıyla)", suffix: "₺", hint: "Enflasyonla birlikte artırılacağı varsayılır" },
  { key: "inflation", label: "Tahmini yıllık enflasyon", suffix: "%" },
  { key: "targetMonthlyBudget", label: "Hedef aylık emeklilik bütçesi", suffix: "₺", hint: "Bugünün satın alma gücüyle" },
  { key: "withdrawalRate", label: "Yıllık çekim oranı", suffix: "%", hint: "Birikimden her yıl çekilecek pay (ör. %4)" },
];

export default function RetirementPage() {
  const { retirement, saveRetirement } = useStore();
  const [form, setForm] = useState<FormState>(() => toForm(retirement));
  const [savedMsg, setSavedMsg] = useState(false);
  const parsed = fromForm(form);
  const input = parsed.success && parsed.data.targetAge > parsed.data.currentAge ? parsed.data : null;

  const projections = useMemo(() => (input ? RETURN_PROFILES.map((p) => projectRetirement(input, p)) : []), [input]);

  const chartData = useMemo(() => {
    if (!projections.length) return [];
    return projections[0].yearly.map((y, i) => ({
      age: String(y.age),
      cautious: projections[0].yearly[i].real,
      moderate: projections[1].yearly[i].real,
      high: projections[2].yearly[i].real,
    }));
  }, [projections]);

  const errors = parsed.success ? (input ? null : "Hedef yaş şu anki yaştan büyük olmalı") : parsed.error.issues.map((i) => i.message).join(" · ");

  return (
    <>
      <PageHeader title="Emeklilik ve uzun vade" description="Birikim hızının hedefe yetip yetmediğini üç varsayımsal getiri profiliyle gör." />

      <div role="note" className="mb-4 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
        Getiriler <strong className="text-fg">varsayımsaldır ve garanti edilmez</strong>. Bu sayfa yatırım tavsiyesi değildir; vergi, fon giderleri ve piyasa dalgalanması modellenmez.
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="text-[15px] font-semibold">Girdiler</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (input) {
                saveRetirement(input);
                setSavedMsg(true);
                setTimeout(() => setSavedMsg(false), 2500);
              }
            }}
          >
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`ret-${f.key}`} hint={f.hint}>
                <div className="relative">
                  {f.suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">{f.suffix}</span>}
                  <Input
                    id={`ret-${f.key}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    className="tnum pr-8"
                    value={form[f.key]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                </div>
              </Field>
            ))}
            {errors && (
              <p role="alert" className="text-sm text-negative">
                {errors}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={!input}>
              Girdileri kaydet
            </Button>
            {savedMsg && (
              <p role="status" className="text-center text-xs text-positive">
                Kaydedildi
              </p>
            )}
          </form>
        </Card>

        <div className="min-w-0 space-y-4">
          {input && projections.length > 0 && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {projections.map((p) => {
                  const ok = p.gapReal === 0;
                  return (
                    <Card key={p.profile.id} className="p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{p.profile.label}</p>
                        <Badge tone={ok ? "positive" : "warning"}>{ok ? "Hedefe ulaşıyor" : "Açık var"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-subtle">
                        Reel getiri {formatPercent(p.profile.realReturn, 0)} · nominal ≈ {formatPercent(p.nominalReturn)}
                      </p>
                      <p className="mt-3 text-xs text-muted">{input.targetAge} yaşında, bugünün parasıyla</p>
                      <p className="tnum text-2xl font-semibold tracking-tight">{formatMoney(p.realBalance)}</p>
                      <p className="tnum mt-1 text-xs text-subtle">Nominal karşılığı: {formatMoney(p.nominalBalance)}</p>
                      <div className="mt-3 border-t border-border pt-2">
                        <Row label="Sürdürülebilir aylık gelir" value={formatMoney(p.sustainableMonthlyReal)} />
                        <Row label="Hedef için gereken aylık katkı" value={formatMoney(p.requiredMonthly)} tone={p.requiredMonthly > input.monthlyContribution ? "warning" : "positive"} />
                        {!ok && <Row label="Açık (bugünün parasıyla)" value={formatMoney(p.gapReal)} tone="negative" />}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardHeader title="Birikim projeksiyonu" subtitle="Bugünün satın alma gücüyle (enflasyondan arındırılmış)" />
                <div className="px-2 pb-4 pt-2 sm:px-4">
                  <MoneyLineChart
                    ariaLabel="Yaşa göre reel birikim, üç getiri profili"
                    data={chartData}
                    xKey="age"
                    xFormatter={(a) => `${a} yaş`}
                    series={[
                      { key: "cautious", name: "Temkinli" },
                      { key: "moderate", name: "Orta" },
                      { key: "high", name: "Yüksek (varsayımsal)" },
                    ]}
                    height={280}
                  />
                  <p className="px-2 text-xs text-subtle">Gereken birikim (bugünün parasıyla): {formatMoney(projections[0].requiredReal)}</p>
                </div>
              </Card>

              <Explain title="Varsayımlar ve hesaplama">
                <p>• Gereken birikim = hedef aylık bütçe × 12 ÷ yıllık çekim oranı ({formatMoney(input.targetMonthlyBudget)} × 12 ÷ {formatPercent(input.withdrawalRate)}).</p>
                <p>• Hesap reel (enflasyondan arındırılmış) değerlerle aylık bileşik olarak yapılır; nominal tutar = reel × (1 + enflasyon)^yıl.</p>
                <p>• Nominal getiri = (1 + reel getiri) × (1 + enflasyon) − 1 (Fisher denklemi).</p>
                <p>• Aylık katkının her yıl enflasyon kadar artırıldığı, yani reel olarak sabit kaldığı varsayılır.</p>
                <p>• Sosyal güvenlik (Bağ-Kur) emekli aylığı bu hesaba dahil edilmedi.</p>
              </Explain>
            </>
          )}
        </div>
      </div>
    </>
  );
}
