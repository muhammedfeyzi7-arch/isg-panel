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
  bg: "#F3F5F9",
  surface: "#FFFFFF",
  surface2: "#EEF1F6",
  border: "#E3E7EE",
  text: "#0D1220",
  muted: "#5B6475",
  subtle: "#8A93A5",
  primary: "#2A63F0",
  primarySoft: "#EEF3FF",
  onPrimary: "#FFFFFF",
  positive: "#0B7D55",
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
  primary: "#5B8CFF",
  primarySoft: "#1A2B55",
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

/** Manrope aileleri. Android'de özel yazı tiplerinde fontWeight aileyi seçmez; kalınlık aile adıyla verilir. */
export const font = {
  regular: "Manrope_500Medium",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
} as const;

export function familyForWeight(w: string | number | undefined): string {
  const n = typeof w === "number" ? w : w === "bold" ? 700 : Number(w ?? 400);
  if (n >= 800) return font.extrabold;
  if (n >= 700) return font.bold;
  if (n >= 600) return font.semibold;
  return font.regular;
}

export const type = {
  display: { fontSize: 40, fontFamily: font.extrabold, letterSpacing: -1.2 },
  hero: { fontSize: 34, fontFamily: font.extrabold, letterSpacing: -1 },
  title: { fontSize: 28, fontFamily: font.extrabold, letterSpacing: -0.7 },
  h2: { fontSize: 18, fontFamily: font.bold, letterSpacing: -0.3 },
  body: { fontSize: 15, fontFamily: font.regular },
  bodyStrong: { fontSize: 15, fontFamily: font.bold },
  small: { fontSize: 13, fontFamily: font.regular },
  caption: { fontSize: 12, fontFamily: font.semibold },
  value: { fontSize: 22, fontFamily: font.extrabold, letterSpacing: -0.5 },
};

/** Kartlar için yumuşak gölge (RN 0.76+ boxShadow: iOS, Android ve web'de ortak) */
export const shadow = {
  card: "0px 6px 18px rgba(13, 18, 32, 0.06)",
  float: "0px 12px 32px rgba(13, 18, 32, 0.18)",
  glow: "0px 14px 30px rgba(47, 107, 255, 0.35)",
} as const;

/** Hero kartları için gradyanlar */
export const gradients = {
  hero: ["#2F6BFF", "#1D3FB0", "#0E1E5B"] as const,
  navy: ["#13285C", "#0B1730"] as const,
  positive: ["#12B981", "#0A7A5A"] as const,
  warm: ["#FF8A4C", "#E5484D"] as const,
  violet: ["#7C5CFF", "#4B2FD0"] as const,
};

/** Kategori / eylem karoları için yumuşak renk çiftleri (zemin, ikon) */
export const tiles = {
  blue: { light: ["#E8EFFF", "#2F6BFF"], dark: ["#1A2B55", "#7FA5FF"] },
  violet: { light: ["#F0EBFF", "#6D4CFF"], dark: ["#2A2252", "#B3A1FF"] },
  teal: { light: ["#E3F7F3", "#0E9F87"], dark: ["#12352F", "#4FD8BE"] },
  amber: { light: ["#FFF3DF", "#C77700"], dark: ["#3A2A10", "#FFC261"] },
  rose: { light: ["#FFE9EE", "#E0336C"], dark: ["#3D1825", "#FF8DB0"] },
  green: { light: ["#E6F7EA", "#1E9E4A"], dark: ["#14331F", "#6BDB8F"] },
  slate: { light: ["#EEF1F5", "#4B5568"], dark: ["#1E2A44", "#A3ADC2"] },
} as const;
export type TileColor = keyof typeof tiles;

/** Ayarlardaki tema tercihine (sistem/açık/koyu) göre palet */
export function useTheme(): Palette {
  const system = useColorScheme();
  const { settings } = useStore();
  const pref = settings.theme;
  const isDark = pref === "dark" || (pref === "system" && system === "dark");
  return isDark ? dark : light;
}
