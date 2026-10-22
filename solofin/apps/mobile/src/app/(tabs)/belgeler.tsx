import { router } from "expo-router";
import { Camera, ImagePlus } from "lucide-react-native";
import { useState } from "react";
import { Image, Text, View } from "react-native";
import { formatDate } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";
import { Badge, Button, Card, EmptyState, Notice, Screen, SectionHeader, T } from "@/components/ui";
import { Appear, GradientCard, PressableScale } from "@/components/visuals";
import { pickInvoiceImage } from "@/lib/picker";
import { useStore } from "@/store/StoreProvider";
import { font, gradients, radius, space, type, useTheme } from "@/theme";

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
      <Appear index={0}>
        <T v="title" accessibilityRole="header">
          Belgeler
        </T>
      </Appear>

      <Appear index={1}>
        <GradientCard colors={gradients.navy}>
          {/* Vizör: tarama çerçevesi */}
          <View style={{ height: 150, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 120, height: 140, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.92)", padding: 12, gap: 6, transform: [{ rotate: "-4deg" }] }}>
              <View style={{ height: 8, width: "70%", backgroundColor: "#0D1220", borderRadius: 2 }} />
              <View style={{ height: 5, width: "45%", backgroundColor: "#8A93A5", borderRadius: 2 }} />
              <View style={{ height: 4, width: "90%", backgroundColor: "#E3E7EE", borderRadius: 2, marginTop: 8 }} />
              <View style={{ height: 4, width: "80%", backgroundColor: "#E3E7EE", borderRadius: 2 }} />
              <View style={{ height: 4, width: "85%", backgroundColor: "#E3E7EE", borderRadius: 2 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                <View style={{ height: 6, width: "35%", backgroundColor: "#0D1220", borderRadius: 2 }} />
                <View style={{ height: 6, width: "30%", backgroundColor: "#2A63F0", borderRadius: 2 }} />
              </View>
              <View style={{ flexDirection: "row", gap: 2, marginTop: 8 }}>
                {Array.from({ length: 18 }).map((_, i) => (
                  <View key={i} style={{ width: i % 3 ? 2 : 3, height: 14, backgroundColor: "#0D1220" }} />
                ))}
              </View>
            </View>
            {[
              { top: 4, left: 70, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
              { top: 4, right: 70, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
              { bottom: 4, left: 70, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
              { bottom: 4, right: 70, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
            ].map((c, i) => (
              <View key={i} style={{ position: "absolute", width: 26, height: 26, borderColor: "#5B8CFF", ...c }} />
            ))}
          </View>
          <Text style={[type.h2, { color: "#FFFFFF", marginTop: space.sm }]}>Fatura Tara</Text>
          <Text style={[type.small, { color: "rgba(255,255,255,0.75)", marginTop: 2 }]}>Fotoğrafla, alanları kontrol et, tek dokunuşla gider olarak ekle. Otomatik okuma (OCR) henüz yok.</Text>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
            <Button label="Fotoğraf çek" icon={Camera} onPress={() => start("camera")} style={{ flex: 1 }} />
            <PressableScale
              testID="pick-library"
              accessibilityLabel="Galeriden seç"
              onPress={() => start("library")}
              style={{ flex: 1, minHeight: 52, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.14)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <ImagePlus size={18} color="#FFF" />
              <Text style={{ color: "#FFF", fontFamily: font.bold, fontSize: 15 }}>Galeri</Text>
            </PressableScale>
          </View>
        </GradientCard>
        {error ? (
          <View style={{ marginTop: space.md }}>
            <Notice tone="negative">{error}</Notice>
          </View>
        ) : null}
      </Appear>

      <SectionHeader title="Kayıtlı belgeler" subtitle={`${documents.length} belge`} />
      {documents.length === 0 ? (
        <Card>
          <EmptyState title="Henüz belge yok" description="Bir faturayı fotoğraflayarak başla. Görüntüler yalnızca bu cihazda saklanır." />
        </Card>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
          {documents.map((d, i) => {
            const linked = d.transactionId && transactions.some((t) => t.id === d.transactionId);
            return (
              <Appear key={d.id} index={i} style={{ width: "47%", flexGrow: 1 }}>
                <Card
                  onPress={() => router.push({ pathname: "/belge", params: { id: d.id } })}
                  accessibilityLabel={`${d.vendor || "Belge"}, ${formatMoney(d.amount)}, ${formatDate(d.date)}`}
                  style={{ padding: space.sm, gap: space.sm }}
                >
                  <Image source={{ uri: d.uri }} style={{ width: "100%", height: 140, borderRadius: radius.lg, backgroundColor: p.surface2 }} resizeMode="cover" accessibilityIgnoresInvertColors />
                  <View style={{ paddingHorizontal: 4, gap: 2, paddingBottom: 4 }}>
                    <T v="bodyStrong" numberOfLines={1}>
                      {d.vendor || "Adsız belge"}
                    </T>
                    <T v="caption" color="subtle" numberOfLines={1}>
                      {formatDate(d.date)}
                    </T>
                    <T v="bodyStrong" tnum style={{ fontWeight: "800" }}>
                      {formatMoney(d.amount)}
                    </T>
                    {linked ? <Badge label="Gider olarak eklendi" tone="positive" /> : <Badge label="Gidere bağlı değil" />}
                  </View>
                </Card>
              </Appear>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
