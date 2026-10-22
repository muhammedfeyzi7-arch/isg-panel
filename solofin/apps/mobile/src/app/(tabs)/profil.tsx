import { router } from "expo-router";
import { CalendarClock, FileBarChart2, PiggyBank, Settings as SettingsIcon, ShieldCheck, UserRound } from "lucide-react-native";
import { View } from "react-native";
import { TAXPAYER_LABEL } from "@solofin/core/data/schema";
import { formatMoney } from "@solofin/core/finance/money";
import { Badge, Card, ListItem, Notice, Screen, SectionHeader, Segmented, T } from "@/components/ui";
import { useStore, type DataMode } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { radius, space, useTheme } from "@/theme";

export default function ProfileScreen() {
  const p = useTheme();
  const { mode, setMode, settings, transactions, documents, scenarios } = useStore();
  const { resilience } = useOverview();

  return (
    <Screen safeTop testID="screen-profile">
      <T v="title" accessibilityRole="header">
        Profil
      </T>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: p.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <UserRound size={28} color={p.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="bodyStrong">{mode === "demo" ? "Demo kullanıcı" : "Yerel kullanıcı"}</T>
          <T v="small" color="muted" numberOfLines={2}>
            {TAXPAYER_LABEL[settings.taxpayerType]} · {settings.taxYear}
          </T>
          <Badge label={mode === "demo" ? "Demo verisi" : "Veriler bu cihazda"} tone={mode === "demo" ? "warning" : "primary"} />
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: space.sm }}>
        {[
          { l: "İşlem", v: String(transactions.length) },
          { l: "Belge", v: String(documents.length) },
          { l: "Senaryo", v: String(scenarios.length) },
          { l: "Dayanma (gelirsiz)", v: resilience.rows.at(-1)?.months == null ? "süresiz" : `${resilience.rows.at(-1)!.months!.toLocaleString("tr-TR")} ay` },
        ].map((x) => (
          <Card key={x.l} style={{ flex: 1, padding: space.md, gap: 2 }}>
            <T v="bodyStrong" tnum numberOfLines={1}>
              {x.v}
            </T>
            <T v="caption" color="subtle" numberOfLines={2}>
              {x.l}
            </T>
          </Card>
        ))}
      </View>

      <SectionHeader title="Veri modu" subtitle="Demo ve kendi verin ayrı saklanır" />
      <Segmented
        label="Veri modu"
        value={mode}
        onChange={(m: DataMode) => setMode(m)}
        options={[
          { value: "demo", label: "Demo verisi" },
          { value: "local", label: "Kendi verim" },
        ]}
      />

      <SectionHeader title="Planlama ve raporlar" />
      <Card style={{ paddingVertical: space.xs }}>
        <ListItem icon={CalendarClock} iconTone="primary" title="Nakit Akışı" subtitle="90 gün, dayanma süresi, tekrarlayan kalemler" chevron onPress={() => router.push("/nakit-akisi")} />
        <ListItem icon={PiggyBank} iconTone="positive" title="Emeklilik" subtitle="Üç getiri varsayımı, nominal ve reel" chevron onPress={() => router.push("/emeklilik")} />
        <ListItem icon={FileBarChart2} iconTone="warning" title="Raporlar" subtitle="PDF ve CSV olarak paylaş" chevron onPress={() => router.push("/raporlar")} />
        <ListItem icon={SettingsIcon} title="Ayarlar" subtitle={`Bakiye ${formatMoney(settings.cashBalance)} · tema, vergi profili`} chevron onPress={() => router.push("/ayarlar")} />
      </Card>

      <Notice tone="neutral" title="Yasal uyarı">
        SOLOFIN karar destek aracıdır; yatırım veya vergi tavsiyesi vermez. Vergi hesapları demo tahminidir. Kesin durum için mali müşavirine danış.
      </Notice>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <ShieldCheck size={14} color={p.subtle} />
        <T v="caption" color="subtle">
          Verilerin cihazında saklanır · SOLOFIN 0.1.0
        </T>
      </View>
    </Screen>
  );
}
