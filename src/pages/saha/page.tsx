import { useState, useCallback } from "react";
import QRScanner from "./components/QRScanner";
import EquipmentCard from "./components/EquipmentCard";
import ActionModal from "./components/ActionModal";
import { mockEkipmanlar, mockIslemler, type Ekipman, type Islem } from "@/mocks/ekipmanlar";

type ModalType = "kontrol" | "uygunsuzluk" | null;

export default function SahaPage() {
  const [scannedEkipman, setScannedEkipman] = useState<Ekipman | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [islemler, setIslemler] = useState<Islem[]>(mockIslemler);

  const isMobile = window.innerWidth < 768;

  const handleScan = useCallback((result: string) => {
    const found = mockEkipmanlar.find(
      (e) => e.id === result || result.includes(e.id)
    );
    if (found) {
      setScannedEkipman(found);
      setNotFound(false);
    } else {
      setNotFound(true);
      setTimeout(() => setNotFound(false), 3000);
    }
  }, []);

  const handleReset = () => {
    setScannedEkipman(null);
    setNotFound(false);
  };

  const handleSubmit = (data: { aciklama: string; notlar?: string }) => {
    if (!scannedEkipman || !modal) return;
    const yeniIslem: Islem = {
      id: `ISL-${Date.now()}`,
      ekipman_id: scannedEkipman.id,
      tip: modal,
      aciklama: data.aciklama + (data.notlar ? ` — ${data.notlar}` : ""),
      tarih: new Date().toISOString(),
      kullanici: "Saha Kullanıcısı",
    };
    setIslemler((prev) => [yeniIslem, ...prev]);
  };

  // Desktop uyarısı
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 flex items-center justify-center bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0] mx-auto mb-5">
            <i className="ri-smartphone-line text-[#059669] text-3xl"></i>
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] mb-2">Mobil Cihaz Gerekli</h1>
          <p className="text-sm text-[#64748B] leading-relaxed">
            Bu sayfa QR kod okutma için tasarlanmıştır. Lütfen telefonunuzdan açın.
          </p>
          <div className="mt-6 bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <p className="text-xs text-[#94A3B8] mb-2">Test için bu QR kodları kullanabilirsiniz:</p>
            <div className="flex flex-col gap-1">
              {mockEkipmanlar.map((e) => (
                <span key={e.id} className="text-xs font-mono text-[#059669] bg-[#F0FDF4] rounded-lg px-3 py-1.5">
                  {e.id}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-[#059669] rounded-lg">
            <i className="ri-shield-check-line text-white text-sm"></i>
          </div>
          <span className="text-sm font-bold text-[#0F172A]">İSG Saha</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-[#94A3B8]">
            {new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
          </span>
          <div className="w-7 h-7 flex items-center justify-center rounded-full bg-[#F1F5F9]">
            <i className="ri-user-line text-[#64748B] text-sm"></i>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 overflow-y-auto">
        {scannedEkipman ? (
          <EquipmentCard
            ekipman={scannedEkipman}
            islemler={islemler}
            onKontrol={() => setModal("kontrol")}
            onUygunsuzluk={() => setModal("uygunsuzluk")}
            onReset={handleReset}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Title */}
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">QR Kod Okut</h1>
              <p className="text-xs text-[#64748B] mt-0.5">Ekipman QR kodunu kameraya tutun</p>
            </div>

            {/* Scanner */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
              <QRScanner onScan={handleScan} />
            </div>

            {/* Not found warning */}
            {notFound && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <i className="ri-error-warning-line text-red-500 text-base shrink-0"></i>
                <span className="text-sm text-red-600">Ekipman bulunamadı. Lütfen tekrar deneyin.</span>
              </div>
            )}

            {/* Quick access */}
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">
                Hızlı Erişim
              </p>
              <div className="flex flex-col gap-2">
                {mockEkipmanlar.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setScannedEkipman(e)}
                    className="flex items-center gap-3 bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 cursor-pointer text-left w-full"
                  >
                    <div className="w-8 h-8 flex items-center justify-center bg-[#F0FDF4] rounded-lg shrink-0">
                      <i className="ri-tools-line text-[#059669] text-sm"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{e.ad}</p>
                      <p className="text-[10px] text-[#94A3B8]">{e.id}</p>
                    </div>
                    <i className="ri-arrow-right-s-line text-[#CBD5E1]"></i>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && scannedEkipman && (
        <ActionModal
          type={modal}
          ekipmanAd={scannedEkipman.ad}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
