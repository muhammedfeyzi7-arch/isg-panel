import { BlurView } from "expo-blur";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, FileText, FlaskConical, House, Plus, ScanText, UserRound } from "lucide-react-native";
import { useState, type ComponentType } from "react";
import { Platform, Text, View } from "react-native";
import { pickInvoiceImage } from "@/lib/picker";
import { font, navy, radius, shadow, space, useTheme } from "@/theme";
import { Notice, Sheet, T } from "./ui";
import { IconTile, PressableScale } from "./visuals";

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const TABS: Record<string, { label: string; icon: Icon }> = {
  index: { label: "Ana Sayfa", icon: House },
  islemler: { label: "İşlemler", icon: ArrowLeftRight },
  simulasyon: { label: "Simülasyon", icon: FlaskConical },
  belgeler: { label: "Belgeler", icon: FileText },
  profil: { label: "Profil", icon: UserRound },
};

/** Ortası "+" butonlu, bulanık zeminli yüzen sekme çubuğu */
export function FloatingTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const onHome = state.routes[state.index]?.name === "index";
  const p = onHome ? navy : theme;
  const [quickOpen, setQuickOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = state.routes.map((route, index) => {
    const meta = TABS[route.name] ?? { label: route.name, icon: House };
    const focused = index === state.index;
    const Icon = meta.icon;
    return (
      <PressableScale
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        testID={`tab-${route.name}`}
        haptic="select"
        scaleTo={0.9}
        onPress={() => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        }}
        style={{ alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6, minWidth: 52 }}
      >
        <View style={{ width: 44, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: focused ? (p.dark ? "rgba(91,140,255,0.22)" : p.primarySoft) : "transparent" }}>
          <Icon size={21} color={focused ? p.primary : p.subtle} strokeWidth={focused ? 2.4 : 2} />
        </View>
        <Text numberOfLines={1} style={{ fontSize: 10, fontFamily: focused ? font.bold : font.semibold, color: focused ? p.primary : p.subtle }} accessibilityElementsHidden importantForAccessibility="no">
          {meta.label}
        </Text>
      </PressableScale>
    );
  });

  // Ortaya hızlı işlem butonu
  const fab = (
    <PressableScale
      key="fab"
      testID="quick-add"
      accessibilityLabel="Hızlı işlem: gelir, gider, fatura veya senaryo ekle"
      haptic="medium"
      scaleTo={0.88}
      onPress={() => setQuickOpen(true)}
      style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.primary, alignItems: "center", justifyContent: "center", marginTop: -26, boxShadow: shadow.glow, borderWidth: 4, borderColor: p.bg }}
    >
      <Plus size={26} color="#FFFFFF" strokeWidth={2.6} />
    </PressableScale>
  );
  const withFab = [...items.slice(0, 2), fab, ...items.slice(2)];

  const go = (fn: () => void) => {
    setQuickOpen(false);
    setError(null);
    fn();
  };

  return (
    <>
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, paddingBottom: Math.max(insets.bottom, space.md) }}>
        <View style={{ borderRadius: 28, overflow: "visible", boxShadow: shadow.float }}>
          <View style={{ borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: p.dark ? "rgba(255,255,255,0.08)" : "rgba(13,18,32,0.06)" }}>
            <BlurView intensity={Platform.OS === "android" ? 0 : 60} tint={p.dark ? "dark" : "light"} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: p.dark ? "rgba(18,33,63,0.88)" : "rgba(255,255,255,0.9)" }} />
            <View accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 4, height: 66 }}>
              {withFab}
            </View>
          </View>
        </View>
      </View>

      <Sheet visible={quickOpen} onClose={() => setQuickOpen(false)} title="Hızlı işlem">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingTop: space.sm }}>
          {[
            { label: "Gelir ekle", sub: "Tahsilat, proje", icon: ArrowDownLeft, color: "green" as const, run: () => router.push({ pathname: "/islem", params: { kind: "income" } }) },
            { label: "Gider ekle", sub: "Fatura, abonelik", icon: ArrowUpRight, color: "rose" as const, run: () => router.push({ pathname: "/islem", params: { kind: "expense" } }) },
            {
              label: "Fatura tara",
              sub: "Fotoğraftan gider",
              icon: ScanText,
              color: "blue" as const,
              run: async () => {
                const r = await pickInvoiceImage("camera");
                if (!r) return;
                if ("error" in r) {
                  setError(r.error);
                  setQuickOpen(true);
                  return;
                }
                router.push({ pathname: "/belge", params: { uri: r.uri, name: r.name } });
              },
            },
            { label: "Senaryo", sub: "Ya şöyle olursa?", icon: FlaskConical, color: "violet" as const, run: () => router.push("/senaryo") },
          ].map((a) => (
            <PressableScale
              key={a.label}
              accessibilityLabel={a.label}
              onPress={() => go(a.run)}
              style={{ width: "47%", flexGrow: 1, padding: space.lg, gap: space.md, borderRadius: radius.xl, backgroundColor: theme.surface2 }}
            >
              <IconTile icon={a.icon} color={a.color} size={46} />
              <View>
                <T v="bodyStrong">{a.label}</T>
                <T v="caption" color="subtle">
                  {a.sub}
                </T>
              </View>
            </PressableScale>
          ))}
        </View>
        {error ? (
          <View style={{ marginTop: space.md }}>
            <Notice tone="negative">{error}</Notice>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

