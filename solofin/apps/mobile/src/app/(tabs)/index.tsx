import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowUpRight, Bell, ChevronRight, FlaskConical, Info, OctagonAlert, ScanText } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { buildAlerts } from "@solofin/core/finance/alerts";
import { dailyBalance } from "@solofin/core/finance/cashflow";
import { addDays, addMonths, formatDate, monthLabel } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";
import { categoryBreakdown, lastNMonths, monthlySeries, totals } from "@solofin/core/finance/summary";
import { BarChart } from "@/components/charts";
import { TxRow } from "@/components/TxRow";
import { Badge, Bullet, Card, Row, Screen, Sheet, T } from "@/components/ui";
import { AnimatedNumber, Appear, Donut, GradientCard, IconTile, PressableScale, ProgressRing, Sparkline } from "@/components/visuals";
import { pickInvoiceImage } from "@/lib/picker";
import { useStore } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { font, gradients, navy, radius, space, type } from "@/theme";

const p = navy;
const money = (v: number) => formatMoney(v);

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "İyi geceler" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
}

function Delta({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0)
    return (
      <T v="caption" color="subtle" palette={p}>
        önceki veri yok
      </T>
    );
  const ratio = (current - previous) / Math.abs(previous);
  const up = ratio >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const c = good ? p.positive : p.negative;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: good ? "rgba(52,199,140,0.14)" : "rgba(248,113,113,0.14)", alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}
      accessible
      accessibilityLabel={`geçen aya göre yüzde ${Math.abs(Math.round(ratio * 100))} ${up ? "artış" : "azalış"}`}
    >
      <Icon size={12} color={c} strokeWidth={2.6} />
      <Text style={[type.caption, { color: c, fontFamily: font.bold }]}>%{Math.abs(Math.round(ratio * 100))}</Text>
    </View>
  );
}

function Glass({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type.caption, { color: "rgba(255,255,255,0.72)" }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[type.small, { color: "#FFFFFF", fontFamily: font.bold, fontVariant: ["tabular-nums"] }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { transactions, settings, today, mode } = useStore();
  const { rules, projection, safe, events90, resilience } = useOverview();
  const [explain, setExplain] = useState(false);

  const mtd = useMemo(() => {
    const from = `${today.slice(0, 7)}-01`;
    return { cur: totals(transactions, from, today), prev: totals(transactions, addMonths(from, -1), addMonths(today, -1)) };
  }, [transactions, today]);
  const months = useMemo(() => monthlySeries(transactions, lastNMonths(today, 6)), [transactions, today]);
  const events30 = useMemo(() => events90.filter((e) => e.date <= addDays(today, 30)), [events90, today]);
  const balance30 = useMemo(() => dailyBalance(settings.cashBalance, events30, today, 30), [settings.cashBalance, events30, today]);
  const alerts = useMemo(
    () => buildAlerts({ txs: transactions, settings, rules, today, safe, projection, resilience, events: events90 }).slice(0, 3),
    [transactions, settings, rules, today, safe, projection, resilience, events90],
  );
  const payments = events30.filter((e) => e.amount < 0).slice(0, 6);

  const cats = useMemo(() => categoryBreakdown(transactions, "expense", `${today.slice(0, 7)}-01`, today), [transactions, today]);
  const donutParts = useMemo(() => {
    const top = cats.slice(0, 3).map((c, i) => ({ value: c.amount, color: p.series[i], label: c.category }));
    const rest = cats.slice(3).reduce((s, c) => s + c.amount, 0);
    return rest > 0 ? [...top, { value: rest, color: p.subtle, label: "Diğer" }] : top;
  }, [cats]);
  const totalExpense = cats.reduce((s, c) => s + c.amount, 0);
  const reserveShare = settings.cashBalance > 0 ? safe.taxReserve.total / settings.cashBalance : 0;

  async function scan() {
    const r = await pickInvoiceImage("camera");
    if (r && !("error" in r)) router.push({ pathname: "/belge", params: { uri: r.uri, name: r.name } });
    else if (r) router.push("/belgeler");
  }

  const quick = [
    { label: "Gelir", icon: ArrowDownLeft, color: "green" as const, run: () => router.push({ pathname: "/islem", params: { kind: "income" } }) },
    { label: "Gider", icon: ArrowUpRight, color: "rose" as const, run: () => router.push({ pathname: "/islem", params: { kind: "expense" } }) },
    { label: "Fatura", icon: ScanText, color: "blue" as const, run: scan },
    { label: "Senaryo", icon: FlaskConical, color: "violet" as const, run: () => router.push("/senaryo") },
  ];

  return (
    <Screen palette={p} safeTop testID="screen-home" contentStyle={{ gap: space.lg }}>
      {/* Üst bilgi */}
      <Appear index={0} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <LinearGradient colors={gradients.violet} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#FFF", fontFamily: font.extrabold, fontSize: 16 }}>{mode === "demo" ? "DK" : "SF"}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <T v="small" color="muted" palette={p}>
            {greeting()}
          </T>
          <T v="h2" palette={p} accessibilityRole="header">
            {formatDate(today)}
          </T>
        </View>
        {mode === "demo" ? <Badge label="Demo" tone="warning" palette={p} /> : null}
        <PressableScale onPress={() => router.push("/nakit-akisi")} accessibilityLabel={`Uyarılar: ${alerts.length}`} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.surface, alignItems: "center", justifyContent: "center" }}>
          <Bell size={20} color={p.text} />
          {alerts.length ? <View style={{ position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: p.negative, borderWidth: 2, borderColor: p.surface }} /> : null}
        </PressableScale>
      </Appear>

      {/* Hero */}
      <Appear index={1}>
        <GradientCard colors={gradients.hero}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={[type.caption, { color: "rgba(255,255,255,0.8)", letterSpacing: 0.6 }]}>BUGÜN GÜVENLE KULLANABİLECEĞİN</Text>
          </View>
          <AnimatedNumber value={safe.safeAmount} format={money} testID="safe-amount" style={[type.display, { color: "#FFFFFF", marginTop: 6 }]} />
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 2 }}>
            <PressableScale onPress={() => setExplain(true)} accessibilityLabel="Nasıl hesaplandı?" haptic="select" style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6 }}>
              <Info size={14} color="rgba(255,255,255,0.85)" />
              <Text style={[type.small, { color: "rgba(255,255,255,0.85)", fontFamily: font.semibold }]}>Nasıl hesaplandı?</Text>
            </PressableScale>
            <Sparkline values={balance30.map((b) => b.balance)} width={120} height={42} />
          </View>
          {safe.rawAmount < 0 ? (
            <View style={{ marginTop: space.sm, backgroundColor: "rgba(229,72,77,0.25)", borderRadius: radius.md, padding: space.sm }}>
              <Text style={[type.small, { color: "#FFF", fontFamily: font.bold }]}>{money(-safe.rawAmount)} açık var</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            <Glass label="Bakiye" value={money(safe.cashBalance)} />
            <Glass label="Vergi rezervi" value={money(safe.taxReserve.total)} />
            <Glass label="30 gün" value={money(safe.upcomingObligations)} />
          </View>
        </GradientCard>
      </Appear>

      {/* Hızlı eylemler */}
      <Appear index={2} style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {quick.map((q) => (
          <PressableScale key={q.label} onPress={q.run} accessibilityLabel={`${q.label} ekle`} style={{ alignItems: "center", gap: 8, width: 76 }}>
            <View style={{ width: 60, height: 60, borderRadius: 22, backgroundColor: p.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: p.border }}>
              <IconTile icon={q.icon} color={q.color} size={40} dark />
            </View>
            <T v="caption" palette={p} color="muted">
              {q.label}
            </T>
          </PressableScale>
        ))}
      </Appear>

      {/* Bu ay — yatay kartlar */}
      <Appear index={3}>
        <T v="h2" palette={p} accessibilityRole="header">
          Bu ay
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingTop: space.md, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
          <Card palette={p} style={{ width: 168, gap: 6 }}>
            <IconTile icon={ArrowDownLeft} color="green" size={36} dark />
            <T v="caption" color="muted" palette={p}>
              Gelir
            </T>
            <AnimatedNumber value={mtd.cur.income} format={money} style={[type.value, { color: p.text, fontSize: 20 }]} />
            <Delta current={mtd.cur.income} previous={mtd.prev.income} />
          </Card>
          <Card palette={p} style={{ width: 168, gap: 6 }}>
            <IconTile icon={ArrowUpRight} color="rose" size={36} dark />
            <T v="caption" color="muted" palette={p}>
              İş gideri
            </T>
            <AnimatedNumber value={mtd.cur.expense} format={money} style={[type.value, { color: p.text, fontSize: 20 }]} />
            <Delta current={mtd.cur.expense} previous={mtd.prev.expense} invert />
          </Card>
          <Card palette={p} style={{ width: 168, alignItems: "center", gap: 8 }}>
            <ProgressRing value={reserveShare} size={78} stroke={9} color={p.warning} track={p.surface2} accessibilityLabel={`Bakiyenin yüzde ${Math.round(reserveShare * 100)}'i vergi rezervi`}>
              <Text style={{ color: p.text, fontFamily: font.extrabold, fontSize: 16 }}>%{Math.round(reserveShare * 100)}</Text>
            </ProgressRing>
            <T v="caption" color="muted" palette={p} style={{ textAlign: "center" }}>
              Bakiyenin vergiye ayrılan payı
            </T>
          </Card>
          <Card palette={p} style={{ width: 200, gap: 6 }}>
            <T v="caption" color="muted" palette={p}>
              Yıl sonu net kazanç
            </T>
            <AnimatedNumber value={projection.projectedNetEarnings} format={money} style={[type.value, { color: p.text, fontSize: 20 }]} />
            <Badge label="Demo tahmini" tone="warning" palette={p} />
            <T v="caption" color="subtle" palette={p}>
              Vergi {money(projection.projectedTax.incomeTax)}
            </T>
          </Card>
        </ScrollView>
      </Appear>

      {/* Gider dağılımı */}
      {donutParts.length ? (
        <Appear index={4}>
          <Card palette={p} style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <Donut
              parts={donutParts}
              size={128}
              stroke={16}
              accessibilityLabel={`Bu ayın giderleri: ${donutParts.map((d) => `${d.label} ${money(d.value)}`).join(", ")}`}
              center={
                <View style={{ alignItems: "center" }}>
                  <T v="caption" color="subtle" palette={p}>
                    Gider
                  </T>
                  <T v="bodyStrong" palette={p} tnum style={{ fontWeight: "800" }}>
                    {money(totalExpense)}
                  </T>
                </View>
              }
            />
            <View style={{ flex: 1, gap: 10 }}>
              <T v="bodyStrong" palette={p}>
                Nereye gidiyor?
              </T>
              {donutParts.map((d) => (
                <View key={d.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: d.color }} />
                  <T v="small" palette={p} color="muted" style={{ flex: 1 }} numberOfLines={1}>
                    {d.label}
                  </T>
                  <T v="small" palette={p} tnum style={{ fontWeight: "700" }}>
                    %{Math.round((d.value / (totalExpense || 1)) * 100)}
                  </T>
                </View>
              ))}
            </View>
          </Card>
        </Appear>
      ) : null}

      {/* Uyarılar — yatay */}
      {alerts.length ? (
        <Appear index={5}>
          <T v="h2" palette={p} accessibilityRole="header">
            Dikkat et
          </T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingTop: space.md, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
            {alerts.map((a) => {
              const Icon = a.severity === 3 ? OctagonAlert : a.severity === 2 ? AlertTriangle : Info;
              const c = a.severity === 3 ? p.negative : a.severity === 2 ? p.warning : p.primary;
              return (
                <Card
                  key={a.id}
                  palette={p}
                  onPress={() => router.push(a.href?.startsWith("/vergi") ? "/simulasyon" : a.href?.startsWith("/nakit") ? "/nakit-akisi" : "/islemler")}
                  accessibilityLabel={`${a.severity === 3 ? "Kritik" : a.severity === 2 ? "Uyarı" : "Bilgi"}: ${a.title}. ${a.detail}`}
                  style={{ width: 260, gap: 8, borderLeftWidth: 4, borderLeftColor: c }}
                >
                  <Icon size={22} color={c} />
                  <T v="bodyStrong" palette={p}>
                    {a.title}
                  </T>
                  <T v="small" color="muted" palette={p} numberOfLines={3}>
                    {a.detail}
                  </T>
                </Card>
              );
            })}
          </ScrollView>
        </Appear>
      ) : null}

      {/* Yaklaşan ödemeler — tarih kartları */}
      <Appear index={6}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T v="h2" palette={p} accessibilityRole="header">
            Yaklaşan ödemeler
          </T>
          <PressableScale onPress={() => router.push("/nakit-akisi")} accessibilityRole="link" accessibilityLabel="Nakit akışı detayı" style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <T v="small" palette={p} style={{ color: p.primary, fontWeight: "700" }}>
              Tümü
            </T>
            <ChevronRight size={16} color={p.primary} />
          </PressableScale>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingTop: space.md, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
          {payments.length === 0 ? (
            <T v="small" color="muted" palette={p}>
              30 gün içinde ödeme yok.
            </T>
          ) : (
            payments.map((e, i) => (
              <Card key={`${e.date}-${i}`} palette={p} style={{ width: 150, gap: 6 }} accessibilityLabel={`${e.label}, ${formatDate(e.date)}, ${money(-e.amount)}`}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text style={{ color: p.text, fontFamily: font.extrabold, fontSize: 26 }}>{Number(e.date.slice(8, 10))}</Text>
                  <T v="caption" color="muted" palette={p}>
                    {monthLabel(e.date.slice(0, 7))}
                  </T>
                </View>
                <T v="small" palette={p} numberOfLines={1} style={{ fontWeight: "700" }}>
                  {e.label}
                </T>
                <T v="bodyStrong" palette={p} tnum style={{ fontWeight: "800" }}>
                  {money(-e.amount)}
                </T>
                {e.coveredByReserve ? <Badge label="Rezervden" tone="primary" palette={p} /> : null}
              </Card>
            ))
          )}
        </ScrollView>
      </Appear>

      {/* Aylık özet */}
      <Appear index={7}>
        <Card palette={p}>
          <T v="h2" palette={p}>
            Son 6 ay
          </T>
          <T v="caption" color="subtle" palette={p} style={{ marginBottom: space.sm }}>
            Gelir ve iş gideri · KDV hariç
          </T>
          <BarChart
            palette={p}
            accessibilityLabel="Son 6 ayın gelir ve gider karşılaştırması"
            labels={months.map((m) => monthLabel(m.month))}
            series={[{ name: "Gelir" }, { name: "Gider" }]}
            values={[months.map((m) => m.income), months.map((m) => m.expense)]}
            height={180}
          />
        </Card>
      </Appear>

      {/* Son işlemler */}
      <Appear index={8}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T v="h2" palette={p} accessibilityRole="header">
            Son işlemler
          </T>
          <PressableScale onPress={() => router.push("/islemler")} accessibilityRole="link" accessibilityLabel="Tüm işlemler" style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <T v="small" palette={p} style={{ color: p.primary, fontWeight: "700" }}>
              Tümü
            </T>
            <ChevronRight size={16} color={p.primary} />
          </PressableScale>
        </View>
        <Card palette={p} style={{ paddingVertical: space.xs, marginTop: space.md }}>
          {transactions.slice(0, 5).map((t) => (
            <TxRow key={t.id} t={t} palette={p} />
          ))}
        </Card>
      </Appear>

      {mode === "demo" ? (
        <T v="caption" color="subtle" palette={p} style={{ textAlign: "center" }}>
          Veriler kurgusal demo verisidir; gerçek bir kişiye ait değildir.
        </T>
      ) : null}

      <Sheet visible={explain} onClose={() => setExplain(false)} title="Nasıl hesaplandı?">
        <View style={{ gap: 4 }}>
          <Row label="Banka bakiyesi" value={money(safe.cashBalance)} />
          <Row label="− Vergi rezervi" value={money(safe.taxReserve.total)} hint={`Gelir vergisi ${money(safe.taxReserve.incomeTax)} · KDV ${money(safe.taxReserve.vat)}`} />
          <Row label="− 30 gün içindeki ödemeler" value={money(safe.upcomingObligations)} />
          <Row label="− Güvenlik payı" value={money(safe.safetyBuffer)} />
          <Row label="Güvenle kullanılabilir" value={money(safe.safeAmount)} strong tone="positive" />
          <View style={{ height: space.sm }} />
          <Bullet>Vergi rezervi banka bakiyesinden ayrı bir kavramdır: bakiyendeki paranın bir kısmı gelecekte ödeyeceğin vergilere aittir.</Bullet>
          {safe.taxReserve.explanation.map((e) => (
            <Bullet key={e}>{e}</Bullet>
          ))}
          <Bullet>Beklenen tahsilatlar ({money(safe.expectedInflows)}) ihtiyatlılık gereği dahil edilmedi.</Bullet>
          <Bullet>Banka bakiyesini Profil → Ayarlar&apos;dan güncelleyebilirsin.</Bullet>
        </View>
      </Sheet>
    </Screen>
  );
}
