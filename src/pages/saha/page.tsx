import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import NonconformityForm from '@/pages/nonconformity/components/NonconformityForm';
import type { Uygunsuzluk } from '@/types';

// ── QR Tarayıcı bileşeni ──────────────────────────────────────────────────────
function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const animFrameRef = useRef<number>(0);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);
          scanLoop();
        }
      } catch {
        setError('Kamera erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edin.');
      }
    };

    const scanLoop = () => {
      if (!videoRef.current || !active) return;
      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          // BarcodeDetector API (modern browsers)
          if ('BarcodeDetector' in window) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            detector.detect(canvas).then((barcodes: { rawValue: string }[]) => {
              if (barcodes.length > 0 && active) {
                stopStream();
                onResult(barcodes[0].rawValue);
              } else {
                animFrameRef.current = requestAnimationFrame(scanLoop);
              }
            }).catch(() => {
              animFrameRef.current = requestAnimationFrame(scanLoop);
            });
            return;
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(scanLoop);
    };

    void startCamera();

    return () => {
      active = false;
      stopStream();
    };
  }, [onResult, stopStream]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 px-6 text-center">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <i className="ri-camera-off-line text-2xl" style={{ color: '#EF4444' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: '#F87171' }}>{error}</p>
        <button onClick={onClose} className="btn-secondary whitespace-nowrap">Kapat</button>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ maxWidth: '360px', margin: '0 auto' }}>
      <video
        ref={videoRef}
        className="w-full rounded-2xl object-cover"
        style={{ height: '280px', background: '#0F172A' }}
        playsInline
        muted
      />
      {/* Tarama çerçevesi */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-44 h-44">
          {/* Köşe çizgileri */}
          {[
            'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
            'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
            'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
            'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
          ].map((cls, i) => (
            <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#34D399' }} />
          ))}
          {/* Tarama çizgisi animasyonu */}
          {scanning && (
            <div
              className="absolute left-2 right-2 h-0.5 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #34D399, transparent)',
                animation: 'scanLine 2s ease-in-out infinite',
                top: '50%',
              }}
            />
          )}
        </div>
      </div>
      <p className="text-center text-xs mt-3 font-medium" style={{ color: '#64748B' }}>
        QR kodu çerçeve içine getirin
      </p>
      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-40px); opacity: 0.3; }
          50% { transform: translateY(40px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Son İşlemler ──────────────────────────────────────────────────────────────
function SonIslemler() {
  const { uygunsuzluklar, ekipmanlar, firmalar } = useApp();

  const items = [
    ...uygunsuzluklar
      .filter(u => !u.silinmis && !u.cascadeSilindi)
      .slice(0, 3)
      .map(u => ({
        id: u.id,
        tip: 'uygunsuzluk' as const,
        baslik: u.baslik,
        firma: firmalar.find(f => f.id === u.firmaId)?.ad ?? '',
        tarih: u.olusturmaTarihi ?? u.tarih ?? '',
        durum: u.durum,
        severity: u.severity,
      })),
    ...ekipmanlar
      .filter(e => !e.silinmis && e.sonKontrolTarihi)
      .sort((a, b) => (b.sonKontrolTarihi ?? '').localeCompare(a.sonKontrolTarihi ?? ''))
      .slice(0, 2)
      .map(e => ({
        id: e.id,
        tip: 'ekipman' as const,
        baslik: e.ad,
        firma: firmalar.find(f => f.id === e.firmaId)?.ad ?? '',
        tarih: e.sonKontrolTarihi ?? '',
        durum: e.durum,
        severity: '',
      })),
  ]
    .sort((a, b) => b.tarih.localeCompare(a.tarih))
    .slice(0, 5);

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <i className="ri-inbox-line text-3xl" style={{ color: '#334155' }} />
        <p className="text-xs mt-2" style={{ color: '#475569' }}>Henüz işlem yok</p>
      </div>
    );
  }

  const fmtTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins}dk`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}sa`;
    return `${Math.floor(hrs / 24)}g`;
  };

  return (
    <div className="space-y-2">
      {items.map(item => {
        const isUyg = item.tip === 'uygunsuzluk';
        const color = isUyg
          ? (item.durum === 'Kapandı' ? '#22C55E' : item.severity === 'Kritik' ? '#EF4444' : '#F97316')
          : '#34D399';
        const icon = isUyg
          ? (item.durum === 'Kapandı' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line')
          : 'ri-tools-line';

        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ background: `${color}18` }}
            >
              <i className={`${icon} text-sm`} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.baslik}</p>
              {item.firma && (
                <p className="text-xs truncate" style={{ color: '#475569' }}>{item.firma}</p>
              )}
            </div>
            <span className="text-xs flex-shrink-0 font-medium" style={{ color: '#334155' }}>
              {fmtTime(item.tarih)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Ana Saha Sayfası ──────────────────────────────────────────────────────────
export default function SahaPage() {
  const { ekipmanlar, firmalar, addToast, setActiveModule } = useApp();
  const { canCreate } = usePermissions();

  const [showQr, setShowQr] = useState(false);
  const [showUygunsuzlukForm, setShowUygunsuzlukForm] = useState(false);
  const [qrResult, setQrResult] = useState<string | null>(null);

  const handleQrResult = useCallback((text: string) => {
    setShowQr(false);
    setQrResult(text);

    // QR URL'den ekipman ID'sini çıkar
    // Format: .../equipment/qr/{id}
    const match = text.match(/\/equipment\/qr\/([^/?#]+)/);
    if (match) {
      const ekipmanId = match[1];
      const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
      if (ekipman) {
        addToast(`Ekipman bulundu: ${ekipman.ad}`, 'success');
        // Ekipman sayfasına yönlendir
        setActiveModule('ekipmanlar');
        // Kısa gecikme ile kayıt aç
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('isg_open_record', {
            detail: { module: 'ekipmanlar', recordId: ekipmanId },
          }));
        }, 300);
        return;
      }
    }

    // Genel URL ise yeni sekmede aç
    if (text.startsWith('http')) {
      addToast('QR kodu okundu — yönlendiriliyor...', 'success');
      window.open(text, '_blank', 'noopener,noreferrer');
    } else {
      addToast(`QR içeriği: ${text}`, 'info');
    }
  }, [ekipmanlar, addToast, setActiveModule]);

  const aktifEkipmanlar = ekipmanlar.filter(e => !e.silinmis);
  const uygunDegil = aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length;
  const yaklasan = aktifEkipmanlar.filter(e => {
    if (!e.sonrakiKontrolTarihi) return false;
    const diff = Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 3;
  }).length;

  return (
    <div className="space-y-5 pb-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>İSG Saha</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Hızlı saha işlemleri</p>
        </div>
        <div
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}
        >
          <i className="ri-shield-check-line text-sm" style={{ color: '#34D399' }} />
        </div>
      </div>

      {/* Uyarı kartları */}
      {(uygunDegil > 0 || yaklasan > 0) && (
        <div className="space-y-2">
          {uygunDegil > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <i className="ri-error-warning-fill text-base" style={{ color: '#EF4444' }} />
              <p className="text-sm font-semibold" style={{ color: '#F87171' }}>
                {uygunDegil} ekipman uygun değil
              </p>
              <button
                onClick={() => setActiveModule('ekipmanlar')}
                className="ml-auto text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ color: '#EF4444' }}
              >
                Görüntüle →
              </button>
            </div>
          )}
          {yaklasan > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              <i className="ri-time-line text-base" style={{ color: '#FBBF24' }} />
              <p className="text-sm font-semibold" style={{ color: '#FCD34D' }}>
                {yaklasan} ekipman kontrolü yaklaşıyor
              </p>
              <button
                onClick={() => setActiveModule('ekipmanlar')}
                className="ml-auto text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ color: '#FBBF24' }}
              >
                Görüntüle →
              </button>
            </div>
          )}
        </div>
      )}

      {/* QR Tarama Alanı */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
      >
        {showQr ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>QR Kod Tara</p>
              <button
                onClick={() => setShowQr(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
          </div>
        ) : (
          <button
            onClick={() => setShowQr(true)}
            className="w-full flex flex-col items-center justify-center gap-3 py-8 cursor-pointer transition-all duration-200"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {/* QR çerçeve ikonu */}
            <div className="relative">
              <div
                className="w-20 h-20 flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(52,211,153,0.08)', border: '2px dashed rgba(52,211,153,0.3)' }}
              >
                <i className="ri-qr-code-line text-4xl" style={{ color: '#34D399' }} />
              </div>
              {/* Köşe aksan */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 rounded-tl-md" style={{ borderColor: '#34D399' }} />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 rounded-tr-md" style={{ borderColor: '#34D399' }} />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 rounded-bl-md" style={{ borderColor: '#34D399' }} />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 rounded-br-md" style={{ borderColor: '#34D399' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold" style={{ color: '#34D399' }}>Ekipman QR kodunu okutun</p>
              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Kameraya erişim gereklidir</p>
            </div>
          </button>
        )}
      </div>

      {/* Hızlı Aksiyonlar */}
      <div className="grid grid-cols-2 gap-3">
        {/* Kontrol Yap */}
        <button
          onClick={() => setActiveModule('ekipmanlar')}
          className="flex flex-col items-center justify-center gap-2.5 py-5 rounded-2xl cursor-pointer transition-all duration-200"
          style={{
            background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.14)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.08)'; }}
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#34D399' }} />
          </div>
          <span className="text-sm font-bold" style={{ color: '#34D399' }}>Kontrol Yap</span>
        </button>

        {/* Uygunsuzluk Bildir */}
        <button
          onClick={() => {
            if (canCreate) {
              setShowUygunsuzlukForm(true);
            } else {
              setActiveModule('uygunsuzluklar');
            }
          }}
          className="flex flex-col items-center justify-center gap-2.5 py-5 rounded-2xl cursor-pointer transition-all duration-200"
          style={{
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.14)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; }}
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: 'rgba(251,191,36,0.15)' }}>
            <i className="ri-error-warning-line text-2xl" style={{ color: '#FBBF24' }} />
          </div>
          <span className="text-sm font-bold" style={{ color: '#FBBF24' }}>Uygunsuzluk</span>
        </button>
      </div>

      {/* Hızlı Erişim Linkleri */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Ekipmanlar', icon: 'ri-tools-line', module: 'ekipmanlar', color: '#818CF8' },
          { label: 'Saha Denetim', icon: 'ri-map-pin-user-line', module: 'uygunsuzluklar', color: '#F97316' },
          { label: 'İş İzni', icon: 'ri-shield-keyhole-line', module: 'is-izinleri', color: '#06B6D4' },
        ].map(item => (
          <button
            key={item.module}
            onClick={() => setActiveModule(item.module)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl cursor-pointer transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: `${item.color}18` }}>
              <i className={`${item.icon} text-base`} style={{ color: item.color }} />
            </div>
            <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: '#64748B' }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Son İşlemler */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>
          SON İŞLEMLER
        </p>
        <SonIslemler />
      </div>

      {/* Firma Özeti */}
      {firmalar.filter(f => !f.silinmis).length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>
            AKTİF FİRMALAR
          </p>
          <div className="space-y-2">
            {firmalar.filter(f => !f.silinmis).slice(0, 4).map(firma => {
              const firmaEkipman = aktifEkipmanlar.filter(e => e.firmaId === firma.id);
              const firmaUygunsuz = firmaEkipman.filter(e => e.durum === 'Uygun Değil').length;
              return (
                <div
                  key={firma.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  onClick={() => setActiveModule('firmalar')}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
                  >
                    {(firma.ad || 'F').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{firma.ad}</p>
                    <p className="text-xs" style={{ color: '#475569' }}>{firmaEkipman.length} ekipman</p>
                  </div>
                  {firmaUygunsuz > 0 && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
                    >
                      {firmaUygunsuz} sorun
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Uygunsuzluk Formu */}
      <NonconformityForm
        isOpen={showUygunsuzlukForm}
        onClose={() => setShowUygunsuzlukForm(false)}
        editRecord={null}
      />
    </div>
  );
}
