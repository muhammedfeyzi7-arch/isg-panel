import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY secret ayarlanmamış." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { mode, data } = await req.json();
    let systemPrompt = "";
    let userPrompt = "";

    // ── EĞİTİM KATILIM ANALİZİ (Vision) ──
    if (mode === "egitim-katilim-analiz") {
      const { imageBase64, mimeType } = data || {};
      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "Görsel verisi eksik." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const visionRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Bu görsel bir eğitim katılım formu veya imza listesidir. Görseli dikkatlice analiz et ve aşağıdaki bilgileri çıkar.

ÇIKARILACAK BİLGİLER:

1. META BİLGİLER (formun üst kısmındaki genel bilgiler):
   - egitimTarihi: Eğitim tarihi (varsa, GG.AA.YYYY formatında veya yazılı haliyle)
   - egitimYeri: Eğitimin yapıldığı yer/mekan (varsa)
   - egitimSuresi: Toplam eğitim süresi (varsa, "X saat", "X dakika" formatında)
   - egitmen: Eğitimi veren kişinin adı soyadı (varsa)
   - egitmenGorev: Eğitmeni veren kişinin görevi/ünvanı (varsa)
   - projeAdi: Proje adı veya eğitim konusu/başlığı (varsa, örn: "THY-OCO PROJESİ ETAP-2", "Yangın Güvenliği Eğitimi" vb.)
   - firmaAdi: Belgedeki firma/kurum adı (varsa)

2. KATILIMCI İSİMLERİ: Tablodaki TÜM kişi isimlerini listele

YANIT FORMAT (sadece JSON, başka hiçbir şey yazma):
{
  "meta": {
    "egitimTarihi": "...",
    "egitimYeri": "...",
    "egitimSuresi": "...",
    "egitmen": "...",
    "egitmenGorev": "...",
    "projeAdi": "...",
    "firmaAdi": "..."
  },
  "isimler": ["İsim Soyisim", "İsim Soyisim", ...]
}

KURALLAR:
- Bulunamayan bilgileri null olarak bırak (boş string değil)
- İsimleri Ad Soyad formatında yaz
- Numara, imza, tarih gibi bilgileri isimler listesine ekleme
- Eğer hiç isim yoksa isimler dizisini boş bırak []
- SADECE JSON döndür`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!visionRes.ok) {
        const errText = await visionRes.text();
        console.error("Groq vision error:", visionRes.status, errText);
        return new Response(JSON.stringify({ error: `Görsel analiz hatası (${visionRes.status}): ${errText.substring(0, 200)}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const visionResult = await visionRes.json();
      const content = visionResult.choices?.[0]?.message?.content ?? "";

      if (!content || content.trim() === "") {
        return new Response(JSON.stringify({ success: true, isimler: [], meta: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // JSON parse dene
      try {
        // Bazen model markdown code block içinde döndürebilir
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        
        const isimler = (parsed.isimler ?? [])
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 2 && !/^\d+$/.test(line));

        // Meta bilgileri temizle: null olmayanları döndür
        const meta: Record<string, string> = {};
        const rawMeta = parsed.meta ?? {};
        for (const [key, val] of Object.entries(rawMeta)) {
          if (val && typeof val === "string" && val.trim() !== "" && val !== "null") {
            meta[key] = (val as string).trim();
          }
        }

        return new Response(JSON.stringify({ success: true, isimler, meta }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (_parseErr) {
        // JSON parse başarısız → eski yöntem: sadece isimleri satır satır oku
        console.warn("JSON parse failed, falling back to line parse:", content.substring(0, 300));
        const isimler = content
          .split("\n")
          .map((line: string) => line.replace(/^[-•*\d.)\s]+/, "").trim())
          .filter((line: string) => line.length > 2 && !/^\d+$/.test(line) && line !== "İSİM_YOK");

        return new Response(JSON.stringify({ success: true, isimler, meta: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (mode === "tutanak") {
      systemPrompt = `Sen deneyimli bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Görevin: kullanıcının verdiği kısa nottan profesyonel, resmi ve kapsamlı bir denetim tutanağı metni üretmek.

KURALLAR:
1. "aciklama" alanı: Kullanıcının kısa notunu TAMAMEN GENİŞLET. Sadece firma adını başa ekleyip geçiştirme. Tespit edilen durumu, neden tehlikeli/önemli olduğunu, hangi mevzuat veya standartla çeliştiğini (İSG yönetmeliği, iş güvenliği standartları vb.) açıkla. En az 3-5 cümle, 300-500 karakter olsun. Resmi denetim dili kullan.
2. "notlar" alanı: Kullanıcının notundan yola çıkarak YAPILMASI GEREKEN SOMUT AKSİYONLARI yaz. "Ne yapılmalı, kim sorumlu, ne zaman tamamlanmalı" formatında yaz. Aciliyet derecesini belirt. 150-250 karakter.
3. "baslik" alanı: Konuyu özetleyen kısa resmi başlık, max 80 karakter.
4. Türkçe yaz. Resmi ve profesyonel dil kullan.
5. SADECE JSON formatında yanıt ver, başka hiçbir şey yazma:
{"baslik":"...","aciklama":"...","notlar":"..."}`;

      userPrompt = `Firma Adı: ${data?.firmaAdi || "Belirtilmemiş"}
Denetim Tarihi: ${data?.tarih || new Date().toLocaleDateString("tr-TR")}
Kullanıcının Kısa Notu: ${data?.kisaAciklama || ""}

Bu kısa notu profesyonel bir denetim tutanağına dönüştür. Açıklamayı genişlet, notlar kısmına yapılması gerekenleri yaz.`;

    } else if (mode === "uygunsuzluk") {
      systemPrompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Uygunsuzluk açıklamasına göre alınması gereken önlemleri öneriyorsun. Türkçe yaz. Pratik ve uygulanabilir önlemler ver. SADECE JSON formatında yanıt ver:
{"onlem":"150-350 karakter düz metin önlemler"}`;
      userPrompt = `Başlık: ${data?.baslik || "Belirtilmemiş"}
Açıklama: ${data?.aciklama || ""}
Önem: ${data?.severity || "Orta"}
Firma: ${data?.firmaAdi || "Belirtilmemiş"}`;

    } else if (mode === "dashboard-ozet") {
      systemPrompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Sana verilen sistem durumu verilerini analiz edip kısa, net ve eyleme dönüştürülebilir öneriler sunuyorsun. Türkçe yaz. Samimi ama profesyonel ol. SADECE JSON formatında yanıt ver:
{
  "genel_yorum": "2-3 cümle genel durum değerlendirmesi. Sağlık skoru ve kritik durumları özetle.",
  "en_acil": "En acil yapılması gereken 1 şey, max 120 karakter",
  "oneriler": ["Öneri 1 max 100 karakter", "Öneri 2 max 100 karakter", "Öneri 3 max 100 karakter"],
  "risk_seviyesi": "Düşük veya Orta veya Yüksek veya Kritik"
}`;
      const { saglikSkoru, kritikSayisi, uyariSayisi, bilgiSayisi, sorunlar } = data || {};
      userPrompt = `Sistem Sağlık Skoru: ${saglikSkoru}/100
Kritik Sorun Sayısı: ${kritikSayisi}
Uyarı Sayısı: ${uyariSayisi}
Bilgi Sayısı: ${bilgiSayisi}
Aktif Sorunlar:
${(sorunlar || []).map((s: string) => `- ${s}`).join("\n")}

Bu verilere göre İSG yöneticisine kısa ve net bir analiz sun.`;

    } else {
      return new Response(JSON.stringify({ error: "Geçersiz mod" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq error:", res.status, errText);
      return new Response(JSON.stringify({ error: `Groq hatası (${res.status}): ${errText.substring(0, 200)}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: "Boş yanıt alındı" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(content);
    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
