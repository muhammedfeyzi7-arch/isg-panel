import { router } from "expo-router";
import { Camera, ImagePlus, ScanText } from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { formatDate } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";
import { Badge, Button, Card, EmptyState, Notice, Screen, SectionHeader, T } from "@/components/ui";
import { pickInvoiceImage } from "@/lib/picker";
import { useStore } from "@/store/StoreProvider";
import { radius, space, useTheme } from "@/theme";

export default function DocumentsScreen() {
  const p = useTheme();
  const { documents, transactions } = useStore();
  const [error, setError] = useState<string | null>(null);

  async function start(source: "camera" | "library") {
    setError(null);
    const r = await pickInvoiceImage(source);
    if (!r) return;
    if ("error" in r) return setError(r.error);
    router.push({ pathname: "/belge", params: { uri: r.uri, name: r.name } });
  }

  return (
    <Screen safeTop testID="screen-docs">
      <T v="title" accessibilityRole="header">
        Belgeler
      </T>
      <T v="small" color="muted">
        Faturalarını fotoğrafla, alanları kontrol et ve gider olarak ekle.
      </T>

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: p.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <ScanText size={22} color={p.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Fatura Tara</T>
            <T v="caption" color="subtle">
              Otomatik alan okuma (OCR) henüz etkin değil — alanları sen doldurursun.
            </T>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button label="Fotoğraf çek" icon={Camera} onPress={() => start("camera")} style={{ flex: 1 }} />
          <Button label="Galeri" icon={ImagePlus} variant="secondary" onPress={() => start("library")} style={{ flex: 1 }} testID="pick-library" />
        </View>
        {error ? <Notice tone="negative">{error}</Notice> : null}
      </Card>

      <SectionHeader title="Kayıtlı belgeler" subtitle={`${documents.length} belge`} />
      {documents.length === 0 ? (
        <Card>
          <EmptyState title="Henüz belge yok" description="Bir faturayı fotoğraflayarak başla. Görüntüler yalnızca bu cihazda saklanır." />
        </Card>
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {documents.map((d, i) => {
            const linked = d.transactionId && transactions.some((t) => t.id === d.transactionId);
            return (
              <Pressable
                key={d.id}
                onPress={() => router.push({ pathname: "/belge", params: { id: d.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${d.vendor || "Belge"}, ${formatMoney(d.amount)}, ${formatDate(d.date)}`}
                style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: p.border }}
              >
                <Image source={{ uri: d.uri }} style={{ width: 48, height: 60, borderRadius: radius.sm, backgroundColor: p.surface2 }} accessibilityIgnoresInvertColors />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodyStrong" numberOfLines={1}>
                    {d.vendor || "Adsız belge"}
                  </T>
                  <T v="small" color="subtle" numberOfLines={1}>
                    {formatDate(d.date)} · {d.category || "Kategorisiz"}
                  </T>
                  {linked ? <Badge label="Gider olarak eklendi" tone="positive" /> : <Badge label="Gidere bağlı değil" />}
                </View>
                <T v="bodyStrong" tnum>
                  {formatMoney(d.amount)}
                </T>
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
