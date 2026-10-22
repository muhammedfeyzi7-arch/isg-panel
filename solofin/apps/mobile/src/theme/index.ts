import { useColorScheme } from "react-native";
import { useStore } from "@/store/StoreProvider";

export interface Palette {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  positive: string;
  positiveSoft: string;
  warning: string;
  warningSoft: string;
  negative: string;
  negativeSoft: string;
  /** Doğrulanmış kategorik grafik paleti (dataviz validator: açık/koyu ayrı) */
  series: [string, string, string];
  grid: string;
  axis: string;
}

export const light: Palette = {
  dark: false,
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  surface2: "#F0F2F5",
  border: "#E4E7EC",
  text: "#0D1220",
  muted: "#5B6475",
  subtle: "#8A93A5",
  primary: "#2563EB",
  primarySoft: "#EAF1FF",
  onPrimary: "#FFFFFF",
  positive: "#0F8A5F",
  positiveSoft: "#E7F6EF",
  warning: "#B45309",
  warningSoft: "#FDF3E4",
  negative: "#D92D20",
  negativeSoft: "#FDECEA",
  series: ["#2a78d6", "#eb6834", "#1baf7a"],
  grid: "#E7E8EC",
  axis: "#6B7280",
};

export const dark: Palette = {
  dark: true,
  bg: "#08101F",
  surface: "#0F1A30",
  surface2: "#16233F",
  border: "#22314F",
  text: "#EEF1F6",
  muted: "#A3ADC2",
  subtle: "#7A859C",
  primary: "#4D87F5",
  primarySoft: "#18294A",
  onPrimary: "#FFFFFF",
  positive: "#34C78C",
  positiveSoft: "#0F2E25",
  warning: "#F5B041",
  warningSoft: "#33270F",
  negative: "#F87171",
  negativeSoft: "#3A1717",
  series: ["#3987e5", "#d95926", "#199e70"],
  grid: "#1E2A44",
  axis: "#8B95AB",
};

/** Ana ekran tasarımı her zaman koyu lacivert yüzey kullanır (tasarım referansı). */
export const navy: Palette = {
  ...dark,
  bg: "#0B1730",
  surface: "#12213F",
  surface2: "#1A2C52",
  border: "#22365F",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const type = {
  hero: { fontSize: 36, fontWeight: "700" as const, letterSpacing: -0.8 },
  title: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
  value: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4 },
};

/** Ayarlardaki tema tercihine (sistem/açık/koyu) göre palet */
export function useTheme(): Palette {
  const system = useColorScheme();
  const { settings } = useStore();
  const pref = settings.theme;
  const isDark = pref === "dark" || (pref === "system" && system === "dark");
  return isDark ? dark : light;
}
