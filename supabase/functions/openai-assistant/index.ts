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
