import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/** Tarayıcıda dosya indirme (yalnızca web) */
function webDownload(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Metin dosyasını oluşturup sistem paylaşım sayfasını açar (Dosyalar'a kaydet, e-posta, WhatsApp…).
 * CSV için Excel uyumluluğu adına UTF-8 BOM eklenir.
 */
export async function shareTextFile(fileName: string, content: string, mime = "text/csv"): Promise<"shared" | "downloaded" | "unavailable"> {
  const body = mime === "text/csv" ? `﻿${content}` : content;
  if (Platform.OS === "web") {
    webDownload(fileName, body, mime);
    return "downloaded";
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(body);
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: fileName });
  return "shared";
}

/** HTML raporu PDF'e çevirip paylaşır. Web'de tarayıcının yazdır penceresi açılır. */
export async function sharePdf(html: string): Promise<"shared" | "printed" | "unavailable"> {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return "printed";
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
  return "shared";
}

/** Kullanıcının seçtiği CSV dosyasının içeriği. İptal edilirse null. */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel"], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if ((asset.size ?? 0) > 2_000_000) throw new Error("Dosya 2 MB sınırını aşıyor");
  if (Platform.OS === "web") {
    const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
    return { name: asset.name, text };
  }
  return { name: asset.name, text: await new File(asset.uri).text() };
}

/** Seçilen görüntüyü uygulamanın kalıcı belge dizinine kopyalar (önbellek silinse de kalır). */
export async function persistImage(sourceUri: string, fileName: string): Promise<string> {
  if (Platform.OS === "web") return sourceUri;
  const dir = new Directory(Paths.document, "belgeler");
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, fileName);
  if (dest.exists) dest.delete();
  await new File(sourceUri).copy(dest);
  return dest.uri;
}

export function deleteStoredFile(uri: string) {
  if (Platform.OS === "web" || !uri.startsWith("file:")) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* dosya zaten yok */
  }
}
