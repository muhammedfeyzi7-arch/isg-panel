import { useState } from "react";

interface ActionModalProps {
  type: "kontrol" | "uygunsuzluk";
  ekipmanAd: string;
  onClose: () => void;
  onSubmit: (data: { aciklama: string; notlar?: string }) => void;
}

export default function ActionModal({ type, ekipmanAd, onClose, onSubmit }: ActionModalProps) {
  const [aciklama, setAciklama] = useState("");
  const [notlar, setNotlar] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isKontrol = type === "kontrol";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aciklama.trim()) return;
    onSubmit({ aciklama, notlar });
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-10 animate-slide-up">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className={`w-16 h-16 flex items-center justify-center rounded-full ${
              isKontrol ? "bg-[#F0FDF4]" : "bg-[#FFFBEB]"
            }`}>
              <i className={`text-3xl ${
                isKontrol ? "ri-checkbox-circle-line text-[#059669]" : "ri-error-warning-line text-[#F59E0B]"
              }`}></i>
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-[#0F172A]">
                {isKontrol ? "Kontrol kaydedildi!" : "Uygunsuzluk bildirildi!"}
              </h3>
              <p className="text-sm text-[#64748B] mt-1">İşlem başarıyla tamamlandı.</p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 w-full bg-[#0F172A] text-white text-sm font-semibold rounded-xl py-3 cursor-pointer whitespace-nowrap"
            >
              Tamam
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl ${
                  isKontrol ? "bg-[#F0FDF4]" : "bg-[#FFFBEB]"
                }`}>
                  <i className={`text-lg ${
                    isKontrol ? "ri-checkbox-circle-line text-[#059669]" : "ri-error-warning-line text-[#F59E0B]"
                  }`}></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    {isKontrol ? "Kontrol Yap" : "Uygunsuzluk Bildir"}
                  </h3>
                  <p className="text-xs text-[#94A3B8] truncate max-w-[180px]">{ekipmanAd}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F1F5F9] cursor-pointer"
              >
                <i className="ri-close-line text-[#64748B] text-base"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Açıklama */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  {isKontrol ? "Kontrol Sonucu" : "Uygunsuzluk Açıklaması"}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <textarea
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value.slice(0, 500))}
                  placeholder={
                    isKontrol
                      ? "Kontrol sonucunu kısaca açıklayın..."
                      : "Uygunsuzluğu detaylı açıklayın..."
                  }
                  rows={3}
                  maxLength={500}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:border-[#059669] resize-none"
                />
                <span className="text-[10px] text-[#CBD5E1] float-right">{aciklama.length}/500</span>
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Ek Notlar <span className="text-[#94A3B8] font-normal">(isteğe bağlı)</span>
                </label>
                <input
                  type="text"
                  value={notlar}
                  onChange={(e) => setNotlar(e.target.value)}
                  placeholder="Varsa ek bilgi ekleyin..."
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:border-[#059669]"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!aciklama.trim()}
                className={`w-full text-white text-sm font-semibold rounded-xl py-3 cursor-pointer whitespace-nowrap transition-opacity ${
                  isKontrol ? "bg-[#059669]" : "bg-[#F59E0B]"
                } disabled:opacity-40`}
              >
                {isKontrol ? "Kontrolü Kaydet" : "Uygunsuzluğu Bildir"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
