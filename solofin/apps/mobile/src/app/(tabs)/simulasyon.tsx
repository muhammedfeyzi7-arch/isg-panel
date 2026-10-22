import { router } from "expo-router";
import { ArrowDownRight, ChevronRight, CircleHelp, Clock3, FlaskConical, Laptop, PiggyBank, TrendingUp, UserPlus, Wallet } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { TAXPAYER_LABEL } from "@solofin/core/data/schema";
import { formatDate, monthLabel } from "@solofin/core/finance/dates";
import { formatMoney, formatPercent, parseMoneyInput } from "@solofin/core/finance/money";
import { SCENARIO_PRESETS } from "@solofin/core/finance/scenarios";
import { taxInputFromBasis } from "@solofin/core/finance/summary";
import { deductionImpact } from "@solofin/core/finance/tax/engine";
import { allRuleMetas, type Verification } from "@solofin/core/finance/tax/rules";
import { taxView } from "@solofin/core/finance/taxView";
import { LineChart } from "@/components/charts";
import { AnimatedNumber, Appear, GradientCard, MeterBar, PressableScale, ProgressRing } from "@/components/visuals";
import { Badge, Bullet, Card, Disclosure, Divider, Field, ListItem, Notice, Row, Screen, SectionHeader, Segmented, Sheet, T, ToggleRow } from "@/components/ui";
import { useStore } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { font, gradients, radius, space, type, useTheme } from "@/theme";

const PRESET_STYLE: Record<string, { icon: typeof Laptop; colors: readonly [string, string, ...string[]] }> = {
  equipment: { icon: Laptop, colors: gradients.hero },
  raise: { icon: TrendingUp, colors: gradients.positive },
  drop: { icon: ArrowDownRight, colors: gradients.warm },
  client: { icon: UserPlus, colors: gradients.violet },
  delay: { icon: Clock3, colors: ["#F59E0B", "#B45309"] },
  cost: { icon: Wallet, colors: ["#475569", "#1E293B"] },
  retire: { icon: PiggyBank, colors: ["#0EA5E9", "#0369A1"] },
};

const VERIFICATION: Record<Verification, { label: string; tone: "positive" | "warning" | "negative" }> = {
  official: { label: "Resmî kaynak", tone: "positive" },
  secondary: { label: "İkincil kaynak", tone: "warning" },
  unverified: { label: "Doğrulanmadı", tone: "negative" },
};

export default function TaxSimulatorScreen() {
  const p = useTheme();
  const { transactions, settings, today, scenarios } = useStore();
  const { rules, ruleFallback } = useOverview();
  const [period, setPeriod] = useState<"projected" | "ytd">("projected");
  const [includeAssumed, setIncludeAssumed] = useState(true);
  const [extra, setExtra] = useState("50.000");
  const [help, setHelp] = useState(false);

  const view = useMemo(() => taxView(transactions, settings, rules, today, includeAssumed), [transactions, settings, rules, today, includeAssumed]);
  const { projection, vat, provisional, cumulative } = view;
  const basis = period === "projected" ? projection.projectedBasis : projection.ytd;
  const tax = period === "projected" ? projection.projectedTax : projection.ytdTax;
  const allExpenses = basis.confirmedDeductible + basis.assumedDeductible + basis.unknownExpenses + basis.nonDeductible;
  const net = basis.grossIncome - allExpenses - basis.socialSecurity - tax.incomeTax;
  const extraK = parseMoneyInput(extra) ?? 0;
  const impact = useMemo(() => deductionImpact(taxInputFromBasis(projection.projectedBasis, settings, { includeAssumed }), extraK, rules), [projection.projectedBasis, settings, includeAssumed, extraK, rules]);

  return (
    <Screen safeTop testID="screen-tax">
      <Appear index={0} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <T v="title" accessibilityRole="header">
            Vergi Simülatörü
          </T>
          <T v="small" color="muted" numberOfLines={2}>
            {rules.label} · {TAXPAYER_LABEL[settings.taxpayerType]}
          </T>
        </View>
        <PressableScale onPress={() => setHelp(true)} accessibilityLabel="Vergi simülatörü hakkında" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.surface, alignItems: "center", justifyContent: "center" }}>
          <CircleHelp size={22} color={p.muted} />
        </PressableScale>
      </Appear>

      <Appear index={1}>
        <GradientCard colors={gradients.violet}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <View style={{ flex: 1 }}>
              <Text style={[type.caption, { color: "rgba(255,255,255,0.8)", letterSpacing: 0.6 }]}>{period === "projected" ? "YIL SONU NET KAZANÇ" : "BUGÜNE KADAR NET"}</Text>
              <AnimatedNumber value={net} format={(v) => formatMoney(v)} style={[type.hero, { color: "#FFFFFF", marginTop: 4, fontSize: 30 }]} />
              <Text style={[type.small, { color: "rgba(255,255,255,0.85)", marginTop: 4 }]}>Tahmini gelir vergisi {formatMoney(tax.incomeTax)}</Text>
            </View>
            <ProgressRing value={tax.effectiveRate} size={86} stroke={9} color="#FFFFFF" track="rgba(255,255,255,0.22)" accessibilityLabel={`Efektif vergi oranı yüzde ${Math.round(tax.effectiveRate * 100)}`}>
              <Text style={{ color: "#FFF", fontFamily: font.extrabold, fontSize: 18 }}>%{Math.round(tax.effectiveRate * 100)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: font.semibold, fontSize: 10 }}>efektif</Text>
            </ProgressRing>
          </View>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            {[
              { l: "Gelir", v: formatMoney(basis.grossIncome) },
              { l: "Matrah", v: formatMoney(tax.taxableBase) },
              { l: "Marjinal", v: formatPercent(tax.marginalRate, 0) },
            ].map((x) => (
              <View key={x.l} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.lg, padding: 10 }}>
                <Text style={[type.caption, { color: "rgba(255,255,255,0.75)" }]}>{x.l}</Text>
                <Text style={[type.small, { color: "#FFF", fontFamily: font.bold }]} numberOfLines={1} adjustsFontSizeToFit>
                  {x.v}
                </Text>
              </View>
            ))}
          </View>
        </GradientCard>
      </Appear>

      <Segmented
        label="Dönem"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "projected", label: "Yıl sonu tahmini" },
          { value: "ytd", label: "Bugüne kadar" },
        ]}
      />

      <Appear index={2}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T v="h2">Ya şöyle olursa?</T>
          <PressableScale onPress={() => router.push("/senaryo")} accessibilityLabel="Yeni senaryo oluştur" style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <T v="small" color="primary" style={{ fontWeight: "700" }}>
              Yeni
            </T>
            <ChevronRight size={16} color={p.primary} />
          </PressableScale>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingTop: space.md, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
          {SCENARIO_PRESETS.map((sc) => {
            const st = PRESET_STYLE[sc.id] ?? PRESET_STYLE.equipment;
            const Icon = st.icon;
            return (
              <PressableScale key={sc.id} onPress={() => router.push({ pathname: "/senaryo", params: { preset: sc.id } })} accessibilityLabel={sc.name} style={{ width: 168 }}>
                <GradientCard colors={st.colors} style={{ boxShadow: undefined }}>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={20} color="#FFF" />
                  </View>
                  <Text style={[type.bodyStrong, { color: "#FFF", marginTop: space.md, minHeight: 40 }]} numberOfLines={2}>
                    {sc.name}
                  </Text>
                  <Text style={[type.caption, { color: "rgba(255,255,255,0.8)" }]} numberOfLines={1}>
                    {sc.description}
                  </Text>
                </GradientCard>
              </PressableScale>
            );
          })}
        </ScrollView>
        {scenarios.length ? (
          <Card style={{ paddingVertical: space.xs, marginTop: space.md }}>
            {scenarios.map((sc) => (
              <ListItem key={sc.id} icon={FlaskConical} iconTone="primary" title={sc.name} subtitle={`Kayıtlı · ${formatDate(sc.createdAt.slice(0, 10))}`} chevron onPress={() => router.push({ pathname: "/senaryo", params: { id: sc.id } })} />
            ))}
          </Card>
        ) : null}
      </Appear>

      <Notice title="Demo tahmini — kesin vergi yükümlülüğü değildir">
        Kurallar resmî mevzuat metniyle birebir doğrulanmadı. Beyan ve ödeme öncesinde mali müşavirine danış.{ruleFallback ? ` ${settings.taxYear} için kural seti yok; ${rules.year} kuralları kullanıldı.` : ""}
      </Notice>

      <Card>
        <T v="h2" accessibilityRole="header">
          {period === "projected" ? "Hesap dökümü" : "Gerçekleşen"}
        </T>
        <View style={{ marginTop: space.sm }}>
          <Row label="Tahmini yıllık gelir" value={formatMoney(basis.grossIncome)} />
          <Row label="İndirilebilir gider" value={formatMoney(tax.deductibleExpenses)} hint={`Onaylı ${formatMoney(basis.confirmedDeductible)} · varsayım ${includeAssumed ? formatMoney(basis.assumedDeductible) : "dahil değil"} · amortisman ${formatMoney(basis.depreciation)}`} />
          <Row label="Bağ-Kur indirimi" value={formatMoney(tax.socialSecurityDeduction)} />
          {tax.youngEntrepreneurExemption > 0 ? <Row label="Genç girişimci istisnası" value={formatMoney(tax.youngEntrepreneurExemption)} /> : null}
          <Row label="Vergi matrahı" value={formatMoney(tax.taxableBase)} />
          <Row label="Tahmini gelir vergisi" value={formatMoney(tax.incomeTax)} />
          <Row label="Stopaj + geçici vergi mahsubu" value={formatMoney(tax.withholdingCredits + tax.provisionalPaid)} />
          <Row label={tax.remainingPayable >= 0 ? "Tahmini kalan ödeme" : "Mahsup / iade edilebilir"} value={formatMoney(Math.abs(tax.remainingPayable))} tone={tax.remainingPayable >= 0 ? "warning" : "positive"} />
          <Row label="Tahmini net kazanç" value={formatMoney(net)} strong tone="positive" />
        </View>
        <View style={{ flexDirection: "row", gap: space.lg, marginTop: space.xs }}>
          <T v="caption" color="muted">
            Efektif oran {formatPercent(tax.effectiveRate)}
          </T>
          <T v="caption" color="muted">
            Marjinal oran {formatPercent(tax.marginalRate, 0)}
          </T>
        </View>
        <Divider />
        <ToggleRow label="Varsayımsal giderleri dahil et" description="'İndirilebilir (varsayım)' işaretli giderler" value={includeAssumed} onChange={setIncludeAssumed} />
        {tax.notes.map((n) => (
          <Bullet key={n}>{n}</Bullet>
        ))}
      </Card>

      <SectionHeader title="Vergi dilim dağılımı" subtitle="Her oran yalnızca o dilime düşen tutara uygulanır" />
      <Card style={{ gap: space.md }}>
        {tax.slices.map((sl, i) => (
          <View key={i} style={{ gap: 6, opacity: sl.taxableInSlice > 0 ? 1 : 0.45 }} accessible accessibilityLabel={`Yüzde ${Math.round(sl.rate * 100)} dilimi: matrah ${formatMoney(sl.taxableInSlice)}, vergi ${formatMoney(sl.taxInSlice)}`}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
              <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: p.text, width: 44 }}>%{Math.round(sl.rate * 100)}</Text>
              <T v="caption" color="subtle" style={{ flex: 1 }} numberOfLines={1}>
                {sl.to === null ? `${formatMoney(sl.from)} üzeri` : `${formatMoney(sl.to)}'ye kadar`}
              </T>
              <T v="small" tnum style={{ fontWeight: "800" }}>
                {formatMoney(sl.taxInSlice)}
              </T>
            </View>
            <MeterBar value={tax.taxableBase > 0 ? sl.taxableInSlice / tax.taxableBase : 0} color={p.primary} />
            <T v="caption" color="subtle" tnum>
              Bu dilimdeki matrah {formatMoney(sl.taxableInSlice)}
            </T>
          </View>
        ))}
      </Card>

      <SectionHeader title="Yıl sonu tahmini" subtitle="Kümülatif gelir ve yaklaşık kümülatif vergi" />
      <Card>
        <LineChart
          accessibilityLabel="Aylara göre kümülatif gelir ve tahmini vergi"
          labels={cumulative.map((c) => monthLabel(c.month))}
          series={[{ name: "Kümülatif gelir" }, { name: "Tahmini vergi" }]}
          values={[cumulative.map((c) => c.income), cumulative.map((c) => c.tax)]}
          zeroBased
        />
        <T v="caption" color="subtle" style={{ marginTop: space.sm }}>
          Gerçekleşen aylardan sonrası tahmindir. Vergi serisi Bağ-Kur ve amortisman hariç bir göstergedir.
        </T>
      </Card>

      <SectionHeader title="Bir gider kabul edilirse" subtitle="Daha fazla harcamaya teşvik değildir" />
      <Card style={{ gap: space.md }}>
        <Field label="Gider tutarı (KDV hariç)" value={extra} onChangeText={setExtra} keyboardType="decimal-pad" />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {[
            { l: "Vergi farkı", v: formatMoney(impact.taxDifference), c: p.positive },
            { l: "Net maliyet", v: formatMoney(impact.netCost), c: p.text },
            { l: "Net kazanç", v: `−${formatMoney(impact.netCost)}`, c: p.negative },
          ].map((x) => (
            <View key={x.l} style={{ flex: 1, backgroundColor: p.surface2, borderRadius: radius.md, padding: space.md, gap: 4 }}>
              <T v="caption" color="muted">
                {x.l}
              </T>
              <T v="bodyStrong" tnum style={{ color: x.c }} numberOfLines={1}>
                {x.v}
              </T>
            </View>
          ))}
        </View>
        <T v="small" color="muted">
          {extraK > 0 ? `Kabul edilirse tahmini vergin ${formatMoney(impact.taxDifference)} azalır; ancak harcamanın kendisi net kazancını ${formatMoney(impact.netCost)} düşürür.` : "Bir tutar gir."}
        </T>
      </Card>

      <SectionHeader title="KDV (ayrı hesap)" subtitle="KDV gelirin parçası değildir" />
      <Card>
        <Row label="Bu ay hesaplanan KDV" value={formatMoney(vat.month.outputVat)} />
        <Row label="Bu ay indirilecek KDV" value={formatMoney(vat.month.inputVat)} />
        <Row label={vat.month.net >= 0 ? "Bu ay ödenecek (tahmini)" : "Devreden"} value={formatMoney(Math.abs(vat.month.net))} strong />
        <Row label="Yıl başından beri hesaplanan" value={formatMoney(vat.ytd.outputVat)} />
        <Row label="Yıl başından beri indirilecek" value={formatMoney(vat.ytd.inputVat)} />
      </Card>

      <SectionHeader title="Geçici vergi dönemleri" />
      <Card style={{ paddingVertical: space.xs }}>
        {provisional.map((q) => (
          <ListItem key={q.label} title={q.label} subtitle={`Son ödeme ${formatDate(q.due)} · ${q.past ? "geçti" : q.complete ? "dönem kapandı" : "devam ediyor"}`} right={formatMoney(q.est)} />
        ))}
      </Card>

      <SectionHeader title="Kullanılan kurallar" subtitle={`Kural seti ${rules.id}`} />
      <Card>
        <Disclosure title="Kaynakları ve doğrulama durumunu göster">
          {allRuleMetas(rules).map(({ name, meta }) => (
            <View key={name} style={{ gap: 2, paddingVertical: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                <T v="small" style={{ fontWeight: "600", flex: 1 }}>
                  {name}
                </T>
                <Badge label={VERIFICATION[meta.verification].label} tone={VERIFICATION[meta.verification].tone} />
              </View>
              <T v="caption" color="muted">
                {meta.source}
              </T>
              <T v="caption" color="subtle">
                Yürürlük {formatDate(meta.effectiveFrom)} · Son kontrol {meta.lastVerifiedAt ? formatDate(meta.lastVerifiedAt) : "yok"}
              </T>
              {meta.note ? (
                <T v="caption" color="subtle">
                  {meta.note}
                </T>
              ) : null}
            </View>
          ))}
        </Disclosure>
      </Card>

      <Sheet visible={help} onClose={() => setHelp(false)} title="Nasıl hesaplanır?">
        <View style={{ gap: space.sm }}>
          {projection.assumptions.map((a) => (
            <Bullet key={a}>{a}</Bullet>
          ))}
          <Bullet>Artan oranlı tarifede her dilimin oranı yalnızca o dilime giren tutara uygulanır; tüm gelir son orandan vergilenmez.</Bullet>
          <Bullet>KDV, stopaj ve geçici vergi gelir vergisinden ayrı modellenir.</Bullet>
          <Bullet>Zarar mahsubu, damga vergisi ve özel indirimler modellenmedi.</Bullet>
        </View>
      </Sheet>
    </Screen>
  );
}
