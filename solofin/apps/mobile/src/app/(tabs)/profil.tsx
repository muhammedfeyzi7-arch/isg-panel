import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarClock, ChevronRight, FileBarChart2, FileText, FlaskConical, PiggyBank, Receipt, Settings as SettingsIcon, ShieldCheck } from "lucide-react-native";
import type { ComponentType } from "react";
import { Text, View } from "react-native";
import { TAXPAYER_LABEL } from "@solofin/core/data/schema";
import { formatMoney } from "@solofin/core/finance/money";
import { Card, Notice, Screen, SectionHeader, Segmented, T } from "@/components/ui";
import { Appear, GradientCard, IconTile, PressableScale } from "@/components/visuals";
import { useStore, type DataMode } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { font, gradients, space, type, useTheme, type TileColor } from "@/theme";

export default function ProfileScreen() {
  const p = useTheme();
  const { mode, setMode, settings, transactions, documents, scenarios } = useStore();
  const { resilience } = useOverview();

  return (
    <Screen safeTop testID="screen-profile">
      <Appear index={0}>
        <GradientCard colors={gradients.hero}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <LinearGradient colors={gradients.violet} style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.35)" }}>
              <Text style={{ color: "#FFF", fontFamily: font.extrabold, fontSize: 22 }}>{mode === "demo" ? "DK" : "SF"}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[type.h2, { color: "#FFF" }]} accessibilityRole="header">
                {mode === "demo" ? "Demo kullanıcı" : "Hesabım"}
              </Text>
              <Text style={[type.small, { color: "rgba(255,255,255,0.8)" }]} numberOfLines={2}>
                {TAXPAYER_LABEL[settings.taxpayerType]} · {settings.taxYear}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
            {[
              { l: "Bakiye", v: formatMoney(settings.cashBalance) },
              { l: "Dayanma (gelirsiz)", v: resilience.rows.at(-1)?.months == null ? "süresiz" : `${resilience.rows.at(-1)!.months!.toLocaleString("tr-TR")} ay` },
            ].map((x) => (
              <View key={x.l} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, padding: 12 }}>
                <Text style={[type.caption, { color: "rgba(255,255,255,0.75)" }]}>{x.l}</Text>
                <Text style={[type.bodyStrong, { color: "#FFF", fontFamily: font.extrabold }]} numberOfLines={1}>
                  {x.v}
                </Text>
              </View>
            ))}
          </View>
        </GradientCard>
      </Appear>

      <Appear index={1} style={{ flexDirection: "row", gap: space.sm }}>
        {(
          [
            { l: "İşlem", v: transactions.length, icon: Receipt, c: "blue" },
            { l: "Belge", v: documents.length, icon: FileText, c: "teal" },
            { l: "Senaryo", v: scenarios.length, icon: FlaskConical, c: "violet" },
          ] as { l: string; v: number; icon: ComponentType<{ size?: number; color?: string }>; c: TileColor }[]
        ).map((x) => (
          <Card key={x.l} style={{ flex: 1, padding: space.md, gap: 8 }}>
            <IconTile icon={x.icon} color={x.c} size={36} />
            <T v="value" tnum>
              {String(x.v)}
            </T>
            <T v="caption" color="subtle">
              {x.l}
            </T>
          </Card>
        ))}
      </Appear>

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
      <View style={{ gap: space.sm }}>
        {(
          [
            { t: "Nakit Akışı", st: "90 gün, dayanma süresi, tekrarlayan kalemler", icon: CalendarClock, c: "blue", href: "/nakit-akisi" },
            { t: "Emeklilik", st: "Üç getiri varsayımı, nominal ve reel", icon: PiggyBank, c: "green", href: "/emeklilik" },
            { t: "Raporlar", st: "PDF ve CSV olarak paylaş", icon: FileBarChart2, c: "amber", href: "/raporlar" },
            { t: "Ayarlar", st: "Bakiye, tema, vergi profili, verilerim", icon: SettingsIcon, c: "slate", href: "/ayarlar" },
          ] as { t: string; st: string; icon: ComponentType<{ size?: number; color?: string }>; c: TileColor; href: "/nakit-akisi" | "/emeklilik" | "/raporlar" | "/ayarlar" }[]
        ).map((m, i) => (
          <Appear key={m.t} index={i + 2}>
            <PressableScale onPress={() => router.push(m.href)} accessibilityLabel={m.t} style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 20, backgroundColor: p.surface }}>
              <IconTile icon={m.icon} color={m.c} size={48} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">{m.t}</T>
                <T v="caption" color="subtle" numberOfLines={1}>
                  {m.st}
                </T>
              </View>
              <ChevronRight size={20} color={p.subtle} />
            </PressableScale>
          </Appear>
        ))}
      </View>

      <Notice tone="neutral" title="Yasal uyarı">
        SOLOFIN karar destek aracıdır; yatırım veya vergi tavsiyesi vermez. Vergi hesapları demo tahminidir. Kesin durum için mali müşavirine danış.
      </Notice>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <ShieldCheck size={14} color={p.subtle} />
        <T v="caption" color="subtle">
          Verilerin cihazında saklanır · SOLOFIN 0.2.0
        </T>
      </View>
    </Screen>
  );
}
