import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = "AIzaSyBnxL5ZFPzwiHotyyZ4SimWRUV-hTW4p-Y";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callGemini(prompt: string): Promise<string> {
  // gemini-1.5-flash ile dene (en stabil ücretsiz model)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API hatası (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini boş yanıt döndürdü");
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode, data } = await req.json();

    let prompt = "";

    if (mode === "tutanak") {
      prompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın. 
Aşağıdaki bilgilere göre profesyonel bir denetim tutanağı oluştur.
Türkçe yaz. Resmi ve profesyonel dil kullan.
SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey ekleme, markdown kullanma:
{"baslik":"Tutanak başlığı max 80 karakter","aciklama":"200-400 karakter detaylı açıklama","notlar":"100-200 karakter ek notlar"}

Firma: ${data.firmaAdi || "Belirtilmemiş"}
Açıklama: ${data.kisaAciklama}
Tarih: ${data.tarih || new Date().toLocaleDateString("tr-TR")}`;

    } else if (mode === "uygunsuzluk") {
      prompt = `Sen bir İş Sağlığı ve Güvenliği (İSG) uzmanısın.
Aşağıdaki uygunsuzluk için alınması gereken önlemleri öner.
Türkçe yaz. Pratik ve uygulanabilir önlemler ver.
SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey ekleme, markdown kullanma:
{"onlem":"150-350 karakter düz metin önlemler"}

Başlık: ${data.baslik || "Belirtilmemiş"}
Açıklama: ${data.aciklama}
Önem: ${data.severity || "Orta"}
Firma: ${data.firmaAdi || "Belirtilmemiş"}`;

    } else {
      return new Response(JSON.stringify({ error: "Geçersiz mod" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawText = await callGemini(prompt);
    
    // JSON temizle - markdown code block varsa kaldır
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    
    // İlk { ile son } arasını al
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("JSON bulunamadı: " + cleaned);
    }
    const jsonStr = cleaned.substring(start, end + 1);
    const parsed = JSON.parse(jsonStr);

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
