import { router } from "expo-router";
import { View } from "react-native";
import { TX_STATUS_LABEL, type Transaction } from "@solofin/core/data/schema";
import { formatDate } from "@solofin/core/finance/dates";
import { signedTx } from "@/lib/format";
import { categoryIcon, categoryTile } from "@/lib/icons";
import { space, type Palette } from "@/theme";
import { Badge, T } from "./ui";
import { IconTile, PressableScale } from "./visuals";

/** Uygulama genelinde işlem satırı: renkli kategori karosu, başlık, tutar */
export function TxRow({ t, palette, showDate = true }: { t: Transaction; palette?: Palette; showDate?: boolean }) {
  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/islem", params: { id: t.id } })}
      accessibilityLabel={`${t.description || t.category}, ${signedTx(t)}, ${formatDate(t.date)}. Düzenlemek için dokun`}
      scaleTo={0.98}
      haptic={false}
      style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 10, minHeight: 60 }}
    >
      <IconTile icon={categoryIcon(t.category)} color={categoryTile(t.category)} size={46} dark={palette?.dark} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="bodyStrong" palette={palette} numberOfLines={1}>
          {t.description || t.category}
        </T>
        <T v="small" color="subtle" palette={palette} numberOfLines={1}>
          {t.counterparty || t.category}
          {showDate ? ` · ${formatDate(t.date, { year: false })}` : ""}
        </T>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <T v="bodyStrong" palette={palette} tnum color={t.kind === "income" ? "positive" : "text"} style={{ fontWeight: "800" }}>
          {signedTx(t)}
        </T>
        {t.status !== "paid" ? <Badge label={TX_STATUS_LABEL[t.status]} tone={t.status === "overdue" ? "negative" : "warning"} palette={palette} /> : null}
      </View>
    </PressableScale>
  );
}
