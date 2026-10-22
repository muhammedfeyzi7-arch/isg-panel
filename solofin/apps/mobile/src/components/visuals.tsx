import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useReducedMotion } from "@/lib/motion";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { radius, shadow, space, tiles, type, useTheme, type TileColor } from "@/theme";

// ---------------------------------------------------------------- Dokunsal geri bildirim
export function tap(kind: "light" | "medium" | "select" | "success" = "light") {
  if (Platform.OS === "web") return;
  if (kind === "select") Haptics.selectionAsync().catch(() => undefined);
  else if (kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  else Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

// ---------------------------------------------------------------- Basınca küçülen dokunma alanı
export function PressableScale({
  children,
  onPress,
  style,
  scaleTo = 0.97,
  haptic = "light",
  accessibilityLabel,
  accessibilityRole = "button",
  testID,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: "light" | "medium" | "select" | false;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "link" | "tab" | "radio";
  testID?: string;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Yerleşim (genişlik, esneme, kenar boşluğu) dış dokunma alanına; görünüm içteki animasyonlu kaba uygulanır
  const { outer, inner } = splitLayout(style);
  return (
    <Pressable
      style={outer}
      testID={testID}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        if (!reduce) scale.set(withSpring(scaleTo, { damping: 20, stiffness: 400 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 14, stiffness: 300 }));
      }}
      onPress={() => {
        if (haptic) tap(haptic);
        onPress?.();
      }}
    >
      <Animated.View style={[inner, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

const LAYOUT_KEYS = ["width", "minWidth", "maxWidth", "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf", "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical", "position", "top", "left", "right", "bottom"] as const;

function splitLayout(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = { ...flat };
  for (const k of LAYOUT_KEYS) {
    if (k in flat) {
      outer[k] = flat[k as keyof ViewStyle];
      delete inner[k];
    }
  }
  // Dış alan genişlik/esneme aldıysa içteki görünüm onu doldurur
  if ("flex" in outer || "flexGrow" in outer || "width" in outer) inner.flexGrow = 1;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

// ---------------------------------------------------------------- Sırayla beliren içerik
export function Appear({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce || !FadeInDown?.delay ? undefined : FadeInDown.delay(Math.min(index, 10) * 60).duration(420)} style={style}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------- 0 → 1 ilerleme (grafik büyüme animasyonları)
export function useProgress(key: string | number = 0, duration = 750): number {
  const reduce = useReducedMotion();
  const [state, setState] = useState<{ key: string | number; p: number }>({ key, p: 0 });
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setState({ key, p: 1 - Math.pow(1 - t, 3) }); // easeOutCubic
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, duration, reduce]);
  if (reduce) return 1;
  return state.key === key ? state.p : 0;
}

// ---------------------------------------------------------------- Sayarak değişen sayı
export function AnimatedNumber({ value, format, style, testID }: { value: number; format: (v: number) => string; style?: StyleProp<TextStyle>; testID?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = Date.now();
    const a = from.current;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / 900);
      const e = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * e));
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  // Ekran okuyucu ve testler her zaman nihai değeri okur
  return (
    <Text testID={testID} accessibilityLabel={format(value)} style={[{ fontVariant: ["tabular-nums"] }, style]} maxFontSizeMultiplier={1.3}>
      {format(reduce ? value : shown)}
    </Text>
  );
}

// ---------------------------------------------------------------- Gradyan kart
export function GradientCard({ colors, children, style, decor = true }: { colors: readonly [string, string, ...string[]]; children: ReactNode; style?: StyleProp<ViewStyle>; decor?: boolean }) {
  return (
    <View style={[{ borderRadius: radius.xl + 4, overflow: "hidden", boxShadow: shadow.glow }, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.xl }}>
        {decor ? (
          <>
            <View pointerEvents="none" style={{ position: "absolute", width: 220, height: 220, borderRadius: 110, right: -70, top: -90, backgroundColor: "rgba(255,255,255,0.09)" }} />
            <View pointerEvents="none" style={{ position: "absolute", width: 140, height: 140, borderRadius: 70, right: 40, bottom: -80, backgroundColor: "rgba(255,255,255,0.06)" }} />
          </>
        ) : null}
        {children}
      </LinearGradient>
    </View>
  );
}

// ---------------------------------------------------------------- Renkli ikon karosu
export function IconTile({
  icon: Icon,
  color = "blue",
  size = 44,
  iconSize,
  dark,
}: {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color?: TileColor;
  size?: number;
  iconSize?: number;
  /** Ekranın paleti temadan farklıysa (ör. her zaman koyu ana ekran) */
  dark?: boolean;
}) {
  const p = useTheme();
  const [bg, fg] = tiles[color][(dark ?? p.dark) ? "dark" : "light"];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Icon size={iconSize ?? Math.round(size * 0.48)} color={fg} strokeWidth={2.2} />
    </View>
  );
}

// ---------------------------------------------------------------- İlerleme halkası
export function ProgressRing({
  value,
  size = 84,
  stroke = 9,
  color,
  track,
  children,
  accessibilityLabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  accessibilityLabel: string;
}) {
  const p = useTheme();
  const progress = useProgress(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value)) * progress;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? p.surface2} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? p.primary} strokeWidth={stroke} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - v)} strokeLinecap="round" />
      </Svg>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- Donut grafik
export function Donut({
  parts,
  size = 140,
  stroke = 18,
  center,
  accessibilityLabel,
}: {
  parts: { value: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  center?: ReactNode;
  accessibilityLabel: string;
}) {
  const p = useTheme();
  const progress = useProgress(parts.map((x) => x.value).join(","));
  const total = parts.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = parts.length > 1 ? 3 : 0;
  const offsets = parts.map((_, i) => parts.slice(0, i).reduce((acc, x) => acc + (x.value / total) * c * progress, 0));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.surface2} strokeWidth={stroke} fill="none" />
        {parts.map((x, i) => {
          const len = Math.max(0, (x.value / total) * c * progress - gap);
          return <Circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={x.color} strokeWidth={stroke} fill="none" strokeDasharray={`${len} ${c}`} strokeDashoffset={-offsets[i]} />;
        })}
      </Svg>
      {center}
    </View>
  );
}

// ---------------------------------------------------------------- Mini çizgi grafik
export function Sparkline({ values, width = 120, height = 40, color = "#FFFFFF", fill = true }: { values: number[]; width?: number; height?: number; color?: string; fill?: boolean }) {
  const progress = useProgress(values.length);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = Math.max(2, Math.round(values.length * progress));
  const pts = values.slice(0, n).map((v, i) => [(i / (values.length - 1)) * width, height - 4 - ((v - min) / span) * (height - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <SvgGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      {fill ? <Path d={`${d} L${last[0]},${height} L0,${height} Z`} fill="url(#spark)" /> : null}
      <Path d={d} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
    </Svg>
  );
}

// ---------------------------------------------------------------- Yatay çubuk (oran)
export function MeterBar({ value, color, track, height = 8 }: { value: number; color: string; track?: string; height?: number }) {
  const p = useTheme();
  const progress = useProgress(value);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? p.surface2, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * progress * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

// ---------------------------------------------------------------- İskelet yükleyici
export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const p = useTheme();
  return <View style={[{ height, width, borderRadius: radius.md, backgroundColor: p.surface2 }, style]} />;
}

// ---------------------------------------------------------------- Bölüm başlığı (büyük)
export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const p = useTheme();
  return <Text style={[type.caption, { color: color ?? p.subtle, letterSpacing: 0.6, textTransform: "uppercase" }]}>{children}</Text>;
}
