import { useState } from "react";
import { Platform, Pressable, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { formatCompact, formatMoney } from "@solofin/core/finance/money";
import { radius, space, useTheme, type Palette } from "@/theme";
import { T } from "./ui";

interface SeriesDef {
  name: string;
  color?: string;
  dashed?: boolean;
}

const PAD = { top: 10, right: 6, bottom: 22, left: 44 };
/** SVG metinleri web'de varsayılan olarak serif çizilir; sistem yazı tipini kullan */
const FONT = Platform.OS === "web" ? "-apple-system, Roboto, 'Segoe UI', sans-serif" : undefined;

function niceScale(min: number, max: number, ticks = 4) {
  const lo = Math.min(0, min);
  const hi = max <= lo ? lo + 1 : max;
  const raw = (hi - lo) / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const values: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) values.push(v);
  return { min: start, max: end, values };
}

function scaleFromData(all: number[], zeroBased: boolean) {
  const min = Math.min(...all);
  const max = Math.max(...all);
  if (zeroBased) return niceScale(min, max);
  const span = Math.max(1, max - min);
  const s = niceScale(min - span * 0.1, max + span * 0.1);
  return s;
}

function Legend({ series, palette }: { series: SeriesDef[]; palette: Palette }) {
  if (series.length < 2) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: space.lg, marginTop: space.sm, flexWrap: "wrap" }}>
      {series.map((s, i) => (
        <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 10, height: s.dashed ? 2 : 10, borderRadius: 5, backgroundColor: s.color ?? palette.series[i] }} />
          <T v="caption" color="muted" palette={palette}>
            {s.name}
          </T>
        </View>
      ))}
    </View>
  );
}

function Readout({ label, items, palette }: { label: string; items: { name: string; value: number; color: string }[]; palette: Palette }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md, minHeight: 22, marginBottom: 4 }}>
      <T v="caption" palette={palette} style={{ fontWeight: "700" }}>
        {label}
      </T>
      {items.map((it) => (
        <View key={it.name} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: it.color }} />
          <T v="caption" color="muted" palette={palette} tnum>
            {it.name}: {formatMoney(it.value)}
          </T>
        </View>
      ))}
    </View>
  );
}

/** Gruplanmış çubuk grafik. Dokunulan grup için değerler üstte gösterilir. */
export function BarChart({
  labels,
  series,
  values,
  height = 200,
  palette,
  accessibilityLabel,
}: {
  labels: string[];
  series: SeriesDef[];
  /** values[seriesIndex][labelIndex] (kuruş) */
  values: number[][];
  height?: number;
  palette?: Palette;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const p = palette ?? theme;
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const all = values.flat();
  const s = scaleFromData(all.length ? all : [0], true);
  const innerW = Math.max(0, w - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const groupW = labels.length ? innerW / labels.length : 0;
  const barW = Math.min(16, (groupW * 0.62) / Math.max(1, series.length));
  const y = (v: number) => PAD.top + innerH - ((v - s.min) / (s.max - s.min)) * innerH;
  const colors = series.map((se, i) => se.color ?? p.series[i]);

  const onPress = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX - PAD.left;
    const idx = Math.floor(x / groupW);
    if (idx >= 0 && idx < labels.length) setSel(idx === sel ? null : idx);
  };

  return (
    <View>
      <Readout
        palette={p}
        label={sel !== null ? labels[sel] : "Değer için bir çubuğa dokun"}
        items={sel !== null ? series.map((se, i) => ({ name: se.name, value: values[i][sel], color: colors[i] })) : []}
      />
      <Pressable onPress={onPress} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ height }}>
        {w > 0 && (
          <Svg width={w} height={height}>
            {s.values.map((v) => (
              <Line key={v} x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke={p.grid} strokeWidth={1} />
            ))}
            {s.values.map((v) => (
              <SvgText key={`l${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={10} fontFamily={FONT} fill={p.axis} textAnchor="end">
                {formatCompact(v)}
              </SvgText>
            ))}
            {labels.map((lab, gi) => {
              const gx = PAD.left + gi * groupW + (groupW - barW * series.length - 2 * (series.length - 1)) / 2;
              return [
                sel === gi ? <Rect key={`h${gi}`} x={PAD.left + gi * groupW + 2} y={PAD.top} width={groupW - 4} height={innerH} fill={p.grid} opacity={0.6} rx={6} /> : null,
                ...series.map((_, si) => {
                  const v = values[si][gi] ?? 0;
                  const top = y(Math.max(0, v));
                  const h = Math.max(0, y(0) - top);
                  const x = gx + si * (barW + 2);
                  const r = Math.min(4, h / 2, barW / 2);
                  // Üst köşeleri yuvarlatılmış, tabana oturan çubuk
                  const d = `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${top + h} Z`;
                  return <Path key={`b${gi}-${si}`} d={d} fill={colors[si]} />;
                }),
                <SvgText key={`x${gi}`} x={PAD.left + gi * groupW + groupW / 2} y={height - 6} fontSize={10} fontFamily={FONT} fill={p.axis} textAnchor="middle">
                  {lab}
                </SvgText>,
              ];
            })}
          </Svg>
        )}
      </Pressable>
      <Legend series={series} palette={p} />
    </View>
  );
}

/** Çizgi / alan grafiği. Dokunulan noktadaki değerler üstte gösterilir. */
export function LineChart({
  labels,
  series,
  values,
  height = 200,
  palette,
  area,
  zeroLine,
  zeroBased,
  accessibilityLabel,
  maxXLabels = 6,
}: {
  labels: string[];
  series: SeriesDef[];
  values: number[][];
  height?: number;
  palette?: Palette;
  area?: boolean;
  zeroLine?: boolean;
  zeroBased?: boolean;
  accessibilityLabel: string;
  maxXLabels?: number;
}) {
  const theme = useTheme();
  const p = palette ?? theme;
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const all = values.flat();
  const s = scaleFromData(all.length ? all : [0], !!zeroBased);
  const innerW = Math.max(0, w - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const n = labels.length;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - s.min) / (s.max - s.min)) * innerH;
  const colors = series.map((se, i) => se.color ?? p.series[i]);
  const every = Math.max(1, Math.ceil(n / maxXLabels));

  const onPress = (e: GestureResponderEvent) => {
    if (n === 0) return;
    const rel = (e.nativeEvent.locationX - PAD.left) / Math.max(1, innerW);
    setSel(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  return (
    <View>
      <Readout
        palette={p}
        label={sel !== null ? labels[sel] : "Değer için grafiğe dokun"}
        items={sel !== null ? series.map((se, i) => ({ name: se.name, value: values[i][sel], color: colors[i] })) : []}
      />
      <Pressable onPress={onPress} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ height }}>
        {w > 0 && n > 0 && (
          <Svg width={w} height={height}>
            <Defs>
              {series.map((_, i) => (
                <LinearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors[i]} stopOpacity={0.25} />
                  <Stop offset="1" stopColor={colors[i]} stopOpacity={0} />
                </LinearGradient>
              ))}
            </Defs>
            {s.values.map((v) => (
              <Line key={v} x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke={p.grid} strokeWidth={1} />
            ))}
            {s.values.map((v) => (
              <SvgText key={`l${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={10} fontFamily={FONT} fill={p.axis} textAnchor="end">
                {formatCompact(v)}
              </SvgText>
            ))}
            {zeroLine && s.min < 0 ? <Line x1={PAD.left} x2={w - PAD.right} y1={y(0)} y2={y(0)} stroke={p.axis} strokeDasharray="4 4" /> : null}
            {values.map((vals, si) => {
              const d = vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
              return [
                area ? <Path key={`a${si}`} d={`${d} L${x(vals.length - 1)},${y(Math.max(s.min, 0))} L${x(0)},${y(Math.max(s.min, 0))} Z`} fill={`url(#g${si})`} /> : null,
                <Path key={`p${si}`} d={d} stroke={colors[si]} strokeWidth={2} fill="none" strokeDasharray={series[si].dashed ? "5 4" : undefined} strokeLinejoin="round" />,
              ];
            })}
            {sel !== null ? <Line x1={x(sel)} x2={x(sel)} y1={PAD.top} y2={PAD.top + innerH} stroke={p.axis} strokeDasharray="3 3" /> : null}
            {sel !== null
              ? values.map((vals, si) => <Rect key={`d${si}`} x={x(sel) - 4} y={y(vals[sel]) - 4} width={8} height={8} rx={4} fill={colors[si]} stroke={p.surface} strokeWidth={2} />)
              : null}
            {labels.map((lab, i) =>
              i % every === 0 || i === n - 1 ? (
                <SvgText key={`x${i}`} x={x(i)} y={height - 6} fontSize={10} fontFamily={FONT} fill={p.axis} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                  {lab}
                </SvgText>
              ) : null,
            )}
          </Svg>
        )}
      </Pressable>
      <Legend series={series} palette={p} />
    </View>
  );
}

/** Yatay oransal çubuk (ör. vergi dilimi dağılımı). Sıralı veri → tek ton, açıktan koyuya. */
export function ProportionBar({ parts, palette }: { parts: { value: number; label: string }[]; palette?: Palette }) {
  const theme = useTheme();
  const p = palette ?? theme;
  const total = parts.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <View accessibilityRole="image" accessibilityLabel={parts.map((x) => `${x.label}: ${Math.round((x.value / total) * 100)}%`).join(", ")} style={{ flexDirection: "row", height: 14, borderRadius: radius.pill, overflow: "hidden", backgroundColor: p.surface2, gap: 2 }}>
      {parts.map((x, i) => (x.value > 0 ? <View key={i} style={{ flex: x.value / total, backgroundColor: p.primary, opacity: 0.35 + i * 0.16 }} /> : null))}
    </View>
  );
}
