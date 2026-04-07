export default function SolutionSection() {
  return (
    <section className="bg-[#F8FAFC] py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16">

          {/* Left — Text */}
          <div className="flex-1 max-w-lg">
            <span className="inline-block text-xs font-semibold text-[#059669] uppercase tracking-widest mb-4">
              Çözüm
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] leading-tight mb-5">
              Tüm süreçleri{" "}
              <span className="text-[#059669]">tek panelden</span>{" "}
              yönetin
            </h2>
            <p className="text-base text-[#64748B] leading-relaxed mb-10">
              Evrak, denetim, ekipman ve personel süreçlerini tek ekranda toplayın.
              Süreleri takip edin, riskleri önceden görün.
            </p>

            {/* Excel highlight */}
            <div className="inline-flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 mb-8">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <i className="ri-file-excel-2-line text-[#059669] text-base"></i>
              </div>
              <span className="text-sm font-medium text-[#334155]">
                Tek tıkla tüm kayıtlarınızı Excel raporuna dönüştürün.
              </span>
            </div>

            {/* Feature list */}
            <ul className="flex flex-col gap-4">
              {[
                { icon: "ri-file-check-line", text: "Evraklar her zaman güncel ve erişilebilir" },
                { icon: "ri-shield-check-line", text: "Denetim kayıtları anlık sisteme işlenir" },
                { icon: "ri-alarm-line", text: "Süreler otomatik takip edilir, uyarılar gelir" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#059669]/10 shrink-0 mt-0.5">
                    <i className={`${item.icon} text-[#059669] text-sm`}></i>
                  </div>
                  <span className="text-sm text-[#334155] leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — Dashboard Screenshot */}
          <div className="flex-1 w-full max-w-2xl relative">
            <div
              className="rounded-2xl overflow-hidden border border-[#E2E8F0]"
              style={{ boxShadow: "0 24px 64px rgba(15,23,42,0.10)" }}
            >
              <img
                src="https://storage.readdy-site.link/project_files/32088732-9255-4415-9fac-6f13c8e4aa80/0bdf199d-fa99-45d0-be0b-296f36feb1bd_Ekran-grnts-2026-04-07-104657.png?v=f169d0ea12170016807e3c58ae1ba247"
                alt="İSGPanel Dashboard Görünümü"
                className="w-full h-auto object-top"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
