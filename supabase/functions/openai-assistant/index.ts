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

    // ── RİSK ANALİZİ (Fine-Kinney) ──
    if (mode === "risk-analizi") {
      const { sektor, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Fine-Kinney metoduyla risk analizi yapıyorsun.

Fine-Kinney Formülü: R = İhtimal (İ) × Frekans (F) × Şiddet (Ş)

İHTİMAL DEĞERLERİ: 0.2=Pratik olarak imkansız, 0.5=Zayıf ihtimal, 1=Düşük ihtimal, 3=Nadir fakat olabilir, 6=Kuvvetli muhtemel, 10=Çok güçlü ihtimal
FREKANS DEĞERLERİ: 0.5=Çok nadir (yılda bir), 1=Oldukça nadir, 2=Nadir (ayda bir), 3=Arasıra (haftada bir), 6=Sıklıkla (günde bir), 10=Sürekli
ŞİDDET DEĞERLERİ: 1=Ucuz atlatma, 3=Küçük hasar/yaralanma, 7=Önemli hasar/yaralanma, 15=Kalıcı hasar/iş kaybı, 40=Ölümlü kaza, 100=Birden fazla ölümlü kaza

RİSK SEVİYELERİ: R≥400=Tolerans Gösterilemez, 200≤R<400=Esaslı, 70≤R<200=Önemli, 20≤R<70=Olası, R<20=Önemsiz

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
      userPrompt = `Sektör: ${sektor}
İstek: ${prompt}

Bu sektör ve istek için Fine-Kinney risk analizi tablosu oluştur. Her risk için gerçekçi İ, F, Ş değerleri ata ve R = İ × F × Ş formülüyle risk skorunu hesapla. Önleyici faaliyetler somut ve uygulanabilir olsun.`;
    }

    // ── ACİL DURUM EYLEM PLANI ──
    else if (mode === "acil-durum-eylem-plani") {
      const { sektor, firmaAdi, calisanSayisi, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. Türk mevzuatına (6331 sayılı İSG Kanunu) uygun acil durum eylem planı hazırlıyorsun.

SADECE JSON formatında yanıt ver:
{
  "ozet": "Planın kısa özeti 2-3 cümle",
  "basliklar": [
    {
      "baslik": "Bölüm başlığı",
      "icerik": ["Madde 1", "Madde 2", "Madde 3"]
    }
  ]
}

Plan şu bölümleri içermeli: 1) Amaç ve Kapsam, 2) Acil Durum Türleri ve Senaryolar, 3) Tahliye Prosedürleri, 4) Toplanma Noktaları, 5) Acil İletişim Bilgileri, 6) Ekip Görev Dağılımı, 7) Tatbikat Planı, 8) Güncelleme ve Revizyon`;
      userPrompt = `Firma: ${firmaAdi}
Sektör: ${sektor}
Çalışan Sayısı: ${calisanSayisi || "Belirtilmemiş"}
Ek Notlar: ${prompt || "Yok"}

Bu firmaya özel, sektöre uygun acil durum eylem planı hazırla.`;
    }

    // ── SAĞLIK GÜVENLİK PLANI ──
    else if (mode === "saglik-guvenlik-plani") {
      const { sektor, firmaAdi, calisanSayisi, riskSeviyesi, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. 6331 sayılı İSG Kanunu ve ilgili yönetmeliklere uygun Sağlık ve Güvenlik Planı hazırlıyorsun.

SADECE JSON formatında yanıt ver:
{
  "ozet": "Planın kısa özeti 2-3 cümle",
  "basliklar": [
    {
      "baslik": "Bölüm başlığı",
      "icerik": ["Madde 1", "Madde 2", "Madde 3"]
    }
  ]
}

Plan şu bölümleri içermeli: 1) Genel Bilgiler ve Kapsam, 2) Yasal Dayanak, 3) Risk Değerlendirmesi Özeti, 4) Kişisel Koruyucu Donanım, 5) Eğitim ve Bilinçlendirme, 6) Sağlık Gözetimi, 7) Acil Durum Prosedürleri, 8) Denetim ve İzleme, 9) Sorumluluklar`;
      userPrompt = `Firma: ${firmaAdi}
Sektör: ${sektor}
Tehlike Sınıfı: ${riskSeviyesi || "Tehlikeli"}
Çalışan Sayısı: ${calisanSayisi || "Belirtilmemiş"}
Ek Notlar: ${prompt || "Yok"}

Bu firmaya özel, sektöre ve tehlike sınıfına uygun Sağlık ve Güvenlik Planı hazırla.`;
    }

    // ── KOORDİNATÖR ATAMASI ──
    else if (mode === "koordinator-atamasi") {
      const { firmaAdi, koordinatorAdi, unvan, atamaTarihi, sektor, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. Resmi SGP Koordinatör Atama Belgesi hazırlıyorsun.

SADECE JSON formatında yanıt ver:
{
  "ozet": "Atama belgesinin kısa özeti",
  "basliklar": [
    {
      "baslik": "Bölüm başlığı",
      "icerik": ["Madde 1", "Madde 2"]
    }
  ]
}

Belge şu bölümleri içermeli: 1) Atama Bilgileri, 2) Görev Tanımı ve Sorumluluklar, 3) Yetkiler, 4) Koordinatörün Yükümlülükleri, 5) Raporlama ve İletişim, 6) Geçerlilik ve İmza`;
      userPrompt = `Firma: ${firmaAdi}
Koordinatör: ${koordinatorAdi}
Unvan: ${unvan || "İSG Koordinatörü"}
Atama Tarihi: ${atamaTarihi || new Date().toLocaleDateString("tr-TR")}
Sektör: ${sektor || "Belirtilmemiş"}
Ek Notlar: ${prompt || "Yok"}

Bu kişi için resmi SGP Koordinatör Atama Belgesi hazırla.`;
    }

    // ── ACİL DURUM EKİPLERİ ──
    else if (mode === "acil-durum-ekipleri") {
      const { firmaAdi, calisanSayisi, sektor, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İSG uzmanısın. Acil durum ekiplerini ve görev dağılımlarını oluşturuyorsun.

SADECE JSON formatında yanıt ver:
{
  "ekipler": [
    {
      "ekipAdi": "Yangın Söndürme Ekibi",
      "ekipRengi": "kirmizi",
      "aciklama": "Ekibin kısa açıklaması",
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

Standart ekipler: Yangın Söndürme Ekibi, Tahliye Ekibi, İlk Yardım Ekibi, Kurtarma Ekibi, Haberleşme Ekibi. Her ekipte ekip lideri dahil 3-5 üye olsun. Üye adları "Ekip Lideri", "1. Üye", "2. Üye" gibi genel isimler olsun.`;
      userPrompt = `Firma: ${firmaAdi}
Sektör: ${sektor || "Genel"}
Çalışan Sayısı: ${calisanSayisi || "Belirtilmemiş"}
Ek Notlar: ${prompt || "Yok"}

Bu firmaya uygun acil durum ekiplerini ve görev dağılımlarını oluştur.`;
    }

    // ── TUTANAK ──
    else if (mode === "tutanak") {
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
        max_tokens: 2000,
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
