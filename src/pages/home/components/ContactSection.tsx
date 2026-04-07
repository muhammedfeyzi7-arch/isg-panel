import { useState } from "react";

export default function ContactSection() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
    try {
      await fetch("https://readdy.ai/api/form/d7abo5f6e3lk97049p3g", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.toString(),
      });
      setSubmitted(true);
      form.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white py-24 px-6" id="iletisim-formu">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left */}
          <div>
            <span className="inline-block text-xs font-semibold text-[#059669] uppercase tracking-widest mb-4">
              İletişim
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] leading-tight mb-4">
              Bizimle iletişime geçin
            </h2>
            <p className="text-[#64748B] text-base leading-relaxed mb-10">
              Size en uygun çözümü birlikte belirleyelim.
            </p>

            {/* Info items */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] shrink-0">
                  <i className="ri-mail-line text-[#059669] text-base"></i>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-0.5">E-posta</p>
                  <span className="text-sm font-medium text-[#374151]">
                    info@isgdenetim.com.tr
                    <span className="ml-2 text-xs text-[#94A3B8] font-normal">(yakında aktif)</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] shrink-0">
                  <i className="ri-map-pin-line text-[#059669] text-base"></i>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-0.5">Konum</p>
                  <span className="text-sm font-medium text-[#374151]">Türkiye</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8">
            {submitted ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-[#F0FDF4] border border-[#BBF7D0] mx-auto mb-4">
                  <i className="ri-check-line text-[#059669] text-2xl"></i>
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">Mesajınız alındı</h3>
                <p className="text-sm text-[#64748B]">En kısa sürede sizinle iletişime geçeceğiz.</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-6 text-xs text-[#059669] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Yeni mesaj gönder
                </button>
              </div>
            ) : (
              <form
                data-readdy-form
                onSubmit={handleSubmit}
                className="flex flex-col gap-5"
              >
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Ad Soyad</label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Adınız ve soyadınız"
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#059669] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Telefon</label>
                  <input
                    name="phone"
                    type="tel"
                    required
                    placeholder="+90 5xx xxx xx xx"
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#059669] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Mesaj</label>
                  <textarea
                    name="message"
                    rows={4}
                    maxLength={500}
                    required
                    placeholder="Nasıl yardımcı olabiliriz?"
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#059669] transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#059669] hover:bg-[#047857] disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-lg transition-colors duration-200 whitespace-nowrap cursor-pointer"
                >
                  {loading ? "Gönderiliyor..." : "Mesaj Gönder"}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
