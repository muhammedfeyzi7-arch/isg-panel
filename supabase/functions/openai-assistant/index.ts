import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Model seçimi: vision için ayrı model, diğerleri için hafif model
const FAST_MODEL = "llama-3.1-8b-instant";       // Hızlı, az token - genel kullanım
const SMART_MODEL = "llama-3.3-70b-versatile";    // Büyük model - sadece karmaşık işler
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // Vision

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
          model: VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Bu görsel bir eğitim katılım listesi veya imza listesidir. Görseldeki TÜM kişi isimlerini çıkar.\n\nKURALLAR:\n- Sadece kişi isimlerini listele (Ad Soyad formatında)\n- Numara, imza, tarih, unvan gibi bilgileri dahil etme\n- Her ismi ayrı satırda yaz\n- Eğer isim bulamazsan sadece "İSİM_YOK" yaz\n- Başka hiçbir açıklama ekleme, sadece isimler\n\nÖrnek çıktı:\nMehmet Yılmaz\nAhmet Demir\nAli Kaya`,
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
          max_tokens: 1000,
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

      if (!content || content.trim() === "İSİM_YOK" || content.trim() === "") {
        return new Response(JSON.stringify({ success: true, isimler: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isimler = content
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 1 && line !== "İSİM_YOK" && !line.startsWith("-") === false
          ? line.replace(/^[-•*\d.)\s]+/, "").trim()
          : line.replace(/^[-•*\d.)\s]+/, "").trim()
        )
        .map((line: string) => line.replace(/^[-•*\d.)\s]+/, "").trim())
        .filter((line: string) => line.length > 2 && !/^\d+$/.test(line));

      return new Response(JSON.stringify({ success: true, isimler }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RİSK ANALİZİ (Fine-Kinney — Eski format) ──
    if (mode === "risk-analizi") {
      const { sektor, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Fine-Kinney metoduyla risk analizi yapıyorsun.

Fine-Kinney Formülü: R = İhtimal (İ) × Frekans (F) × Şiddet (Ş)

İHTİMAL DEĞERLERİ: 0.2=Pratik olarak imkansız, 0.5=Zayıf ihtimal, 1=Düşük ihtimal, 3=Nadir fakat olabilir, 6=Kuvvetli muhtemel, 10=Çok güçlü ihtimal
FREKANS DEĞERLERİ: 0.5=Çok nadir (yılda bir), 1=Oldukça nadir, 2=Nadir (ayda bir), 3=Arasıra (haftada bir), 6=Sıklıkla (günde bir), 10=Sürekli
ŞİDDET DEĞERLERİ: 1=Ucuz atlatma, 3=Küçük hasar/yaralanma, 7=Önemli hasar/yaralanma, 15=Kalıcı hasar/iş kaybı, 40=Ölümlü kaza, 100=Birden fazla ölümlü kaza

RİSK SEVİYELERİ: R≥400=Tolerans Gösterilemez, 200≤R<400=Esaslı, 70≤R<200=Önemli, 20≤R<70=Olası, R<20=Önemsiz

ÖNEMLİ: Kullanıcının istediği kadar risk satırı üret. Sayıyı asla kısıtlama.

SADECE JSON formatında yanıt ver:
{
  "rows": [
    {
      "no": 1,
      "tehlikeBolumu": "Bölüm adı",
      "tehlikeKaynagi": "Tehlike kaynağı açıklaması",
      "olasiZarar": "Olası zarar/sonuç",
      "ihtimal": 3,
      "frekans": 6,
      "siddet": 15,
      "riskSkoru": 270,
      "riskSeviyesi": "Esaslı",
      "onleyiciFaaliyet": "Alınması gereken önlem"
    }
  ]
}`;
      userPrompt = `Sektör: ${sektor}\nİstek: ${prompt}\n\nBu sektör için Fine-Kinney risk analizi tablosu oluştur.`;
    }

    // ── RİSK ANALİZİ V2 ──
    else if (mode === "risk-analizi-v2") {
      const { sektor, firmaAdi, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Fine-Kinney metoduyla kapsamlı risk değerlendirme raporu hazırlıyorsun.

Fine-Kinney Formülü: R = Olasılık (O) × Şiddet (Ş) × Frekans (F)

OLASILIK: 0.2=Beklenmez, 0.5=Mümkün, 1=Düşük, 3=Olası, 6=Yüksek, 10=Kesin
ŞİDDET: 1=Ucuz atlatma, 3=Küçük yaralanma, 7=Önemli yaralanma, 15=Kalıcı hasar, 40=Ölüm, 100=Çoklu ölüm
FREKANS: 0.5=Çok seyrek, 1=Seyrek, 2=Sık değil, 3=Ara sıra, 6=Sık, 10=Sürekli

RİSK: >=400=Tolerans Gösterilemez, 200-400=Esaslı, 70-200=Önemli, 20-70=Olası, <20=Önemsiz

KRİTİK KURAL: İstenen sayıda risk satırı üret, azaltma.

SADECE JSON:
{
  "rows": [
    {
      "no": 1,
      "bolum": "Bölüm",
      "faaliyet": "Faaliyet",
      "tehlikeKaynagi": "Tehlike kaynağı",
      "tehlikeler": "Tehlike",
      "riskler": "Risk",
      "kimlerEtkilenir": "Etkilenenler",
      "mevcutDurum": "Mevcut durum",
      "o1": 3, "s1": 7, "f1": 3, "r1": 63, "riskTanimi1": "Önemli",
      "planlamaAnalizSonucu": "Analiz sonucu",
      "duzelticiTedbirler": "Tedbirler",
      "sorumluluk": "Sorumlu",
      "gerceklestirilenTedbirler": "",
      "gercTarih": "",
      "o2": 0.5, "s2": 7, "f2": 3, "r2": 11, "riskTanimi2": "Önemsiz",
      "aciklama": ""
    }
  ]
}`;
      userPrompt = `Firma: ${firmaAdi || "Belirtilmemiş"}\nSektör: ${sektor}\nİstek: ${prompt}\n\nKapsamlı Fine-Kinney risk değerlendirme tablosu oluştur. İstenen sayıda satır üret.`;
    }

    // ── ACİL DURUM EYLEM PLANI ──
    else if (mode === "acil-durum-eylem-plani") {
      const { sektor, firmaAdi, calisanSayisi, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. Türk mevzuatına (6331 sayılı İSG Kanunu) uygun acil durum eylem planı hazırlıyorsun.

SADECE JSON:
{
  "ozet": "Planın kısa özeti 2-3 cümle",
  "basliklar": [
    {
      "baslik": "Bölüm başlığı",
      "icerik": ["Madde 1", "Madde 2", "Madde 3"]
    }
  ]
}

Bölümler: 1)Amaç ve Kapsam 2)Acil Durum Türleri 3)Tahliye Prosedürleri 4)Toplanma Noktaları 5)Acil İletişim 6)Ekip Görev Dağılımı 7)Tatbikat Planı 8)Güncelleme`;
      userPrompt = `Firma: ${firmaAdi}\nSektör: ${sektor}\nÇalışan: ${calisanSayisi || "Belirtilmemiş"}\nNot: ${prompt || "Yok"}\n\nAcil durum eylem planı hazırla.`;
    }

    // ── SAĞLIK GÜVENLİK PLANI ──
    else if (mode === "saglik-guvenlik-plani") {
      const { sektor, firmaAdi, projeAdi, projeAdresi, isverenAdi, isgUzmani, isyeriHekimi, koordinator, calisanSayisi, riskSeviyesi, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. 6331 sayılı İSG Kanunu ve Yapı İşleri Yönetmeliği'ne uygun Sağlık ve Güvenlik Planı hazırlıyorsun.

SADECE JSON, her bölümde en az 5-8 madde:
{
  "ozet": "3-4 cümle özet",
  "basliklar": [
    {
      "baslik": "Bölüm başlığı",
      "icerik": ["Madde 1", "Madde 2"]
    }
  ]
}`;
      userPrompt = `Firma: ${firmaAdi}\nProje: ${projeAdi || "-"}\nAdres: ${projeAdresi || "-"}\nİşveren: ${isverenAdi || "-"}\nİSG Uzmanı: ${isgUzmani || "-"}\nHekimi: ${isyeriHekimi || "-"}\nKoordinatör: ${koordinator || "-"}\nSektör: ${sektor}\nTehlike Sınıfı: ${riskSeviyesi || "Tehlikeli"}\nÇalışan: ${calisanSayisi || "-"}\nNot: ${prompt || "Yok"}\n\nSGP hazırla.`;
    }

    // ── KOORDİNATÖR ATAMASI ──
    else if (mode === "koordinator-atamasi") {
      const { firmaAdi, koordinatorAdi, unvan, atamaTarihi, sektor, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. Resmi SGP Koordinatör Atama Belgesi hazırlıyorsun.

SADECE JSON:
{
  "ozet": "Atama belgesinin kısa özeti",
  "basliklar": [
    {
      "baslik": "Bölüm başlığı",
      "icerik": ["Madde 1", "Madde 2"]
    }
  ]
}

Bölümler: 1)Atama Bilgileri 2)Görev Tanımı 3)Yetkiler 4)Yükümlülükler 5)Raporlama 6)Geçerlilik ve İmza`;
      userPrompt = `Firma: ${firmaAdi}\nKoordinatör: ${koordinatorAdi}\nUnvan: ${unvan || "İSG Koordinatörü"}\nTarih: ${atamaTarihi || new Date().toLocaleDateString("tr-TR")}\nSektör: ${sektor || "-"}\nNot: ${prompt || "Yok"}\n\nAtama belgesi hazırla.`;
    }

    // ── ACİL DURUM EKİPLERİ ──
    else if (mode === "acil-durum-ekipleri") {
      const { firmaAdi, calisanSayisi, sektor, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. Acil durum ekiplerini oluşturuyorsun.

SADECE JSON:
{
  "ekipler": [
    {
      "ekipAdi": "Yangın Söndürme Ekibi",
      "ekipRengi": "kirmizi",
      "aciklama": "Kısa açıklama",
      "uyeler": [
        {
          "ad": "Ekip Lideri",
          "gorev": "Ekip Lideri",
          "sorumluluklar": ["Sorumluluk 1", "Sorumluluk 2", "Sorumluluk 3"]
        }
      ]
    }
  ]
}

Ekipler: Yangın Söndürme, Tahliye, İlk Yardım, Kurtarma, Haberleşme. Her ekipte 3-5 üye.`;
      userPrompt = `Firma: ${firmaAdi}\nSektör: ${sektor || "Genel"}\nÇalışan: ${calisanSayisi || "-"}\nNot: ${prompt || "Yok"}\n\nAcil durum ekiplerini oluştur.`;
    }

    // ── TUTANAK ──
    else if (mode === "tutanak") {
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. Kısa nottan profesyonel denetim tutanağı üretiyorsun.

KURALLAR:
1. "aciklama": En az 300-500 karakter, resmi denetim dili
2. "notlar": Somut aksiyonlar, 150-250 karakter
3. "baslik": Kısa resmi başlık, max 80 karakter
4. Türkçe, resmi dil
5. SADECE JSON: {"baslik":"...","aciklama":"...","notlar":"..."}`;
      userPrompt = `Firma: ${data?.firmaAdi || "-"}\nTarih: ${data?.tarih || new Date().toLocaleDateString("tr-TR")}\nKısa Not: ${data?.kisaAciklama || ""}\n\nProfesyonel tutanağa dönüştür.`;
    }

    // ── UYGUNSUZLUK ──
    else if (mode === "uygunsuzluk") {
      systemPrompt = `Sen bir İSG uzmanısın. Uygunsuzluk açıklamasına göre önlemler öneriyorsun. Türkçe, pratik ve uygulanabilir. SADECE JSON: {"onlem":"150-350 karakter önlemler"}`;
      userPrompt = `Başlık: ${data?.baslik || "-"}\nAçıklama: ${data?.aciklama || ""}\nÖnem: ${data?.severity || "Orta"}\nFirma: ${data?.firmaAdi || "-"}`;
    }

    // ── DASHBOARD ÖZET ──
    else if (mode === "dashboard-ozet") {
      systemPrompt = `Sen bir İSG uzmanısın. Sistem durumu verilerini analiz edip kısa öneriler sunuyorsun. Türkçe. SADECE JSON:
{
  "genel_yorum": "2-3 cümle değerlendirme",
  "en_acil": "En acil 1 şey, max 120 karakter",
  "oneriler": ["Öneri 1 max 100 karakter", "Öneri 2", "Öneri 3"],
  "risk_seviyesi": "Düşük veya Orta veya Yüksek veya Kritik"
}`;
      const { saglikSkoru, kritikSayisi, uyariSayisi, bilgiSayisi, sorunlar } = data || {};
      userPrompt = `Skor: ${saglikSkoru}/100\nKritik: ${kritikSayisi}\nUyarı: ${uyariSayisi}\nBilgi: ${bilgiSayisi}\nSorunlar:\n${(sorunlar || []).map((s: string) => `- ${s}`).join("\n")}\n\nKısa analiz sun.`;
    }

    else {
      return new Response(JSON.stringify({ error: "Geçersiz mod" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Model seçimi: risk analizi için akıllı model, diğerleri için hızlı model
    const selectedModel = (mode === "risk-analizi" || mode === "risk-analizi-v2")
      ? SMART_MODEL
      : FAST_MODEL;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: mode === "risk-analizi" || mode === "risk-analizi-v2" ? 8000 : 4000,
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
