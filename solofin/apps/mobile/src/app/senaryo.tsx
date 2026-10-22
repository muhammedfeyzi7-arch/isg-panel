import { router, Stack, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Lightbulb, Minus, Plus, RotateCcw, Save, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ScenarioLevers } from "@solofin/core/data/schema";
import { formatMoney, fromKurus, parseMoneyInput, type Kurus } from "@solofin/core/finance/money";
import { RETURN_PROFILES } from "@solofin/core/finance/retirement";
import { baselineForUser, compareScenario, NEUTRAL_LEVERS, SCENARIO_PRESETS, scenarioInsight } from "@solofin/core/finance/scenarios";
import { LineChart } from "@/components/charts";
import { AnimatedNumber, Appear, GradientCard, PressableScale as Tap } from "@/components/visuals";
import { Badge, Bullet, Button, Card, Field, Screen, SectionHeader, T, ToggleRow } from "@/components/ui";
import { useStore } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { font, gradients, radius, space, type, useTheme } from "@/theme";

function MoneyInput({ label, value, onChange, hint, testID }: { label: string; value: Kurus; onChange: (v: Kurus) => void; hint?: string; testID?: string }) {
  const [text, setText] = useState(value ? fromKurus(value).toLocaleString("tr-TR") : "");
  return (
    <Field
      label={label}
      hint={hint}
      value={text}
      testID={testID}
      placeholder="0"
      keyboardType="decimal-pad"
      onChangeText={(t) => {
        setText(t);
        const k = parseMoneyInput(t);
        onChange(k !== null && k > 0 ? k : 0);
      }}
    />
  );
}

function Stepper({ label, value, display, onChange, step, min, max }: { label: string; value: number; display: string; onChange: (v: number) => void; step: number; min: number; max: number }) {
  const p = useTheme();
  const btn = (dir: -1 | 1) => {
    const next = Math.round((value + dir * step) * 1000) / 1000;
    const disabled = dir < 0 ? value <= min : value >= max;
    const Icon = dir < 0 ? Minus : Plus;
    return (
      <Pressable
        onPress={() => !disabled && onChange(Math.min(max, Math.max(min, next)))}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${dir < 0 ? "azalt" : "artır"}`}
        accessibilityState={{ disabled }}
        style={{ width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1, backgroundColor: p.surface }}
      >
        <Icon size={18} color={p.text} />
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }} accessible={false}>
      <T v="bodyStrong" style={{ flex: 1 }}>
        {label}
      </T>
      {btn(-1)}
      <T v="bodyStrong" tnum style={{ minWidth: 64, textAlign: "center" }} accessibilityRole="text">
        {display}
      </T>
      {btn(1)}
    </View>
  );
}

const months = (v: number) => (Number.isFinite(v) ? `${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ay` : "süresiz");

export default function ScenarioScreen() {
  const p = useTheme();
  const params = useLocalSearchParams<{ preset?: string; id?: string }>();
  const store = useStore();
  const { settings, retirement, scenarios } = store;
  const { rules, projection, safe } = useOverview();

  const saved = params.id ? scenarios.find((s) => s.id === params.id) : undefined;
  const preset = SCENARIO_PRESETS.find((s) => s.id === params.preset) ?? (params.id ? undefined : SCENARIO_PRESETS[0]);
  const [levers, setLevers] = useState<ScenarioLevers>(saved?.levers ?? { ...NEUTRAL_LEVERS, ...(preset?.levers ?? {}) });
  const [name, setName] = useState(saved?.name ?? preset?.name ?? "Yeni senaryo");
  const [loadedId, setLoadedId] = useState(saved?.id);
  const [formKey, setFormKey] = useState(0);
  const [savedMsg, setSavedMsg] = useState(false);

  const baseline = useMemo(() => baselineForUser(projection, settings, safe.taxReserve.total, retirement, RETURN_PROFILES[1].realReturn), [projection, settings, safe.taxReserve.total, retirement]);
  const cmp = useMemo(() => compareScenario(baseline, levers, rules), [baseline, levers, rules]);
  const { baseline: b, scenario: s, diff } = cmp;
  const set = <K extends keyof ScenarioLevers>(k: K, v: ScenarioLevers[K]) => {
    setLevers((l) => ({ ...l, [k]: v }));
    setSavedMsg(false);
  };
  const applyPreset = (id: string) => {
    const pr = SCENARIO_PRESETS.find((x) => x.id === id)!;
    setLevers({ ...NEUTRAL_LEVERS, ...pr.levers });
    setName(pr.name);
    setLoadedId(undefined);
    setFormKey((k) => k + 1);
    setSavedMsg(false);
  };

  const rows: { label: string; b: string; s: string }[] = [
    { label: "Vergi matrahı", b: formatMoney(b.tax.taxableBase), s: formatMoney(s.tax.taxableBase) },
    { label: "Tahmini vergi", b: formatMoney(b.tax.incomeTax), s: formatMoney(s.tax.incomeTax) },
    { label: "Net kazanç", b: formatMoney(b.netEarnings), s: formatMoney(s.netEarnings) },
    { label: "Yıllık gelir", b: formatMoney(b.annualIncome), s: formatMoney(s.annualIncome) },
    { label: "Yıllık gider", b: formatMoney(b.annualExpense), s: formatMoney(s.annualExpense + levers.oneOffPurchase) },
    { label: "12. ay nakit", b: formatMoney(b.endCash), s: formatMoney(s.endCash) },
    { label: "En düşük nakit", b: formatMoney(b.minCash), s: formatMoney(s.minCash) },
    { label: "Gelirsiz dayanma", b: months(b.runwayMonths), s: months(s.runwayMonths) },
  ];
  const good = diff.netEarnings >= 0;

  return (
    <Screen testID="screen-scenario">
      <Stack.Screen options={{ title: "Senaryo Karşılaştırma" }} />

      <Appear index={0}>
        <GradientCard colors={good ? gradients.hero : gradients.warm}>
          <Text style={[type.caption, { color: "rgba(255,255,255,0.8)", letterSpacing: 0.6 }]}>12 AYLIK NET KAZANÇ</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.md, marginTop: space.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[type.caption, { color: "rgba(255,255,255,0.7)" }]}>Şimdi</Text>
              <Text style={[type.value, { color: "rgba(255,255,255,0.85)", fontSize: 18 }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(b.netEarnings)}
              </Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 22, fontFamily: font.bold, paddingBottom: 2 }}>→</Text>
            <View style={{ flex: 1.2 }}>
              <Text style={[type.caption, { color: "rgba(255,255,255,0.7)" }]}>Senaryo</Text>
              <AnimatedNumber value={s.netEarnings} format={(v) => formatMoney(v)} style={[type.hero, { color: "#FFFFFF", fontSize: 26 }]} />
            </View>
          </View>
          <View style={{ alignSelf: "flex-start", marginTop: space.md, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text testID="scenario-diff" style={{ color: "#FFF", fontFamily: font.extrabold, fontSize: 15, fontVariant: ["tabular-nums"] }}>
              {formatMoney(diff.netEarnings, "TRY", { signed: true })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: space.md, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.lg, padding: space.md }}>
            <Lightbulb size={18} color="#FFF" />
            <Text testID="scenario-insight" style={[type.small, { color: "#FFF", flex: 1 }]}>
              {scenarioInsight(levers, diff)}
            </Text>
          </View>
        </GradientCard>
      </Appear>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} accessibilityLabel="Hazır senaryolar">
        {SCENARIO_PRESETS.map((pr) => {
          const active = name === pr.name && !loadedId;
          return (
            <Tap
              key={pr.id}
              onPress={() => applyPreset(pr.id)}
              haptic="select"
              accessibilityLabel={pr.name}
              style={{ paddingHorizontal: space.lg, minHeight: 40, justifyContent: "center", borderRadius: radius.pill, backgroundColor: active ? p.primary : p.surface }}
            >
              <T v="small" color={active ? "onPrimary" : "text"} style={{ fontWeight: "700" }}>
                {pr.name}
              </T>
            </Tap>
          );
        })}
      </ScrollView>

      <Card style={{ gap: space.md }} key={formKey}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T v="h2">Varsayımlar</T>
          <Button
            label="Sıfırla"
            icon={RotateCcw}
            variant="ghost"
            small
            onPress={() => {
              setLevers(NEUTRAL_LEVERS);
              setFormKey((k) => k + 1);
            }}
          />
        </View>
        <MoneyInput label="Tek seferlik ekipman / yatırım (KDV hariç)" value={levers.oneOffPurchase} onChange={(v) => set("oneOffPurchase", v)} testID="lever-purchase" />
        {levers.oneOffPurchase > 0 ? (
          <ToggleRow label="Bu gideri vergi açısından kabul et" description="Kabul, belgeye ve işle ilişkiye bağlıdır" value={levers.oneOffPurchaseDeductible} onChange={(v) => set("oneOffPurchaseDeductible", v)} />
        ) : null}
        <Stepper label="Fiyat değişimi" value={levers.priceChange} display={`%${Math.round(levers.priceChange * 100)}`} step={0.05} min={-0.5} max={1} onChange={(v) => set("priceChange", v)} />
        <Stepper label="Gelir kaybı" value={levers.incomeDrop} display={`%${Math.round(levers.incomeDrop * 100)}`} step={0.1} min={0} max={1} onChange={(v) => set("incomeDrop", v)} />
        <Stepper label="Tahsilat gecikmesi" value={levers.collectionDelayDays} display={`${levers.collectionDelayDays} gün`} step={15} min={0} max={120} onChange={(v) => set("collectionDelayDays", v)} />
        <MoneyInput label="Yeni müşteriden aylık gelir" value={levers.newClientMonthly} onChange={(v) => set("newClientMonthly", v)} />
        <MoneyInput label="Aylık gider artışı" value={levers.monthlyExpenseIncrease} onChange={(v) => set("monthlyExpenseIncrease", v)} />
        <MoneyInput label="Emeklilik için ek aylık birikim" value={levers.extraMonthlySavings} onChange={(v) => set("extraMonthlySavings", v)} hint="Orta profil (%3 reel getiri) varsayımıyla" />
      </Card>

      <SectionHeader title="Yan yana karşılaştırma" subtitle="Önümüzdeki 12 ay" action={b.tax.isDemoEstimate ? <Badge label="Demo tahmini" tone="warning" /> : undefined} />
      <Card style={{ paddingVertical: space.sm }}>
        <View style={{ flexDirection: "row", paddingVertical: 6 }}>
          <View style={{ flex: 1.2 }} />
          <T v="caption" color="muted" style={{ flex: 1, textAlign: "right" }}>
            Mevcut
          </T>
          <T v="caption" color="muted" style={{ flex: 1, textAlign: "right" }}>
            Senaryo
          </T>
        </View>
        {rows.map((r) => (
          <View key={r.label} accessible accessibilityLabel={`${r.label}: mevcut ${r.b}, senaryo ${r.s}`} style={{ flexDirection: "row", paddingVertical: 9, borderTopWidth: 1, borderTopColor: p.border, alignItems: "center" }}>
            <T v="small" color="muted" style={{ flex: 1.2 }}>
              {r.label}
            </T>
            <T v="small" tnum style={{ flex: 1, textAlign: "right" }} numberOfLines={1}>
              {r.b}
            </T>
            <T v="small" tnum style={{ flex: 1, textAlign: "right", fontWeight: "700" }} numberOfLines={1}>
              {r.s}
            </T>
          </View>
        ))}
      </Card>

      <View style={{ flexDirection: "row", gap: space.sm }}>
        {[
          { l: "Vergi farkı", v: diff.tax, invert: true },
          { l: "12. ay nakit", v: diff.endCash },
          { l: "En düşük nakit", v: diff.minCash },
        ].map((x) => {
          const ok = x.invert ? x.v <= 0 : x.v >= 0;
          return (
            <Card key={x.l} style={{ flex: 1, padding: space.md, gap: 4 }}>
              <T v="caption" color="muted" numberOfLines={1}>
                {x.l}
              </T>
              <T v="bodyStrong" tnum color={x.v === 0 ? "text" : ok ? "positive" : "negative"} numberOfLines={1} style={{ fontWeight: "800" }}>
                {formatMoney(x.v, "TRY", { signed: true })}
              </T>
            </Card>
          );
        })}
      </View>

      <SectionHeader title="Nakit akışı etkisi" subtitle="Vergi rezervi düşülmüş nakit, ay sonu" />
      <Card>
        <LineChart
          accessibilityLabel="Mevcut durum ve senaryo için 12 aylık nakit bakiyesi"
          labels={b.monthlyCash.map((m) => `${m.month}. ay`)}
          series={[{ name: "Mevcut" }, { name: "Senaryo", dashed: true }]}
          values={[b.monthlyCash.map((m) => m.balance), s.monthlyCash.map((m) => m.balance)]}
          zeroLine
          maxXLabels={4}
        />
      </Card>

      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <CheckCircle2 size={20} color={p.positive} />
          <T v="bodyStrong">Sonuç ve varsayımlar</T>
        </View>
        {cmp.assumptions.map((a) => (
          <Bullet key={a}>{a}</Bullet>
        ))}
        <Bullet>
          Baz: aylık gelir {formatMoney(baseline.monthlyIncome)}, gider {formatMoney(baseline.monthlyExpense)}, Bağ-Kur {formatMoney(baseline.monthlySocialSecurity)}, kişisel {formatMoney(baseline.monthlyPersonalSpend)}.
        </Bullet>
        <T v="small" style={{ fontWeight: "600", marginTop: space.sm }}>
          Belirsizlikler
        </T>
        {cmp.uncertainties.map((u) => (
          <Bullet key={u}>{u}</Bullet>
        ))}
        <T v="caption" color="subtle" style={{ marginTop: space.sm }}>
          Bu hesaplama genel bilgilendirme amaçlıdır; yatırım veya vergi tavsiyesi değildir. Kesin durum için mali müşavirine danış.
        </T>
      </Card>

      <Card style={{ gap: space.md }}>
        <Field label="Senaryo adı" value={name} onChangeText={setName} maxLength={80} testID="scenario-name" />
        <Button
          label={loadedId ? "Senaryoyu güncelle" : "Senaryoyu kaydet"}
          icon={Save}
          testID="scenario-save"
          onPress={() => {
            const sc = store.saveScenario(name, levers, loadedId);
            setLoadedId(sc.id);
            setSavedMsg(true);
          }}
        />
        {savedMsg ? (
          <T v="small" color="positive" style={{ textAlign: "center" }} accessibilityRole="text">
            Kaydedildi
          </T>
        ) : null}
        {loadedId ? (
          <Button
            label="Senaryoyu sil"
            icon={Trash2}
            variant="danger"
            onPress={() => {
              store.deleteScenario(loadedId);
              router.back();
            }}
          />
        ) : null}
      </Card>
    </Screen>
  );
}
