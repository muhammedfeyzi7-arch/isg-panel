export default function QRMockup() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-56 h-72 rounded-full bg-emerald-100/60 blur-3xl"></div>
      </div>

      {/* Label above */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1">
          <i className="ri-qr-code-line text-sm"></i>
          QR okut → anında işlem yap
        </span>
      </div>

      {/* Phone frame */}
      <div className="relative w-[220px] z-10">
        {/* Outer shell */}
        <div
          className="relative rounded-[36px] bg-[#1A1A1A] p-[3px]"
          style={{
            boxShadow:
              "0 32px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* Inner bezel */}
          <div className="rounded-[34px] bg-[#111] overflow-hidden">
            {/* Status bar */}
            <div className="flex items-center justify-between px-5 pt-3 pb-1 bg-[#0F172A]">
              <span className="text-[9px] text-white/60 font-medium">09:41</span>
              {/* Notch */}
              <div className="w-16 h-4 bg-[#111] rounded-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#1A1A1A]"></div>
              </div>
              <div className="flex items-center gap-1">
                <i className="ri-wifi-line text-white/60 text-[9px]"></i>
                <i className="ri-battery-2-charge-line text-white/60 text-[9px]"></i>
              </div>
            </div>

            {/* App screen */}
            <div className="bg-[#F8FAFC] px-3 pt-3 pb-4 flex flex-col gap-2.5">
              {/* App header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 flex items-center justify-center bg-[#059669] rounded-md">
                    <i className="ri-shield-check-line text-white text-[10px]"></i>
                  </div>
                  <span className="text-[10px] font-bold text-[#0F172A]">İSG Saha</span>
                </div>
                <div className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-gray-200">
                  <i className="ri-user-line text-[#64748B] text-[9px]"></i>
                </div>
              </div>

              {/* QR scan area */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 flex flex-col items-center gap-2">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  {/* QR frame corners */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#059669] rounded-tl-sm"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#059669] rounded-tr-sm"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#059669] rounded-bl-sm"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#059669] rounded-br-sm"></div>
                  {/* QR icon */}
                  <i className="ri-qr-code-line text-[#059669] text-3xl"></i>
                  {/* Scan line */}
                  <div className="absolute left-1 right-1 h-[1.5px] bg-[#059669]/50 top-1/2 -translate-y-1/2 rounded-full"></div>
                </div>
                <span className="text-[9px] text-[#64748B] font-medium">Ekipman QR kodunu okutun</span>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                {/* Kontrol Yap */}
                <div
                  className="bg-white rounded-xl border-2 border-[#059669] p-2.5 flex flex-col items-center gap-1.5"
                  style={{ boxShadow: "0 0 0 3px rgba(5,150,105,0.08)" }}
                >
                  <div className="w-7 h-7 flex items-center justify-center bg-[#F0FDF4] rounded-lg">
                    <i className="ri-checkbox-circle-line text-[#059669] text-sm"></i>
                  </div>
                  <span className="text-[9px] font-bold text-[#059669] text-center leading-tight">
                    Kontrol Yap
                  </span>
                </div>

                {/* Uygunsuzluk */}
                <div
                  className="bg-white rounded-xl border-2 border-[#F59E0B] p-2.5 flex flex-col items-center gap-1.5"
                  style={{ boxShadow: "0 0 0 3px rgba(245,158,11,0.08)" }}
                >
                  <div className="w-7 h-7 flex items-center justify-center bg-[#FFFBEB] rounded-lg">
                    <i className="ri-error-warning-line text-[#F59E0B] text-sm"></i>
                  </div>
                  <span className="text-[9px] font-bold text-[#F59E0B] text-center leading-tight">
                    Uygunsuzluk
                  </span>
                </div>
              </div>

              {/* Recent activity */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-2.5">
                <span className="text-[8px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Son İşlemler
                </span>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {[
                    { icon: "ri-checkbox-circle-line", color: "text-[#059669]", bg: "bg-[#F0FDF4]", label: "Yangın tüpü kontrol", time: "2dk" },
                    { icon: "ri-error-warning-line", color: "text-[#F59E0B]", bg: "bg-[#FFFBEB]", label: "Baret eksikliği", time: "15dk" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className={`w-5 h-5 flex items-center justify-center rounded-md ${item.bg} shrink-0`}>
                        <i className={`${item.icon} ${item.color} text-[10px]`}></i>
                      </div>
                      <span className="text-[8px] text-[#374151] flex-1 leading-tight">{item.label}</span>
                      <span className="text-[7px] text-[#94A3B8] whitespace-nowrap">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side buttons */}
        <div className="absolute -right-[3px] top-20 w-[3px] h-8 bg-[#2A2A2A] rounded-r-sm"></div>
        <div className="absolute -left-[3px] top-16 w-[3px] h-6 bg-[#2A2A2A] rounded-l-sm"></div>
        <div className="absolute -left-[3px] top-24 w-[3px] h-10 bg-[#2A2A2A] rounded-l-sm"></div>
      </div>
    </div>
  );
}
