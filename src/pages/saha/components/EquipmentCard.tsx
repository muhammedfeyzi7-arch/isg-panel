import type { Ekipman, Islem } from "@/mocks/ekipmanlar";

interface EquipmentCardProps {
  ekipman: Ekipman;
  islemler: Islem[];
  onKontrol: () => void;
  onUygunsuzluk: () => void;
  onReset: () => void;
}

const durumConfig = {
  aktif: { label: "Aktif", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  bakim: { label: "Bakımda", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  arizali: { label: "Arızalı", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}dk önce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}sa önce`;
  return `${Math.floor(diffH / 24)}g önce`;
}

export default function EquipmentCard({
  ekipman,
  islemler,
  onKontrol,
  onUygunsuzluk,
  onReset,
}: EquipmentCardProps) {
  const durum = durumConfig[ekipman.durum];
  const ekipmanIslemleri = islemler.filter((i) => i.ekipman_id === ekipman.id);

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Back button */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-sm text-[#64748B] cursor-pointer whitespace-nowrap self-start"
      >
        <i className="ri-arrow-left-line"></i>
        <span>Yeni QR Okut</span>
      </button>

      {/* Equipment info card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] shrink-0">
              <i className="ri-tools-line text-[#059669] text-lg"></i>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] leading-tight">{ekipman.ad}</h2>
              <span className="text-xs text-[#64748B]">{ekipman.tip}</span>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${durum.bg} ${durum.text} whitespace-nowrap`}>
            <span className={`w-1.5 h-1.5 rounded-full ${durum.dot}`}></span>
            {durum.label}
          </span>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "ri-map-pin-line", label: "Konum", value: ekipman.konum },
            { icon: "ri-barcode-line", label: "Seri No", value: ekipman.seri_no },
            { icon: "ri-calendar-check-line", label: "Son Kontrol", value: formatDate(ekipman.son_kontrol) },
            { icon: "ri-calendar-2-line", label: "Sonraki Kontrol", value: formatDate(ekipman.sonraki_kontrol) },
          ].map((item) => (
            <div key={item.label} className="bg-[#F8FAFC] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <i className={`${item.icon} text-[#94A3B8] text-xs`}></i>
                <span className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wider">{item.label}</span>
              </div>
              <span className="text-xs font-semibold text-[#0F172A] leading-tight">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onKontrol}
          className="flex flex-col items-center gap-2 bg-white border-2 border-[#059669] rounded-2xl p-4 cursor-pointer whitespace-nowrap transition-all active:scale-95"
          style={{ boxShadow: "0 0 0 4px rgba(5,150,105,0.08)" }}
        >
          <div className="w-10 h-10 flex items-center justify-center bg-[#F0FDF4] rounded-xl">
            <i className="ri-checkbox-circle-line text-[#059669] text-xl"></i>
          </div>
          <span className="text-sm font-bold text-[#059669]">Kontrol Yap</span>
        </button>

        <button
          onClick={onUygunsuzluk}
          className="flex flex-col items-center gap-2 bg-white border-2 border-[#F59E0B] rounded-2xl p-4 cursor-pointer whitespace-nowrap transition-all active:scale-95"
          style={{ boxShadow: "0 0 0 4px rgba(245,158,11,0.08)" }}
        >
          <div className="w-10 h-10 flex items-center justify-center bg-[#FFFBEB] rounded-xl">
            <i className="ri-error-warning-line text-[#F59E0B] text-xl"></i>
          </div>
          <span className="text-sm font-bold text-[#F59E0B]">Uygunsuzluk</span>
        </button>
      </div>

      {/* Recent activity */}
      {ekipmanIslemleri.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
          <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Son İşlemler</span>
          <div className="mt-3 flex flex-col gap-3">
            {ekipmanIslemleri.map((islem) => (
              <div key={islem.id} className="flex items-start gap-3">
                <div className={`w-7 h-7 flex items-center justify-center rounded-lg shrink-0 ${
                  islem.tip === "kontrol" ? "bg-[#F0FDF4]" : "bg-[#FFFBEB]"
                }`}>
                  <i className={`text-sm ${
                    islem.tip === "kontrol"
                      ? "ri-checkbox-circle-line text-[#059669]"
                      : "ri-error-warning-line text-[#F59E0B]"
                  }`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#374151] leading-relaxed">{islem.aciklama}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#94A3B8]">{islem.kullanici}</span>
                    <span className="text-[10px] text-[#CBD5E1]">·</span>
                    <span className="text-[10px] text-[#94A3B8]">{formatTime(islem.tarih)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
