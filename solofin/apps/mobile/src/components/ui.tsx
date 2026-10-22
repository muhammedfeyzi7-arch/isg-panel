import { Check, ChevronDown, ChevronRight, Info, X } from "lucide-react-native";
import { useState, type ComponentType, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { familyForWeight, font, radius, shadow, space, type, useTheme, type Palette } from "@/theme";
import { PressableScale, tap } from "./visuals";

type Tone = "neutral" | "primary" | "positive" | "warning" | "negative";

function toneColors(p: Palette, tone: Tone) {
  switch (tone) {
    case "primary":
      return { bg: p.primarySoft, fg: p.primary };
    case "positive":
      return { bg: p.positiveSoft, fg: p.positive };
    case "warning":
      return { bg: p.warningSoft, fg: p.warning };
    case "negative":
      return { bg: p.negativeSoft, fg: p.negative };
    default:
      return { bg: p.surface2, fg: p.muted };
  }
}

// ---------------------------------------------------------------- Metin
type Variant = keyof typeof type;
export function T({
  v = "body",
  color,
  style,
  children,
  palette,
  numberOfLines,
  tnum,
  ...rest
}: {
  v?: Variant;
  color?: "text" | "muted" | "subtle" | "primary" | "positive" | "warning" | "negative" | "onPrimary";
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  palette?: Palette;
  numberOfLines?: number;
  tnum?: boolean;
  accessibilityRole?: "header" | "text";
  testID?: string;
}) {
  const theme = useTheme();
  const p = palette ?? theme;
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const weightFamily = flat?.fontWeight ? { fontFamily: familyForWeight(flat.fontWeight), fontWeight: undefined } : null;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[type[v], { color: p[color ?? "text"] }, tnum && { fontVariant: ["tabular-nums"] }, style, weightFamily]}
      maxFontSizeMultiplier={1.4}
      {...rest}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------- Ekran kabı
export function Screen({
  children,
  palette,
  scroll = true,
  padded = true,
  contentStyle,
  safeTop,
  testID,
}: {
  children: ReactNode;
  palette?: Palette;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Başlık çubuğu olmayan (sekme) ekranlarında üst güvenli alan boşluğu */
  safeTop?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const p = palette ?? theme;
  const style = [{ padding: padded ? space.lg : 0, paddingTop: (padded ? space.lg : 0) + (safeTop ? insets.top : 0), paddingBottom: 130, gap: space.md }, contentStyle];
  if (!scroll) return <View testID={testID} style={[{ flex: 1, backgroundColor: p.bg }, style]}>{children}</View>;
  return (
    <ScrollView testID={testID} style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={style} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Kart
export function Card({ children, style, palette, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; palette?: Palette; onPress?: () => void; accessibilityLabel?: string }) {
  const theme = useTheme();
  const p = palette ?? theme;
  const base: StyleProp<ViewStyle> = [
    { backgroundColor: p.surface, borderRadius: radius.xl, borderWidth: p.dark ? StyleSheet.hairlineWidth : 0, borderColor: p.border, padding: space.lg, boxShadow: p.dark ? undefined : shadow.card },
    style,
  ];
  if (onPress)
    return (
      <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} style={base}>
        {children}
      </PressableScale>
    );
  return <View style={base}>{children}</View>;
}

export function SectionHeader({ title, action, palette, subtitle }: { title: string; action?: ReactNode; palette?: Palette; subtitle?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: space.sm }}>
      <View style={{ flexShrink: 1 }}>
        <T v="h2" palette={palette} accessibilityRole="header">
          {title}
        </T>
        {subtitle ? (
          <T v="small" color="muted" palette={palette}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------- Buton
export function Button({
  label,
  onPress,
  variant = "primary",
  icon: Icon,
  disabled,
  small,
  style,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  icon?: ComponentType<{ size?: number; color?: string }>;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const p = useTheme();
  const colors = {
    primary: { bg: p.primary, fg: p.onPrimary, border: p.primary },
    dark: { bg: p.text, fg: p.surface, border: p.text },
    secondary: { bg: p.surface, fg: p.text, border: p.border },
    ghost: { bg: "transparent", fg: p.primary, border: "transparent" },
    danger: { bg: p.negativeSoft, fg: p.negative, border: p.negativeSoft },
  }[variant];
  return (
    <PressableScale
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        {
          minHeight: small ? 38 : 52,
          paddingHorizontal: small ? space.md : space.lg,
          borderRadius: small ? radius.md : radius.lg,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: disabled ? 0.45 : 1,
          boxShadow: variant === "primary" && !disabled && !small ? shadow.glow : undefined,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={small ? 16 : 18} color={colors.fg} /> : null}
      <Text style={[small ? type.small : type.bodyStrong, { color: colors.fg, fontFamily: font.bold }]}>{label}</Text>
    </PressableScale>
  );
}

// ---------------------------------------------------------------- Rozet
export function Badge({ label, tone = "neutral", palette }: { label: string; tone?: Tone; palette?: Palette }) {
  const theme = useTheme();
  const c = toneColors(palette ?? theme, tone);
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={[type.caption, { color: c.fg, fontFamily: font.bold }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Segment seçici
export function Segmented<V extends string>({ value, options, onChange, label, palette, scroll }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string; palette?: Palette; scroll?: boolean }) {
  const theme = useTheme();
  const p = palette ?? theme;
  const items = options.map((o) => {
    const active = o.value === value;
    return (
      <Pressable
        key={o.value}
        onPress={() => {
          if (!active) tap("select");
          onChange(o.value);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: active, checked: active }}
        accessibilityLabel={o.label}
        style={{
          flexGrow: scroll ? 0 : 1,
          minHeight: 38,
          paddingHorizontal: space.md,
          borderRadius: radius.md - 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? (p.dark ? p.primary : p.surface) : "transparent",
          boxShadow: active && !p.dark ? shadow.card : undefined,
        }}
      >
        <Text style={[type.small, { color: active ? (p.dark ? p.onPrimary : p.text) : p.muted, fontFamily: active ? font.bold : font.semibold }]} numberOfLines={1}>
          {o.label}
        </Text>
      </Pressable>
    );
  });
  const box: ViewStyle = { flexDirection: "row", backgroundColor: p.surface2, borderRadius: radius.md, padding: 3, gap: 3 };
  if (scroll)
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={label} contentContainerStyle={box}>
        {items}
      </ScrollView>
    );
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={box}>
      {items}
    </View>
  );
}

// ---------------------------------------------------------------- Etiket – değer satırı
export function Row({ label, value, strong, tone, hint, palette, divider = true }: { label: string; value: string; strong?: boolean; tone?: "positive" | "negative" | "warning"; hint?: string; palette?: Palette; divider?: boolean }) {
  const theme = useTheme();
  const p = palette ?? theme;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, gap: space.md, borderTopWidth: divider && strong ? StyleSheet.hairlineWidth : 0, borderTopColor: p.border }}
    >
      <View style={{ flexShrink: 1 }}>
        <T v={strong ? "bodyStrong" : "body"} color={strong ? "text" : "muted"} palette={p}>
          {label}
        </T>
        {hint ? (
          <T v="caption" color="subtle" palette={p}>
            {hint}
          </T>
        ) : null}
      </View>
      <T v={strong ? "bodyStrong" : "body"} color={tone ?? "text"} palette={p} tnum style={{ fontWeight: strong ? "700" : "600" }}>
        {value}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- Liste öğesi
export function ListItem({
  title,
  subtitle,
  right,
  rightSub,
  icon: Icon,
  iconTone = "neutral",
  onPress,
  palette,
  testID,
  chevron,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: ReactNode;
  icon?: ComponentType<{ size?: number; color?: string }>;
  iconTone?: Tone;
  onPress?: () => void;
  palette?: Palette;
  testID?: string;
  chevron?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const p = palette ?? theme;
  const c = toneColors(p, iconTone);
  const content = (
    <>
      {Icon ? (
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon size={21} color={c.fg} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyStrong" palette={p} numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T v="small" color="subtle" palette={p} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right !== undefined || rightSub ? (
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          {right !== undefined ? (
            <T v="bodyStrong" palette={p} tnum>
              {right}
            </T>
          ) : null}
          {typeof rightSub === "string" ? (
            <T v="caption" color="subtle" palette={p}>
              {rightSub}
            </T>
          ) : (
            rightSub
          )}
        </View>
      ) : null}
      {chevron ? <ChevronRight size={18} color={p.subtle} /> : null}
    </>
  );
  const style: ViewStyle = { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, minHeight: 56 };
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}>
      {content}
    </Pressable>
  );
}

export function Divider({ palette }: { palette?: Palette }) {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: (palette ?? theme).border }} />;
}

// ---------------------------------------------------------------- Form alanları
export function Field({ label, error, hint, ...input }: { label: string; error?: string; hint?: string } & TextInputProps) {
  const p = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T v="small" style={{ fontWeight: "600" }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={p.subtle}
        style={[
          type.body,
          { minHeight: 50, borderWidth: 1, borderColor: error ? p.negative : p.border, borderRadius: radius.lg, paddingHorizontal: space.lg, color: p.text, backgroundColor: p.surface },
        ]}
        {...input}
      />
      {error ? (
        <T v="caption" color="negative" accessibilityRole="text">
          {error}
        </T>
      ) : hint ? (
        <T v="caption" color="subtle">
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function ToggleRow({ label, description, value, onChange, palette, testID }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; palette?: Palette; testID?: string }) {
  const theme = useTheme();
  const p = palette ?? theme;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" palette={p}>
          {label}
        </T>
        {description ? (
          <T v="caption" color="subtle" palette={p}>
            {description}
          </T>
        ) : null}
      </View>
      <RNSwitch
        testID={testID}
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: p.primary, false: p.border }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={p.border}
        // react-native-web, açık durumdaki başparmak rengini ayrı bir prop ile alır
        {...({ activeThumbColor: "#FFFFFF" } as object)}
      />
    </View>
  );
}

/** Seçim alanı: dokununca alttan açılan liste */
export function SelectField<V extends string | number>({ label, value, options, onChange, error, hint }: { label: string; value: V | ""; options: { value: V; label: string }[]; onChange: (v: V) => void; error?: string; hint?: string }) {
  const p = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      <T v="small" style={{ fontWeight: "600" }}>
        {label}
      </T>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? "seçilmedi"}`}
        style={{ minHeight: 48, borderWidth: 1, borderColor: error ? p.negative : p.border, borderRadius: radius.md, paddingHorizontal: space.md, backgroundColor: p.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <T color={current ? "text" : "subtle"} numberOfLines={1} style={{ flex: 1 }}>
          {current?.label ?? "Seç…"}
        </T>
        <ChevronDown size={18} color={p.subtle} />
      </Pressable>
      {error ? (
        <T v="caption" color="negative">
          {error}
        </T>
      ) : hint ? (
        <T v="caption" color="subtle">
          {hint}
        </T>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.map((o) => (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: o.value === value }}
            style={({ pressed }) => ({ minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.sm, borderRadius: radius.sm, backgroundColor: pressed ? p.surface2 : "transparent" })}
          >
            <T>{o.label}</T>
            {o.value === value ? <Check size={18} color={p.primary} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------- Alt sayfa (bottom sheet)
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat">
          <View style={{ flex: 1, backgroundColor: "rgba(4,8,18,0.5)" }} />
        </Pressable>
        <View style={{ backgroundColor: p.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "85%", paddingBottom: insets.bottom + space.md }} accessibilityViewIsModal>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, paddingBottom: space.sm }}>
            <T v="h2" accessibilityRole="header">
              {title}
            </T>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={12}>
              <X size={22} color={p.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: 2 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- Açılır açıklama
export function Disclosure({ title = "Nasıl hesaplandı?", children, palette }: { title?: string; children: ReactNode; palette?: Palette }) {
  const theme = useTheme();
  const p = palette ?? theme;
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 }}>
        <Info size={16} color={p.muted} />
        <T v="small" color="muted" palette={p} style={{ textDecorationLine: "underline" }}>
          {title}
        </T>
      </Pressable>
      {open ? <View style={{ marginTop: space.sm, gap: 6, backgroundColor: p.surface2, borderRadius: radius.md, padding: space.md }}>{children}</View> : null}
    </View>
  );
}

export function Bullet({ children, palette }: { children: ReactNode; palette?: Palette }) {
  return (
    <T v="small" color="muted" palette={palette}>
      • {children}
    </T>
  );
}

export function Notice({ tone = "warning", title, children, palette }: { tone?: Tone; title?: string; children: ReactNode; palette?: Palette }) {
  const theme = useTheme();
  const p = palette ?? theme;
  const c = toneColors(p, tone);
  return (
    <View accessibilityRole="summary" style={{ backgroundColor: c.bg, borderRadius: radius.lg, padding: space.md, gap: 2 }}>
      {title ? <Text style={[type.small, { color: c.fg, fontFamily: font.bold }]}>{title}</Text> : null}
      <Text style={[type.small, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: space.xxl, gap: space.sm }}>
      <T v="bodyStrong">{title}</T>
      {description ? (
        <T v="small" color="muted" style={{ textAlign: "center", maxWidth: 280 }}>
          {description}
        </T>
      ) : null}
      {action}
    </View>
  );
}
