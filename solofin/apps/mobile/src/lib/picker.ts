import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

/** Fatura görüntüsü seçer veya çeker. Web'de yalnızca kullanıcı dokunuşuyla çağrılmalıdır. */
export async function pickInvoiceImage(source: "camera" | "library"): Promise<{ uri: string; name: string } | { error: string } | null> {
  if (source === "camera" && Platform.OS !== "web") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { error: "Kamera izni verilmedi. Ayarlar'dan izin verebilir veya galeriden seçebilirsin." };
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, allowsEditing: false };
  const res = source === "camera" && Platform.OS !== "web" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.fileName ?? `fatura-${Date.now()}.jpg` };
}
