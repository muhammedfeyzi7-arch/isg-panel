import { Download, FileText, Share2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { exportTransactionsCsv, toCsv } from "@solofin/core/finance/csv";
import { endOfMonth, formatDate, monthLabel } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";
import { RETURN_PROFILES } from "@solofin/core/finance/retirement";
import { baselineForUser, compareScenario } from "@solofin/core/finance/scenarios";
import { categoryBreakdown, lastNMonths, totals } from "@solofin/core/finance/summary";
import { Badge, Button, Card, Notice, Row, Screen, SectionHeader, Segmented, T } from "@/components/ui";
import { reportCsvRows, reportHtml, type ReportData } from "@/lib/report";
import { sharePdf, shareTextFile } from "@/lib/share";
import { useStore } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { font, gradients, radius, space, type } from "@/theme";
import { GradientCard, PressableScale } from "@/components/visuals";

export default function ReportsScreen() {
  const { transactions, settings, today, mode, scenarios, retirement } = useStore();
  const { rules, projection, safe } = useOverview();
  const months = useMemo(() => lastNMonths(today, 12).reverse(), [today]);
  const [month, setMonth] = useState(months[0]);
  const [status, setStatus] = useState<{ tone: "positive" | "negative"; text: string } | null>(null);

  const data: ReportData = useMemo(() => {
    const from = `${month}-01`;
    const to = endOfMonth(from) > today ? today : endOfMonth(from);
    const t = totals(transactions, from, to);
    const baseline = baselineForUser(projection, settings, safe.taxReserve.total, retirement, RETURN_PROFILES[1].realReturn);
    return {
      month,
      from,
      to,
      today,
      sourceLabel: mode === "demo" ? "Demo verisi (kurgusal)" : "Kullanıcı verisi (bu cihazda)",
      ruleSetId: rules.id,
      totals: { ...t, count: transactions.filter((x) => x.date >= from && x.date <= to).length },
      incomeCats: categoryBreakdown(transactions, "income", from, to),
      expenseCats: categoryBreakdown(transactions, "expense", from, to),
      projection,
      taxReserve: safe.taxReserve.total,
      scenarios: scenarios.map((s) => ({ s, c: compareScenario(baseline, s.levers, rules) })),
    };
  }, [month, today, transactions, projection, settings, safe.taxReserve.total, retirement, mode, rules, scenarios]);

  async function run(kind: "pdf" | "csv" | "tx") {
    setStatus(null);
    try {
      if (kind === "pdf") await sharePdf(reportHtml(data));
      else if (kind === "csv") await shareTextFile(`solofin-rapor-${month}.csv`, toCsv(reportCsvRows(data)));
      else await shareTextFile(`solofin-islemler-${month}.csv`, exportTransactionsCsv(transactions.filter((x) => x.date >= data.from && x.date <= data.to)));
      setStatus({ tone: "positive", text: "Rapor hazırlandı" });
    } catch (e) {
      setStatus({ tone: "negative", text: e instanceof Error ? e.message : "Rapor oluşturulamadı" });
    }
  }

  const tax = projection.projectedTax;
  return (
    <Screen testID="screen-reports">
      <Segmented label="Rapor ayı" value={month} onChange={setMonth} scroll options={months.map((m) => ({ value: m, label: `${monthLabel(m)} ${m.slice(2, 4)}` }))} />
      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
        <Badge label={`Kaynak: ${data.sourceLabel}`} tone={mode === "demo" ? "warning" : "primary"} />
      </View>

      <GradientCard colors={gradients.navy}>
        <Text style={[type.caption, { color: "rgba(255,255,255,0.8)", letterSpacing: 0.6 }]}>{monthLabel(month, true).toLocaleUpperCase("tr")} {month.slice(0, 4)} RAPORU</Text>
        <Text style={[type.hero, { color: "#FFF", fontSize: 28, marginTop: 4 }]}>{formatMoney(data.totals.net, "TRY", { signed: true })}</Text>
        <Text style={[type.small, { color: "rgba(255,255,255,0.8)" }]}>Net (gelir − iş gideri) · {data.totals.count} işlem</Text>
        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
          <Button label="PDF paylaş" icon={Share2} onPress={() => run("pdf")} style={{ flex: 1 }} />
          <PressableScale accessibilityLabel="Özet CSV paylaş" onPress={() => run("csv")} style={{ flex: 1, minHeight: 52, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.14)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FileText size={18} color="#FFF" />
            <Text style={{ color: "#FFF", fontFamily: font.bold, fontSize: 15 }}>CSV</Text>
          </PressableScale>
        </View>
      </GradientCard>
      <Card style={{ gap: space.sm }}>
        <Button label="Bu ayın işlemlerini CSV paylaş" icon={Download} variant="secondary" small onPress={() => run("tx")} />
        {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}
      </Card>

      <SectionHeader title="1. Aylık özet" subtitle={`${formatDate(data.from)} – ${formatDate(data.to)}`} />
      <Card>
        <Row label="Gelir (KDV hariç)" value={formatMoney(data.totals.income)} />
        <Row label="İş gideri (KDV hariç)" value={formatMoney(data.totals.expense)} />
        <Row label="Kişisel harcama" value={formatMoney(data.totals.personal)} />
        <Row label="Net (gelir − iş gideri)" value={formatMoney(data.totals.net)} strong />
        <Row label="İşlem sayısı" value={String(data.totals.count)} />
      </Card>

      <SectionHeader title="2. Döküm" />
      <Card>
        <T v="small" color="muted" style={{ fontWeight: "600" }}>
          Gelir kategorileri
        </T>
        {data.incomeCats.length === 0 ? <T v="small" color="subtle">Kayıt yok</T> : data.incomeCats.map((c) => <Row key={c.category} label={c.category} value={formatMoney(c.amount)} />)}
        <T v="small" color="muted" style={{ fontWeight: "600", marginTop: space.md }}>
          Gider kategorileri
        </T>
        {data.expenseCats.length === 0 ? <T v="small" color="subtle">Kayıt yok</T> : data.expenseCats.map((c) => <Row key={c.category} label={c.category} value={formatMoney(c.amount)} />)}
      </Card>

      <SectionHeader title="3. Vergi özeti" subtitle={`${settings.taxYear} yıl sonu tahmini · demo`} />
      <Card>
        <Row label="Brüt gelir" value={formatMoney(projection.projectedBasis.grossIncome)} />
        <Row label="Vergi matrahı" value={formatMoney(tax.taxableBase)} />
        <Row label="Tahmini gelir vergisi" value={formatMoney(tax.incomeTax)} strong />
        <Row label="Tahmini kalan ödeme" value={formatMoney(tax.remainingPayable)} />
        <Row label="Güncel vergi rezervi" value={formatMoney(safe.taxReserve.total)} />
      </Card>

      <SectionHeader title="4. Senaryolar" />
      <Card>
        {data.scenarios.length === 0 ? (
          <T v="small" color="muted">
            Kayıtlı senaryo yok. Simülasyon sekmesinden kaydedebilirsin.
          </T>
        ) : (
          data.scenarios.map(({ s, c }) => <Row key={s.id} label={s.name} hint={`Vergi farkı ${formatMoney(c.diff.tax, "TRY", { signed: true })}`} value={formatMoney(c.diff.netEarnings, "TRY", { signed: true })} />)
        )}
      </Card>

      <SectionHeader title="5. Yıl sonu tahmini" subtitle="Vergi esasına göre (serbest meslekte yalnızca tahsil edilenler)" />
      <Card>
        {projection.months.map((x) => (
          <Row key={x.month} label={`${monthLabel(x.month, true)}${x.projected ? " (tahmin)" : ""}`} value={formatMoney(x.net)} hint={`Gelir ${formatMoney(x.income)} · gider ${formatMoney(x.expense)}`} />
        ))}
        <Row label="Tahmini net kazanç" value={formatMoney(projection.projectedNetEarnings)} strong tone="positive" />
      </Card>
    </Screen>
  );
}
