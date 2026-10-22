import { router } from "expo-router";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, Info, OctagonAlert } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { buildAlerts } from "@solofin/core/finance/alerts";
import { dailyBalance } from "@solofin/core/finance/cashflow";
import { addDays, addMonths, formatDate, monthLabel } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";
import { lastNMonths, monthlySeries, totals } from "@solofin/core/finance/summary";
import { BarChart, LineChart } from "@/components/charts";
import { Badge, Bullet, Card, Disclosure, ListItem, Row, Screen, SectionHeader, T } from "@/components/ui";
import { categoryIcon } from "@/lib/icons";
import { signedTx } from "@/lib/format";
import { useStore } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { navy, radius, space } from "@/theme";

const p = navy;

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
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }} accessible accessibilityLabel={`geçen aya göre yüzde ${Math.abs(Math.round(ratio * 100))} ${up ? "artış" : "azalış"}`}>
      <Icon size={13} color={good ? p.positive : p.negative} />
      <T v="caption" palette={p} style={{ color: good ? p.positive : p.negative }}>
        %{Math.abs(Math.round(ratio * 100))}
      </T>
    </View>
  );
}

function Kpi({ label, value, foot, accent }: { label: string; value: string; foot?: React.ReactNode; accent?: string }) {
  return (
    <Card palette={p} style={{ flex: 1, padding: space.md, gap: 4 }}>
      <T v="caption" palette={p} style={{ color: accent ?? p.muted }} numberOfLines={1}>
        {label}
      </T>
      <T v="bodyStrong" palette={p} tnum numberOfLines={1} style={{ fontSize: 16, fontWeight: "700" }}>
        {value}
      </T>
      {foot}
    </Card>
  );
}

export default function HomeScreen() {
  const { transactions, settings, today, mode } = useStore();
  const { rules, projection, safe, events90, resilience } = useOverview();

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
  const payments = events30.filter((e) => e.amount < 0).slice(0, 5);

  return (
    <Screen palette={p} safeTop testID="screen-home">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <T v="body" color="muted" palette={p}>
            Merhaba
          </T>
          <T v="title" palette={p} accessibilityRole="header">
            Finansal merkez
          </T>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Badge label={String(settings.taxYear)} palette={p} />
          {mode === "demo" ? <Badge label="Demo verisi" tone="warning" palette={p} /> : null}
        </View>
      </View>

      {/* Birincil değer */}
      <Card palette={p} style={{ gap: space.sm, borderRadius: radius.xl }}>
        <T v="small" color="muted" palette={p}>
          Bugün güvenle kullanabileceğin tahmini tutar
        </T>
        <T v="hero" palette={p} tnum testID="safe-amount">
          {formatMoney(safe.safeAmount)}
        </T>
        {safe.rawAmount < 0 ? (
          <Badge label={`${formatMoney(-safe.rawAmount)} açık var`} tone="negative" palette={p} />
        ) : (
          <T v="small" color="muted" palette={p}>
            Vergi rezervi, 30 günlük ödemeler ve güvenlik payı ayrıldıktan sonra kalan. Beklenen tahsilatlar dahil değil.
          </T>
        )}
        <View style={{ marginTop: space.xs }}>
          <Row palette={p} label="Banka bakiyesi" value={formatMoney(safe.cashBalance)} />
          <Row palette={p} label="− Vergi rezervi" value={formatMoney(safe.taxReserve.total)} hint={`Gelir vergisi ${formatMoney(safe.taxReserve.incomeTax)} · KDV ${formatMoney(safe.taxReserve.vat)}`} />
          <Row palette={p} label="− 30 gün ödemeler" value={formatMoney(safe.upcomingObligations)} />
          <Row palette={p} label="− Güvenlik payı" value={formatMoney(safe.safetyBuffer)} />
        </View>
        <Disclosure palette={p}>
          <Bullet palette={p}>Vergi rezervi banka bakiyesinden ayrı bir kavramdır: bakiyendeki paranın bir kısmı gelecekte ödeyeceğin vergilere aittir.</Bullet>
          {safe.taxReserve.explanation.map((e) => (
            <Bullet key={e} palette={p}>
              {e}
            </Bullet>
          ))}
          <Bullet palette={p}>Banka bakiyesini Profil → Ayarlar&apos;dan güncelleyebilirsin.</Bullet>
        </Disclosure>
      </Card>

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Kpi label="Bu ay gelir" value={formatMoney(mtd.cur.income)} accent={p.series[0]} foot={<Delta current={mtd.cur.income} previous={mtd.prev.income} />} />
        <Kpi label="Bu ay gider" value={formatMoney(mtd.cur.expense)} foot={<Delta current={mtd.cur.expense} previous={mtd.prev.expense} invert />} />
        <Kpi
          label="Vergi rezervi"
          value={formatMoney(safe.taxReserve.total)}
          accent={p.warning}
          foot={
            <T v="caption" color="subtle" palette={p}>
              tahmini
            </T>
          }
        />
      </View>

      <Card palette={p} style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T v="small" color="muted" palette={p}>
            Yıl sonu net kazanç tahmini
          </T>
          {rules ? <Badge label="Demo tahmini" tone="warning" palette={p} /> : null}
        </View>
        <T v="value" palette={p} tnum>
          {formatMoney(projection.projectedNetEarnings)}
        </T>
        <T v="caption" color="subtle" palette={p}>
          Vergi ve prim sonrası · yıllık tahmini gelir vergisi {formatMoney(projection.projectedTax.incomeTax)}
        </T>
      </Card>

      <SectionHeader palette={p} title="Aylık özet" subtitle="Son 6 ay · KDV hariç" />
      <Card palette={p}>
        <BarChart
          palette={p}
          accessibilityLabel="Son 6 ayın gelir ve gider karşılaştırması"
          labels={months.map((m) => monthLabel(m.month))}
          series={[{ name: "Gelir" }, { name: "Gider" }]}
          values={[months.map((m) => m.income), months.map((m) => m.expense)]}
        />
      </Card>

      <SectionHeader
        palette={p}
        title="Önümüzdeki 30 gün"
        subtitle="Beklenen bakiye"
        action={
          <Pressable onPress={() => router.push("/nakit-akisi")} accessibilityRole="link" hitSlop={10}>
            <T v="small" palette={p} style={{ color: p.primary, fontWeight: "600" }}>
              Detay
            </T>
          </Pressable>
        }
      />
      <Card palette={p}>
        <LineChart
          palette={p}
          area
          accessibilityLabel="30 günlük beklenen banka bakiyesi"
          labels={balance30.map((b) => formatDate(b.date, { year: false }))}
          series={[{ name: "Beklenen bakiye" }]}
          values={[balance30.map((b) => b.balance)]}
          height={170}
        />
      </Card>

      <SectionHeader palette={p} title="Öncelikli uyarılar" action={<Badge label={String(alerts.length)} tone="primary" palette={p} />} />
      <Card palette={p} style={{ paddingVertical: space.xs }}>
        {alerts.length === 0 ? (
          <T v="small" color="muted" palette={p} style={{ paddingVertical: space.md }}>
            Şu an dikkat gerektiren bir durum yok.
          </T>
        ) : (
          alerts.map((a) => {
            const Icon = a.severity === 3 ? OctagonAlert : a.severity === 2 ? AlertTriangle : Info;
            const color = a.severity === 3 ? p.negative : a.severity === 2 ? p.warning : p.primary;
            return (
              <Pressable
                key={a.id}
                onPress={() => router.push(a.href?.startsWith("/vergi") ? "/simulasyon" : a.href?.startsWith("/nakit") ? "/nakit-akisi" : "/islemler")}
                accessibilityRole="button"
                accessibilityLabel={`${a.severity === 3 ? "Kritik" : a.severity === 2 ? "Uyarı" : "Bilgi"}: ${a.title}. ${a.detail}`}
                style={{ flexDirection: "row", gap: space.md, paddingVertical: space.md }}
              >
                <Icon size={20} color={color} />
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong" palette={p}>
                    {a.title}
                  </T>
                  <T v="small" color="muted" palette={p}>
                    {a.detail}
                  </T>
                </View>
                <ChevronRight size={18} color={p.subtle} />
              </Pressable>
            );
          })
        )}
      </Card>

      <SectionHeader palette={p} title="Yaklaşan ödemeler" subtitle="30 gün" />
      <Card palette={p} style={{ paddingVertical: space.xs }}>
        {payments.length === 0 ? (
          <T v="small" color="muted" palette={p} style={{ paddingVertical: space.md }}>
            Yaklaşan ödeme yok.
          </T>
        ) : (
          payments.map((e, i) => (
            <ListItem
              key={`${e.date}-${i}`}
              palette={p}
              title={e.label}
              subtitle={`${formatDate(e.date, { year: false })}${e.coveredByReserve ? " · vergi rezervinden" : ""}${e.source === "estimate" ? " · tahmini" : ""}`}
              right={formatMoney(-e.amount)}
            />
          ))
        )}
      </Card>

      <SectionHeader
        palette={p}
        title="Son işlemler"
        action={
          <Pressable onPress={() => router.push("/islemler")} accessibilityRole="link" hitSlop={10}>
            <T v="small" palette={p} style={{ color: p.primary, fontWeight: "600" }}>
              Tümü
            </T>
          </Pressable>
        }
      />
      <Card palette={p} style={{ paddingVertical: space.xs }}>
        {transactions.slice(0, 5).map((t) => (
          <ListItem
            key={t.id}
            palette={p}
            icon={categoryIcon(t.category)}
            iconTone={t.kind === "income" ? "positive" : "neutral"}
            title={t.description || t.category}
            subtitle={`${t.counterparty || t.category} · ${formatDate(t.date, { year: false })}`}
            right={signedTx(t)}
            onPress={() => router.push({ pathname: "/islem", params: { id: t.id } })}
          />
        ))}
      </Card>
      {mode === "demo" ? (
        <T v="caption" color="subtle" palette={p} style={{ textAlign: "center" }}>
          Veriler kurgusal demo verisidir; gerçek bir kişiye ait değildir.
        </T>
      ) : null}
    </Screen>
  );
}
