import { useMemo, useState } from "react";
import { View } from "react-native";
import { retirementInputSchema, type RetirementInput } from "@solofin/core/data/schema";
import { formatMoney, formatPercent, parseMoneyInput } from "@solofin/core/finance/money";
import { projectRetirement, RETURN_PROFILES } from "@solofin/core/finance/retirement";
import { LineChart } from "@/components/charts";
import { Badge, Bullet, Button, Card, Disclosure, Field, Notice, Row, Screen, SectionHeader, Segmented, T } from "@/components/ui";
import { useStore } from "@/store/StoreProvider";
import { space } from "@/theme";

type FormState = Record<keyof RetirementInput, string>;

const toForm = (r: RetirementInput): FormState => ({
  currentAge: String(r.currentAge),
  targetAge: String(r.targetAge),
  currentSavings: String(r.currentSavings / 100),
  monthlyContribution: String(r.monthlyContribution / 100),
  inflation: String(Math.round(r.inflation * 1000) / 10),
  targetMonthlyBudget: String(r.targetMonthlyBudget / 100),
  withdrawalRate: String(Math.round(r.withdrawalRate * 1000) / 10),
});

/** "1.250,5", "2.5", "25" gibi girişleri sayıya çevirir; geçersizse NaN */
const num = (s: string) => {
  const k = parseMoneyInput(s);
  return k === null ? Number.NaN : k / 100;
};

function fromForm(f: FormState) {
  return retirementInputSchema.safeParse({
    currentAge: num(f.currentAge),
    targetAge: num(f.targetAge),
    currentSavings: Math.round(num(f.currentSavings) * 100),
    monthlyContribution: Math.round(num(f.monthlyContribution) * 100),
    inflation: num(f.inflation) / 100,
    targetMonthlyBudget: Math.round(num(f.targetMonthlyBudget) * 100),
    withdrawalRate: num(f.withdrawalRate) / 100,
  });
}

const FIELDS: { key: keyof RetirementInput; label: string; hint?: string }[] = [
  { key: "currentAge", label: "Şu anki yaşın" },
  { key: "targetAge", label: "Hedef emeklilik yaşı" },
  { key: "currentSavings", label: "Mevcut birikim (₺)" },
  { key: "monthlyContribution", label: "Aylık katkı (₺, bugünün parasıyla)", hint: "Enflasyonla birlikte artırılacağı varsayılır" },
  { key: "inflation", label: "Tahmini yıllık enflasyon (%)" },
  { key: "targetMonthlyBudget", label: "Hedef aylık bütçe (₺, bugünün parasıyla)" },
  { key: "withdrawalRate", label: "Yıllık çekim oranı (%)", hint: "Birikimden her yıl çekilecek pay (ör. %4)" },
];

export default function RetirementScreen() {
  const { retirement, saveRetirement } = useStore();
  const [form, setForm] = useState<FormState>(() => toForm(retirement));
  const [profileId, setProfileId] = useState<(typeof RETURN_PROFILES)[number]["id"]>("moderate");
  const [saved, setSaved] = useState(false);
  const parsed = fromForm(form);
  const input = parsed.success && parsed.data.targetAge > parsed.data.currentAge ? parsed.data : null;
  const projections = useMemo(() => (input ? RETURN_PROFILES.map((pr) => projectRetirement(input, pr)) : []), [input]);
  const sel = projections.find((x) => x.profile.id === profileId);
  const error = parsed.success ? (input ? null : "Hedef yaş şu anki yaştan büyük olmalı") : "Lütfen tüm alanlara geçerli sayılar gir";

  return (
    <Screen testID="screen-retirement">
      <Notice tone="neutral">Getiriler varsayımsaldır ve garanti edilmez. Bu ekran yatırım tavsiyesi değildir; vergi, fon giderleri ve piyasa dalgalanması modellenmez.</Notice>

      {input && sel ? (
        <>
          <Segmented label="Getiri varsayımı" value={profileId} onChange={setProfileId} options={RETURN_PROFILES.map((r) => ({ value: r.id, label: r.id === "high" ? "Yüksek" : r.label }))} />
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T v="small" color="muted">
                {input.targetAge} yaşında, bugünün parasıyla
              </T>
              <Badge label={sel.gapReal === 0 ? "Hedefe ulaşıyor" : "Açık var"} tone={sel.gapReal === 0 ? "positive" : "warning"} />
            </View>
            <T v="value" tnum testID="retirement-real">
              {formatMoney(sel.realBalance)}
            </T>
            <T v="caption" color="subtle" tnum>
              Nominal karşılığı: {formatMoney(sel.nominalBalance)} · reel getiri {formatPercent(sel.profile.realReturn, 0)}, nominal ≈ {formatPercent(sel.nominalReturn)}
            </T>
            <View style={{ marginTop: space.sm }}>
              <Row label="Gereken birikim" value={formatMoney(sel.requiredReal)} />
              <Row label="Sürdürülebilir aylık gelir" value={formatMoney(sel.sustainableMonthlyReal)} />
              <Row label="Hedef için gereken aylık katkı" value={formatMoney(sel.requiredMonthly)} tone={sel.requiredMonthly > input.monthlyContribution ? "warning" : "positive"} />
              {sel.gapReal > 0 ? <Row label="Açık (bugünün parasıyla)" value={formatMoney(sel.gapReal)} tone="negative" /> : null}
            </View>
          </Card>

          <SectionHeader title="Birikim projeksiyonu" subtitle="Enflasyondan arındırılmış, üç varsayım" />
          <Card>
            <LineChart
              accessibilityLabel="Yaşa göre reel birikim, üç getiri profili"
              labels={projections[0].yearly.map((y) => `${y.age}`)}
              series={[{ name: "Temkinli" }, { name: "Orta" }, { name: "Yüksek" }]}
              values={projections.map((pr) => pr.yearly.map((y) => y.real))}
              zeroBased
              height={210}
            />
          </Card>
          <Disclosure title="Varsayımlar ve hesaplama">
            <Bullet>Gereken birikim = hedef aylık bütçe × 12 ÷ yıllık çekim oranı.</Bullet>
            <Bullet>Hesap reel değerlerle aylık bileşik yapılır; nominal = reel × (1 + enflasyon)^yıl.</Bullet>
            <Bullet>Nominal getiri = (1 + reel) × (1 + enflasyon) − 1 (Fisher denklemi).</Bullet>
            <Bullet>Bağ-Kur emekli aylığı bu hesaba dahil edilmedi.</Bullet>
          </Disclosure>
        </>
      ) : null}

      <SectionHeader title="Girdiler" />
      <Card style={{ gap: space.md }}>
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} value={form[f.key]} keyboardType="decimal-pad" onChangeText={(t) => setForm((s) => ({ ...s, [f.key]: t }))} />
        ))}
        {error ? (
          <T v="small" color="negative">
            {error}
          </T>
        ) : null}
        <Button
          label="Girdileri kaydet"
          disabled={!input}
          onPress={() => {
            if (!input) return;
            saveRetirement(input as RetirementInput);
            setSaved(true);
          }}
        />
        {saved ? (
          <T v="small" color="positive" style={{ textAlign: "center" }}>
            Kaydedildi
          </T>
        ) : null}
      </Card>
    </Screen>
  );
}
