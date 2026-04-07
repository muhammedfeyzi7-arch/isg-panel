const cards = [
  {
    icon: "ri-shield-keyhole-line",
    title: "Güvenli veri altyapısı",
    desc: "Verileriniz modern ve güvenli altyapı üzerinde saklanır.",
  },
  {
    icon: "ri-user-settings-line",
    title: "Rol bazlı erişim",
    desc: "Her kullanıcı sadece yetkisi dahilinde verilere erişir.",
  },
  {
    icon: "ri-building-4-line",
    title: "Organizasyon bazlı yapı",
    desc: "Her firma verilerini diğerlerinden tamamen bağımsız yönetir.",
  },
];

export default function TrustSection() {
  return (
    <section className="bg-white py-24 px-6" id="guven">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block text-xs font-semibold text-[#059669] uppercase tracking-widest mb-4">
            Güvenlik
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] leading-tight">
            Verileriniz güvende, sisteminiz kontrol altında
          </h2>
          <p className="mt-4 text-[#64748B] text-base leading-relaxed">
            Tüm verileriniz güvenli altyapıda saklanır ve sadece yetkili kullanıcılar tarafından erişilebilir. Organizasyon bazlı yapı sayesinde her firma kendi verisini izole şekilde yönetir.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="group bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 flex flex-col gap-5 hover:border-[#059669]/30 transition-colors duration-200"
            >
              {/* Icon */}
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-[#E2E8F0] group-hover:border-[#BBF7D0] transition-colors duration-200">
                <i className={`${card.icon} text-[#059669] text-lg`}></i>
              </div>

              {/* Text */}
              <div>
                <h3 className="text-base font-semibold text-[#0F172A] mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  {card.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
