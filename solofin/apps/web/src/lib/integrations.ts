/**
 * Harici entegrasyonların durumu. Yalnızca NEXT_PUBLIC_ önekli (istemciye açık olması güvenli)
 * değişkenler burada okunur; gizli anahtarlar (service-role, AI API anahtarı) asla istemciye taşınmaz.
 */

export function authStatus() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return configured
    ? {
        configured,
        label: "Supabase yapılandırıldı",
        detail: "Ortam değişkenleri tanımlı. Supabase istemci adaptörü bu sürümde henüz bağlanmadı; veriler yerel depoda tutulmaya devam eder (bkz. docs/BUILD_STATUS.md).",
      }
    : {
        configured,
        label: "Yerel mod",
        detail: "Canlı backend yapılandırılmadı. Uygulama tek kullanıcılı yerel modda çalışır. Kurulum için .env.example dosyasına bakın.",
      };
}

export function aiStatus() {
  const configured = process.env.NEXT_PUBLIC_AI_ENABLED === "true";
  return configured
    ? { configured, label: "Etkin", detail: "Yapay zekâ yalnızca hesaplama motorunun çıktısını açıklar; oran veya tutar üretmez." }
    : { configured, label: "Kapalı", detail: "API anahtarı yapılandırılmadı. Tüm hesaplamalar deterministik motorla yapılır; uygulama yapay zekâ olmadan tam çalışır." };
}
