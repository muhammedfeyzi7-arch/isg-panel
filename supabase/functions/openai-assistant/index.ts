import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

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

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "tutanak") {
      // Tutanak oluşturma modu
      systemPrompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. 
Kullanıcının verdiği kısa açıklamadan profesyonel bir denetim tutanağı oluşturuyorsun.
Türkçe yaz. Resmi ve profesyonel bir dil kullan.
JSON formatında yanıt ver:
{
  "baslik": "Tutanak başlığı (kısa, öz, max 80 karakter)",
  "aciklama": "Detaylı tutanak açıklaması (200-400 karakter arası, profesyonel dil)",
  "notlar": "Ek notlar ve öneriler (100-200 karakter)"
}`;
      userPrompt = `Şu bilgilere göre tutanak oluştur:
Firma: ${data.firmaAdi || "Belirtilmemiş"}
Kısa Açıklama: ${data.kisaAciklama}
Tarih: ${data.tarih || new Date().toLocaleDateString("tr-TR")}`;

    } else if (mode === "uygunsuzluk") {
      // Uygunsuzluk önlem önerisi modu
      systemPrompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın.
Kullanıcının girdiği uygunsuzluk açıklamasına göre alınması gereken önlemleri öneriyorsun.
Türkçe yaz. Pratik, uygulanabilir ve net önlemler ver.
JSON formatında yanıt ver:
{
  "onlem": "Alınması gereken önlemler (150-350 karakter, madde madde değil düz metin, pratik ve uygulanabilir)"
}`;
      userPrompt = `Uygunsuzluk Başlığı: ${data.baslik || "Belirtilmemiş"}
Uygunsuzluk Açıklaması: ${data.aciklama}
Önem Derecesi: ${data.severity || "Orta"}
Firma: ${data.firmaAdi || "Belirtilmemiş"}`;
    } else {
      return new Response(JSON.stringify({ error: "Geçersiz mod" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI error:", err);
      return new Response(JSON.stringify({ error: "OpenAI API hatası: " + err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Yanıt alınamadı" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(content);

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
