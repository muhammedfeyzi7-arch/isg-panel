import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = "AIzaSyBnxL5ZFPzwiHotyyZ4SimWRUV-hTW4p-Y";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode, data } = await req.json();

    let prompt = "";

    if (mode === "tutanak") {
      prompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. 
Kullanıcının verdiği kısa açıklamadan profesyonel bir denetim tutanağı oluştur.
Türkçe yaz. Resmi ve profesyonel bir dil kullan.
SADECE JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "baslik": "Tutanak başlığı (kısa, öz, max 80 karakter)",
  "aciklama": "Detaylı tutanak açıklaması (200-400 karakter arası, profesyonel dil)",
  "notlar": "Ek notlar ve öneriler (100-200 karakter)"
}

Firma: ${data.firmaAdi || "Belirtilmemiş"}
Kısa Açıklama: ${data.kisaAciklama}
Tarih: ${data.tarih || new Date().toLocaleDateString("tr-TR")}`;

    } else if (mode === "uygunsuzluk") {
      prompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın.
Kullanıcının girdiği uygunsuzluk açıklamasına göre alınması gereken önlemleri öner.
Türkçe yaz. Pratik, uygulanabilir ve net önlemler ver.
SADECE JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "onlem": "Alınması gereken önlemler (150-350 karakter, madde madde değil düz metin, pratik ve uygulanabilir)"
}

Uygunsuzluk Başlığı: ${data.baslik || "Belirtilmemiş"}
Uygunsuzluk Açıklaması: ${data.aciklama}
Önem Derecesi: ${data.severity || "Orta"}
Firma: ${data.firmaAdi || "Belirtilmemiş"}`;
    } else {
      return new Response(JSON.stringify({ error: "Geçersiz mod" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini error:", err);
      return new Response(JSON.stringify({ error: "Gemini API hatası: " + err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return new Response(JSON.stringify({ error: "Yanıt alınamadı" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // JSON'u temizle (markdown code block varsa kaldır)
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
