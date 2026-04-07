import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

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
      systemPrompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Kullanıcının verdiği kısa açıklamadan profesyonel bir denetim tutanağı oluşturuyorsun. Türkçe yaz. Resmi ve profesyonel dil kullan. SADECE JSON formatında yanıt ver, başka hiçbir şey yazma:
{"baslik":"Tutanak başlığı max 80 karakter","aciklama":"200-400 karakter detaylı açıklama","notlar":"100-200 karakter ek notlar"}`;
      userPrompt = `Firma: ${data?.firmaAdi || "Belirtilmemiş"}
Açıklama: ${data?.kisaAciklama || ""}
Tarih: ${data?.tarih || new Date().toLocaleDateString("tr-TR")}`;

    } else if (mode === "uygunsuzluk") {
      systemPrompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. Uygunsuzluk açıklamasına göre alınması gereken önlemleri öneriyorsun. Türkçe yaz. Pratik ve uygulanabilir önlemler ver. SADECE JSON formatında yanıt ver:
{"onlem":"150-350 karakter düz metin önlemler"}`;
      userPrompt = `Başlık: ${data?.baslik || "Belirtilmemiş"}
Açıklama: ${data?.aciklama || ""}
Önem: ${data?.severity || "Orta"}
Firma: ${data?.firmaAdi || "Belirtilmemiş"}`;

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
        max_tokens: 600,
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
