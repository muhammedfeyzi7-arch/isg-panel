const steps = [
  {
    number: "01",
    icon: "ri-building-2-line",
    title: "Firmanızı oluşturun",
    desc: "Tüm personel, evrak ve ekipman verilerinizi sisteme ekleyin.",
  },
  {
    number: "02",
    icon: "ri-shield-check-line",
    title: "Süreçleri yönetin",
    desc: "Denetimleri yapın, kayıtları oluşturun ve tüm süreçleri tek panelden takip edin.",
  },
  {
    number: "03",
    icon: "ri-file-excel-2-line",
    title: "Raporları alın",
    desc: "Tüm verilerinizi analiz edin ve tek tıkla Excel raporu oluşturun.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="bg-white py-24 px-6" id="nasil-calisir">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block text-xs font-semibold text-[#059669] uppercase tracking-widest mb-4">
            Nasıl Çalışır
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] leading-tight">
            Sistemi kullanmak düşündüğünüzden daha kolay
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-[#E2E8F0]" />
              )}

              <div className="flex flex-col items-center text-center">
                {/* Number + Icon */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <i className={`${step.icon} text-[#059669] text-2xl`}></i>
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 flex items-center justify-center bg-[#059669] text-white text-xs font-bold rounded-full">
                    {step.number}
                  </span>
                </div>

                {/* Text */}
                <h3 className="text-base font-semibold text-[#0F172A] mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-[#64748B] leading-relaxed max-w-xs">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
