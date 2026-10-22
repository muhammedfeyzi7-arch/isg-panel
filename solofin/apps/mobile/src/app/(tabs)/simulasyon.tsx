import { router } from "expo-router";
import { ChevronRight, CircleHelp, FlaskConical } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { TAXPAYER_LABEL } from "@solofin/core/data/schema";
import { formatDate, monthLabel } from "@solofin/core/finance/dates";
import { formatMoney, formatPercent, parseMoneyInput } from "@solofin/core/finance/money";
import { SCENARIO_PRESETS } from "@solofin/core/finance/scenarios";
import { taxInputFromBasis } from "@solofin/core/finance/summary";
import { deductionImpact } from "@solofin/core/finance/tax/engine";
import { allRuleMetas, type Verification } from "@solofin/core/finance/tax/rules";
import { taxView } from "@solofin/core/finance/taxView";
import { LineChart, ProportionBar } from "@/components/charts";
import { Badge, Bullet, Card, Disclosure, Divider, Field, ListItem, Notice, Row, Screen, SectionHeader, Segmented, Sheet, T, ToggleRow } from "@/components/ui";
import { useStore } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { radius, space, useTheme } from "@/theme";

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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T v="title" accessibilityRole="header">
          Vergi Simülatörü
        </T>
        <Pressable onPress={() => setHelp(true)} accessibilityRole="button" accessibilityLabel="Vergi simülatörü hakkında" hitSlop={10}>
          <CircleHelp size={24} color={p.muted} />
        </Pressable>
      </View>
      <T v="small" color="muted">
        {rules.label} · {TAXPAYER_LABEL[settings.taxpayerType]}
      </T>

      <Notice title="Demo tahmini — kesin vergi yükümlülüğü değildir">
        Kurallar resmî mevzuat metniyle birebir doğrulanmadı. Beyan ve ödeme öncesinde mali müşavirine danış.{ruleFallback ? ` ${settings.taxYear} için kural seti yok; ${rules.year} kuralları kullanıldı.` : ""}
      </Notice>

      <Segmented
        label="Dönem"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "projected", label: "Yıl sonu tahmini" },
          { value: "ytd", label: "Bugüne kadar" },
        ]}
      />

      <Card>
        <T v="h2" accessibilityRole="header">
          {period === "projected" ? "Mevcut senaryo" : "Gerçekleşen"}
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
        <ProportionBar parts={tax.slices.map((s) => ({ value: s.taxableInSlice, label: `%${Math.round(s.rate * 100)}` }))} />
        {tax.slices.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, opacity: s.taxableInSlice > 0 ? 1 : 0.5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.primary, opacity: 0.35 + i * 0.16 }} />
            <T v="small" style={{ width: 44, fontWeight: "600" }}>
              %{Math.round(s.rate * 100)}
            </T>
            <T v="caption" color="subtle" style={{ flex: 1 }} numberOfLines={1}>
              {s.to === null ? `${formatMoney(s.from)} üzeri` : `${formatMoney(s.to)}'ye kadar`}
            </T>
            <T v="small" tnum>
              {formatMoney(s.taxableInSlice)}
            </T>
            <T v="small" tnum style={{ width: 84, textAlign: "right", fontWeight: "600" }}>
              {formatMoney(s.taxInSlice)}
            </T>
          </View>
        ))}
        <T v="caption" color="subtle">
          Sütunlar: dilime düşen matrah · o dilimin vergisi
        </T>
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

      <SectionHeader title="Senaryolar" subtitle="Bir kararın vergi ve nakit etkisini karşılaştır" />
      <Card style={{ paddingVertical: space.xs }}>
        {SCENARIO_PRESETS.slice(0, 4).map((s) => (
          <ListItem key={s.id} icon={FlaskConical} iconTone="primary" title={s.name} subtitle={s.description} chevron onPress={() => router.push({ pathname: "/senaryo", params: { preset: s.id } })} />
        ))}
        {scenarios.map((s) => (
          <ListItem key={s.id} icon={FlaskConical} iconTone="positive" title={s.name} subtitle={`Kayıtlı · ${formatDate(s.createdAt.slice(0, 10))}`} chevron onPress={() => router.push({ pathname: "/senaryo", params: { id: s.id } })} />
        ))}
        <Pressable onPress={() => router.push("/senaryo")} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 48 }}>
          <T v="bodyStrong" color="primary">
            Yeni senaryo oluştur
          </T>
          <ChevronRight size={18} color={p.primary} />
        </Pressable>
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
