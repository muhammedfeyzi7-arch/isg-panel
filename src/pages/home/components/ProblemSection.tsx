const problems = [
  {
    icon: "ri-file-warning-line",
    title: "Evrak takibi zor",
    desc: "Belgeler farklı klasörlerde, farklı cihazlarda dağılmış. Hangi evrakın güncel olduğunu bulmak zaman alıyor.",
  },
  {
    icon: "ri-map-pin-2-line",
    title: "Saha kayıtları kaybolur",
    desc: "Sahada yapılan denetimler kağıda yazılıyor, sisteme geç ya da hiç girilmiyor. Bilgi uçup gidiyor.",
  },
  {
    icon: "ri-alarm-warning-line",
    title: "Kontroller unutulur",
    desc: "Ekipman bakımları, muayene tarihleri, periyodik kontroller — hiçbiri hatırlatılmıyor. Süreler sessizce geçiyor.",
  },
];

export default function ProblemSection() {
  return (
    <section className="bg-white py-24 px-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <span className="inline-block text-xs font-semibold text-[#059669] uppercase tracking-widest mb-4">
            Sorun
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] leading-tight mb-5">
            İSG süreçlerinde en büyük sorun:{" "}
            <span className="text-[#059669]">dağınıklık</span>
          </h2>
          <p className="text-base text-[#64748B] leading-relaxed max-w-xl">
            Evraklar farklı yerlerde, denetimler sahada kalıyor, ekipman kontrolleri unutuluyor.
            Süreler kaçırılıyor, riskler geç fark ediliyor.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((p) => (
            <div
              key={p.title}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-7 flex flex-col gap-5 hover:border-[#059669]/30 transition-colors duration-200"
            >
              {/* Icon */}
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-[#E2E8F0]">
                <i className={`${p.icon} text-[#059669] text-xl`}></i>
              </div>

              {/* Text */}
              <div>
                <h3 className="text-base font-semibold text-[#0F172A] mb-2">{p.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
