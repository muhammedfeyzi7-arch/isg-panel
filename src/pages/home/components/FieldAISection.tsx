import QRMockup from "./QRMockup";

export default function FieldAISection() {
  return (
    <section className="bg-[#F8FAFC] py-24 px-6" id="saha-ve-yapay-zeka">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block text-xs font-semibold text-[#059669] uppercase tracking-widest mb-4">
            Saha &amp; Yapay Zeka
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] leading-tight">
            Sahada hız kazanın, yapay zeka ile destek alın
          </h2>
          <p className="mt-4 text-[#64748B] text-base leading-relaxed">
            Denetim süreçlerinizi sahada hızlı ve pratik şekilde yönetin. Yapay zeka desteği ile tekrar eden işleri azaltın ve daha doğru kayıtlar oluşturun.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

          {/* Left: QR card with phone mockup */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-10 flex flex-col items-center justify-center min-h-[480px] relative overflow-hidden">
            {/* Subtle gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#F0FDF4]/60 via-white to-[#F8FAFC] pointer-events-none"></div>

            <div className="relative z-10 pt-10">
              <QRMockup />
            </div>

            {/* Bottom label */}
            <div className="relative z-10 mt-10 text-center">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                  <i className="ri-qr-code-line text-[#059669] text-base"></i>
                </div>
                <div className="text-left">
                  <span className="block text-[10px] font-semibold text-[#059669] uppercase tracking-widest">Saha</span>
                  <span className="block text-sm font-bold text-[#0F172A]">QR ile anında erişim</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-[#64748B] leading-relaxed max-w-xs">
                Ekipmanlara saniyeler içinde ulaşın, kontrol geçmişini görüntüleyin ve sahada doğrudan işlem yapın.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {["Anında erişim", "Geçmiş kayıtlar", "Sahada işlem"].map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-[#F1F5F9] rounded-full px-3 py-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] inline-block"></span>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: AI card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 flex flex-col gap-6 min-h-[480px] relative overflow-hidden">
            {/* Subtle gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#F0FDF4]/30 via-white to-[#F8FAFC] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col gap-6 h-full">
              {/* Top row */}
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] shrink-0">
                  <i className="ri-sparkling-2-line text-[#059669] text-xl"></i>
                </div>
                <div>
                  <span className="inline-block text-[10px] font-semibold text-[#059669] uppercase tracking-widest mb-1">
                    Yapay Zeka
                  </span>
                  <h3 className="text-lg font-bold text-[#0F172A] leading-snug">
                    Yapay zeka destekli denetim
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-[#64748B] leading-relaxed">
                Kısa bilgilerle otomatik açıklama ve öneriler oluşturun, tutanak hazırlama sürecini hızlandırın.
              </p>

              {/* AI demo UI */}
              <div className="flex-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#059669]"></div>
                  <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Yapay Zeka Asistanı</span>
                </div>

                {/* Chat bubbles */}
                <div className="flex flex-col gap-2">
                  <div className="self-end bg-[#0F172A] text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%] leading-relaxed">
                    Yangın tüpü dolum tarihi geçmiş
                  </div>
                  <div className="self-start bg-white border border-[#E2E8F0] text-[#374151] text-xs rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%] leading-relaxed">
                    <span className="font-semibold text-[#059669]">Öneri:</span> Yangın tüpü dolum tarihi 3 ay önce geçmiş. Acil yenileme gerekiyor. Tutanak oluşturulsun mu?
                  </div>
                  <div className="self-end bg-[#0F172A] text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%] leading-relaxed">
                    Evet, tutanak oluştur
                  </div>
                  <div className="self-start bg-white border border-[#E2E8F0] text-[#374151] text-xs rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%] leading-relaxed">
                    <span className="font-semibold text-[#059669]">Tutanak hazır.</span> İmza için sorumluya gönderildi.
                  </div>
                </div>

                {/* Input bar */}
                <div className="mt-auto flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-2">
                  <span className="text-xs text-[#CBD5E1] flex-1">Durumu kısaca açıklayın...</span>
                  <div className="w-6 h-6 flex items-center justify-center bg-[#059669] rounded-lg">
                    <i className="ri-send-plane-fill text-white text-[10px]"></i>
                  </div>
                </div>
              </div>

              {/* Highlights */}
              <div className="flex flex-wrap gap-2">
                {["Otomatik açıklama", "Akıllı öneriler", "Hızlı tutanak"].map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-[#F1F5F9] rounded-full px-3 py-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] inline-block"></span>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
