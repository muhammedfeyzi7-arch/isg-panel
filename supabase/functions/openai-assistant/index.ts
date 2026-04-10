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

    // ── RİSK ANALİZİ (Fine-Kinney — Eski format, geriye dönük uyumluluk) ──
    if (mode === "risk-analizi") {
      const { sektor, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Fine-Kinney metoduyla risk analizi yapıyorsun.

Fine-Kinney Formülü: R = İhtimal (İ) × Frekans (F) × Şiddet (Ş)

İHTİMAL DEĞERLERİ: 0.2=Pratik olarak imkansız, 0.5=Zayıf ihtimal, 1=Düşük ihtimal, 3=Nadir fakat olabilir, 6=Kuvvetli muhtemel, 10=Çok güçlü ihtimal
FREKANS DEĞERLERİ: 0.5=Çok nadir (yılda bir), 1=Oldukça nadir, 2=Nadir (ayda bir), 3=Arasıra (haftada bir), 6=Sıklıkla (günde bir), 10=Sürekli
ŞİDDET DEĞERLERİ: 1=Ucuz atlatma, 3=Küçük hasar/yaralanma, 7=Önemli hasar/yaralanma, 15=Kalıcı hasar/iş kaybı, 40=Ölümlü kaza, 100=Birden fazla ölümlü kaza

RİSK SEVİYELERİ: R≥400=Tolerans Gösterilemez, 200≤R<400=Esaslı, 70≤R<200=Önemli, 20≤R<70=Olası, R<20=Önemsiz

ÖNEMLİ: Kullanıcının istediği kadar risk satırı üret. Sayıyı asla kısıtlama. Eğer 50 risk isteniyorsa tam 50 risk üret.

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

Bu sektör ve istek için Fine-Kinney risk analizi tablosu oluştur. Kullanıcının belirttiği sayıda risk üret, sayıyı düşürme.`;
    }

    // ── RİSK ANALİZİ V2 (Fine-Kinney — Tam Profesyonel Format) ──
    else if (mode === "risk-analizi-v2") {
      const { sektor, firmaAdi, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Fine-Kinney metoduyla kapsamlı risk değerlendirme raporu hazırlıyorsun.

Fine-Kinney Formülü: R = Olasılık (O) × Şiddet (Ş) × Frekans (F)

OLASILIK DEĞERLERİ: 0.2=Beklenmez, 0.5=Beklenmesi fakat mümkün, 1=Mümkün fakat düşük, 3=Olası, 6=Yüksek oldukça mümkün, 10=Beklenir kesin
ŞİDDET DEĞERLERİ: 1=Ucuz atlatma, 3=Küçük hasar/yaralanma, 7=Önemli yaralanma, 15=Kalıcı hasar/iş kaybı, 40=Ölümlü kaza, 100=Birden fazla ölümlü kaza
FREKANS DEĞERLERİ: 0.5=Çok seyrek, 1=Seyrek, 2=Sık değil, 3=Ara sıra, 6=Sık, 10=Hemen hemen sürekli

RİSK SEVİYELERİ: R>=400=Tolerans Gösterilemez, 200<=R<400=Esaslı, 70<=R<200=Önemli, 20<=R<70=Olası, R<20=Önemsiz

KRİTİK KURAL: Kullanıcının istediği kadar risk satırı üret. Sayıyı ASLA kısıtlama veya azaltma. Her risk birbirinden farklı ve gerçekçi olsun.

SADECE JSON formatında yanıt ver:
{
  "rows": [
    {
      "no": 1,
      "bolum": "Bölüm/Alan adı",
      "faaliyet": "Yapılan faaliyet",
      "tehlikeKaynagi": "Tehlike kaynağı",
      "tehlikeler": "Tehlike tanımı",
      "riskler": "Risk tanımı",
      "kimlerEtkilenir": "Etkilenecek kişiler",
      "mevcutDurum": "Mevcut durum açıklaması",
      "o1": 3,
      "s1": 7,
      "f1": 3,
      "r1": 63,
      "riskTanimi1": "Önemli",
      "planlamaAnalizSonucu": "Planlama ve analiz sonucu",
      "duzelticiTedbirler": "Düzeltici/önleyici kontrol tedbirleri",
      "sorumluluk": "Sorumlu kişi/birim",
      "gerceklestirilenTedbirler": "Gerçekleştirilen tedbirler",
      "gercTarih": "",
      "o2": 0.5,
      "s2": 7,
      "f2": 3,
      "r2": 11,
      "riskTanimi2": "Önemsiz",
      "aciklama": "Ek açıklama"
    }
  ]
}

Her satır için: r1 = o1 * s1 * f1, r2 = o2 * s2 * f2 hesapla. Sonraki risk (r2) her zaman mevcut riskten (r1) dusuk olsun.`;
      userPrompt = `Firma: ${firmaAdi || "Belirtilmemiş"}
Sektör: ${sektor}
İstek: ${prompt}

Bu sektör ve istek için kapsamlı Fine-Kinney risk değerlendirme tablosu oluştur. Kullanıcının belirttiği sayıda risk üret — sayıyı düşürme, tam istenen kadar risk satırı yaz. Her risk için gerçekçi değerler ata, somut düzeltici tedbirler öner.`;
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
      const { sektor, firmaAdi, projeAdi, projeAdresi, isverenAdi, isgUzmani, isyeriHekimi, koordinator, calisanSayisi, riskSeviyesi, prompt } = data || {};
      systemPrompt = `Sen deneyimli bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. 6331 sayılı İSG Kanunu, Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği (28786) ve ilgili tüm mevzuata uygun, kapsamlı ve profesyonel bir Sağlık ve Güvenlik Planı hazırlıyorsun.

SADECE JSON formatında yanıt ver. Her bölüm için en az 5-8 madde yaz, maddeler detaylı ve uygulanabilir olsun:
{
  "ozet": "Planın kapsamlı özeti 3-4 cümle, yasal dayanak ve firma bilgilerini içersin",
  "basliklar": [
    {
      "baslik": "Bölüm başlığı",
      "icerik": ["Detaylı madde 1", "Detaylı madde 2"]
    }
  ]
}`;
      userPrompt = `Firma / İşyeri Adı: ${firmaAdi}
Proje Adı: ${projeAdi || "Belirtilmemiş"}
Proje Adresi: ${projeAdresi || "Belirtilmemiş"}
İşveren / Proje Sorumlusu: ${isverenAdi || "Belirtilmemiş"}
İş Güvenliği Uzmanı: ${isgUzmani || "Belirtilmemiş"}
İşyeri Hekimi: ${isyeriHekimi || "Belirtilmemiş"}
Sağlık ve Güvenlik Koordinatörü: ${koordinator || "Belirtilmemiş"}
Sektör: ${sektor}
Tehlike Sınıfı: ${riskSeviyesi || "Tehlikeli"}
Çalışan Sayısı: ${calisanSayisi || "Belirtilmemiş"}
Ek Notlar: ${prompt || "Yok"}

Bu firmaya özel, sektöre ve tehlike sınıfına uygun, kapsamlı Sağlık ve Güvenlik Planı hazırla.`;
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

Standart ekipler: Yangın Söndürme Ekibi, Tahliye Ekibi, İlk Yardım Ekibi, Kurtarma Ekibi, Haberleşme Ekibi. Her ekipte ekip lideri dahil 3-5 üye olsun.`;
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
1. "aciklama" alanı: Kullanıcının kısa notunu TAMAMEN GENİŞLET. En az 3-5 cümle, 300-500 karakter olsun. Resmi denetim dili kullan.
2. "notlar" alanı: Yapılması gereken somut aksiyonları yaz. 150-250 karakter.
3. "baslik" alanı: Konuyu özetleyen kısa resmi başlık, max 80 karakter.
4. Türkçe yaz. Resmi ve profesyonel dil kullan.
5. SADECE JSON formatında yanıt ver:
{"baslik":"...","aciklama":"...","notlar":"..."}`;

      userPrompt = `Firma Adı: ${data?.firmaAdi || "Belirtilmemiş"}
Denetim Tarihi: ${data?.tarih || new Date().toLocaleDateString("tr-TR")}
Kullanıcının Kısa Notu: ${data?.kisaAciklama || ""}

Bu kısa notu profesyonel bir denetim tutanağına dönüştür.`;

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
  "genel_yorum": "2-3 cümle genel durum değerlendirmesi.",
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
        max_tokens: 8000,
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
