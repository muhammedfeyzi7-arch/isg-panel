import { useState } from "react";

export default function CTASection() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
    try {
      await fetch("https://readdy.ai/api/form/d7abmf2bdfubkqslaiu0", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.toString(),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#F8FAFC] py-24 px-6" id="iletisim">
      <div className="max-w-2xl mx-auto text-center">

        {/* Label */}
        <span className="inline-block text-xs font-semibold text-[#059669] uppercase tracking-widest mb-6">
          İletişim
        </span>

        {/* Heading */}
        <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] leading-tight mb-5">
          ISG süreçlerinizi daha verimli yönetmeye hazır mısınız?
        </h2>

        {/* Subtext */}
        <p className="text-[#64748B] text-base leading-relaxed mb-10 max-w-xl mx-auto">
          Size özel kullanım senaryosunu birlikte planlayalım. Sistemi işletmenize nasıl uyarlayabileceğinizi gösterelim.
        </p>

        {/* CTA Button */}
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold px-8 py-3.5 rounded-lg transition-colors duration-200 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-mail-send-line text-base"></i>
          Bizimle İletişime Geçin
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setOpen(false); setSubmitted(false); }}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl border border-[#E2E8F0] w-full max-w-md p-8 z-10">

            {/* Close */}
            <button
              onClick={() => { setOpen(false); setSubmitted(false); }}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>

            {submitted ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-[#F0FDF4] border border-[#BBF7D0] mx-auto mb-4">
                  <i className="ri-check-line text-[#059669] text-2xl"></i>
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-2">Mesajınız alındı</h3>
                <p className="text-sm text-[#64748B]">En kısa sürede sizinle iletişime geçeceğiz.</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-[#0F172A] mb-1">İletişime Geçin</h3>
                <p className="text-sm text-[#64748B] mb-6">Formu doldurun, size özel bir görüşme planlayalım.</p>

                <form
                  data-readdy-form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">Ad Soyad</label>
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="Adınız ve soyadınız"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#059669] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">E-posta</label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="ornek@sirket.com"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#059669] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">Şirket</label>
                    <input
                      name="company"
                      type="text"
                      placeholder="Şirket adı (opsiyonel)"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#059669] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">Mesajınız</label>
                    <textarea
                      name="message"
                      rows={3}
                      maxLength={500}
                      placeholder="Nasıl yardımcı olabiliriz?"
                      className="w-full border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#059669] transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#059669] hover:bg-[#047857] disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-lg transition-colors duration-200 whitespace-nowrap cursor-pointer"
                  >
                    {loading ? "Gönderiliyor..." : "Gönder"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
