export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Soft green glow — top left */}
      <div
        className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{ background: "radial-gradient(circle, rgba(5,150,105,0.07) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-24 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* Left — Text */}
          <div className="flex-1 flex flex-col items-start max-w-xl">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-3 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse"></span>
              <span className="text-xs font-medium text-[#64748B] tracking-wide">İSG Yönetim Platformu</span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl lg:text-5xl font-bold text-[#0F172A] leading-tight tracking-tight mb-6">
              İSG süreçlerinizi{" "}
              <span className="relative inline-block text-[#059669]">
                tek panelden
              </span>{" "}
              yönetin
            </h1>

            {/* Subtext */}
            <p className="text-base text-[#64748B] leading-relaxed mb-10 max-w-md">
              Evrak, saha denetimi ve ekipman takibini tek sistemde toplayın.
              Süreleri kaçırmayın, riskleri önceden görün.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <a
                href="#iletisim"
                className="inline-flex items-center gap-2 bg-[#059669] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#047857] transition-all duration-200 cursor-pointer whitespace-nowrap"
              >
                İletişime Geç
                <i className="ri-arrow-right-line text-sm"></i>
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 text-[#64748B] text-sm font-medium hover:text-[#0F172A] transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-login-box-line text-sm"></i>
                Panele Giriş Yap
              </a>
            </div>


          </div>

          {/* Right — Gerçek Panel Görseli */}
          <div className="flex-1 w-full max-w-2xl relative">
            <div className="relative rounded-2xl overflow-hidden border border-[#E2E8F0]" style={{ boxShadow: "0 20px 60px rgba(15,23,42,0.10)" }}>
              {/* Soft fade on bottom & right edges */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
                <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent" />
              </div>
              <img
                src="https://storage.readdy-site.link/project_files/32088732-9255-4415-9fac-6f13c8e4aa80/d9f4067d-9687-4598-ac76-91e766b8c086_Ekran-grnts-2026-04-07-103417.png?v=ae9b7213b2b4acf1b96e8a8e8f48ecd8"
                alt="İSGPanel Dashboard"
                className="w-full h-auto object-top object-cover"
              />
            </div>

            {/* Floating badge — top right */}
            <div className="absolute -top-4 -right-4 bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 flex items-center gap-2 z-20" style={{ boxShadow: "0 4px 16px rgba(15,23,42,0.08)" }}>
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-shield-check-fill text-[#059669] text-sm"></i>
              </div>
              <span className="text-xs font-semibold text-[#0F172A] whitespace-nowrap">Güvenli Sistem</span>
            </div>

            {/* Floating badge — bottom left */}
            <div className="absolute -bottom-4 -left-4 bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 flex items-center gap-2 z-20" style={{ boxShadow: "0 4px 16px rgba(15,23,42,0.08)" }}>
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-time-line text-[#059669] text-sm"></i>
              </div>
              <span className="text-xs font-semibold text-[#0F172A] whitespace-nowrap">Gerçek Zamanlı Takip</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
