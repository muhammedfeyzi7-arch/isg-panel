import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import NonconformityForm from '@/pages/nonconformity/components/NonconformityForm';
import Modal from '@/components/base/Modal';
import type { Ekipman, EkipmanStatus } from '@/types';
import { useOfflineQueue, type OfflineQueueItem } from '@/hooks/useOfflineQueue';

// jsQR'ı modül seviyesinde bir kere yükle
let jsQRModule: ((data: Uint8ClampedArray, width: number, height: number, opts?: { inversionAttempts?: string }) => { data: string } | null) | null = null;
let jsQRLoading = false;
const jsQRCallbacks: Array<() => void> = [];

function loadJsQR(): Promise<void> {
  return new Promise((resolve) => {
    if (jsQRModule) { resolve(); return; }
    jsQRCallbacks.push(resolve);
    if (jsQRLoading) return;
    jsQRLoading = true;
    import('jsqr').then((mod) => {
      jsQRModule = mod.default;
      jsQRLoading = false;
      jsQRCallbacks.forEach(cb => cb());
      jsQRCallbacks.length = 0;
    }).catch(() => {
      jsQRLoading = false;
      jsQRCallbacks.forEach(cb => cb());
      jsQRCallbacks.length = 0;
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline Durum Bandı
// ─────────────────────────────────────────────────────────────────────────────
interface OfflineBandProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncError: string | null;
  onSyncNow: () => void;
  onShowDetails: () => void;
}

function OfflineBand({
  isOnline, isSyncing, pendingCount, lastSyncAt, syncError, onSyncNow, onShowDetails,
}: OfflineBandProps) {
  const fmtTime = (d: Date) => d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  if (isOnline && pendingCount === 0 && !syncError) {
    // Online ve temiz — sadece küçük yeşil gösterge
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
        <span className="text-xs font-medium flex-1" style={{ color: '#34D399' }}>Çevrimiçi</span>
        {lastSyncAt && (
          <span className="text-[10px]" style={{ color: '#334155' }}>
            Son sync: {fmtTime(lastSyncAt)}
          </span>
        )}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
        onClick={onShowDetails}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(251,191,36,0.15)' }}>
          <i className="ri-wifi-off-line text-sm" style={{ color: '#FBBF24' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: '#FCD34D' }}>Çevrimdışı Mod</p>
          <p className="text-xs" style={{ color: '#92400E' }}>
            {pendingCount > 0
              ? `${pendingCount} işlem bekliyor — bağlantı gelince otomatik gönderilir`
              : 'İşlemler kaydedilir, bağlantı gelince gönderilir'}
          </p>
        </div>
        {pendingCount > 0 && (
          <span
            className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.2)', color: '#FBBF24' }}
          >
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // Online ama bekleyen işlem var veya hata
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{
        background: syncError ? 'rgba(239,68,68,0.06)' : 'rgba(99,102,241,0.06)',
        border: `1px solid ${syncError ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`,
      }}
    >
      <div
        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: syncError ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)' }}
      >
        {isSyncing ? (
          <i className="ri-loader-4-line text-sm animate-spin" style={{ color: '#818CF8' }} />
        ) : syncError ? (
          <i className="ri-error-warning-line text-sm" style={{ color: '#EF4444' }} />
        ) : (
          <i className="ri-upload-cloud-2-line text-sm" style={{ color: '#818CF8' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: syncError ? '#F87171' : '#A5B4FC' }}>
          {isSyncing ? 'Senkronize ediliyor...' : syncError ? 'Sync hatası' : `${pendingCount} işlem bekliyor`}
        </p>
        <p className="text-xs truncate" style={{ color: '#475569' }}>
          {syncError ?? 'Çevrimdışıyken kaydedilen işlemler gönderiliyor'}
        </p>
      </div>
      {!isSyncing && (
        <button
          onClick={onSyncNow}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          Şimdi Gönder
        </button>
      )}
      {pendingCount > 0 && (
        <button
          onClick={onShowDetails}
          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#64748B' }}
        >
          <i className="ri-list-check text-xs" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bekleyen İşlemler Modal
// ─────────────────────────────────────────────────────────────────────────────
function PendingModal({
  open,
  onClose,
  items,
  isOnline,
  isSyncing,
  onSyncNow,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  items: OfflineQueueItem[];
  isOnline: boolean;
  isSyncing: boolean;
  onSyncNow: () => void;
  onClear: () => void;
}) {
  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const typeLabel = (type: string) => {
    if (type === 'ekipman_kontrol') return 'Kontrol Kaydı';
    if (type === 'ekipman_durum') return 'Durum Değişikliği';
    return type;
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Bekleyen İşlemler" size="md" icon="ri-time-line">
      <div className="space-y-4">
        {/* Durum */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{
            background: isOnline ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)',
            border: `1px solid ${isOnline ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`,
          }}
        >
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOnline ? '#34D399' : '#FBBF24' }} />
          <p className="text-sm font-semibold flex-1" style={{ color: isOnline ? '#34D399' : '#FCD34D' }}>
            {isOnline ? 'Çevrimiçi — işlemler gönderilebilir' : 'Çevrimdışı — bağlantı bekleniyor'}
          </p>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
            {items.length} işlem
          </span>
        </div>

        {/* Liste */}
        {items.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-checkbox-circle-line text-3xl" style={{ color: '#34D399' }} />
            <p className="text-sm mt-2 font-medium" style={{ color: '#34D399' }}>Tüm işlemler gönderildi!</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '320px' }}>
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(251,191,36,0.1)' }}
                >
                  <i className="ri-time-line text-sm" style={{ color: '#FBBF24' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.label}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
                    >
                      {typeLabel(item.type)}
                    </span>
                    {item.retryCount > 0 && (
                      <span className="text-[10px]" style={{ color: '#EF4444' }}>
                        {item.retryCount} deneme
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: '#334155' }}>
                  {fmtTime(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Açıklama */}
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#475569' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>
            Çevrimdışıyken yapılan kontrol ve durum güncellemeleri burada bekler.
            İnternet bağlantısı kurulunca otomatik olarak sunucuya gönderilir.
          </p>
        </div>

        {/* Butonlar */}
        <div className="flex gap-3">
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}
            >
              <i className="ri-delete-bin-line text-xs" />
              Kuyruğu Temizle
            </button>
          )}
          <div className="flex-1" />
          {isOnline && items.length > 0 && (
            <button
              onClick={() => { onSyncNow(); onClose(); }}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', opacity: isSyncing ? 0.7 : 1 }}
            >
              {isSyncing ? (
                <><i className="ri-loader-4-line animate-spin text-xs" />Gönderiliyor...</>
              ) : (
                <><i className="ri-upload-cloud-2-line text-xs" />Şimdi Gönder</>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Tarayıcı
// ─────────────────────────────────────────────────────────────────────────────
function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(true);
  const detectorRef = useRef<{ detect: (src: HTMLCanvasElement) => Promise<{ rawValue: string }[]> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleFound = useCallback((text: string) => {
    stopAll();
    onResult(text);
  }, [stopAll, onResult]);

  useEffect(() => {
    activeRef.current = true;

    if ('BarcodeDetector' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detectorRef.current = null;
      }
    }

    void loadJsQR();

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        await video.play();
        setReady(true);
        requestAnimationFrame(tick);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
          setError('Kamera izni reddedildi. Tarayıcı ayarlarından kamera iznini açın.');
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
          setError('Kamera bulunamadı.');
        } else {
          setError('Kamera başlatılamadı: ' + msg);
        }
      }
    };

    const tick = async () => {
      if (!activeRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (detectorRef.current) {
        try {
          const codes = await detectorRef.current.detect(canvas);
          if (codes.length > 0 && activeRef.current) { handleFound(codes[0].rawValue); return; }
        } catch { detectorRef.current = null; }
      }

      if (jsQRModule) {
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQRModule(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
          if (code && activeRef.current) { handleFound(code.data); return; }
        } catch { /* ignore */ }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    void start();
    return () => { stopAll(); };
  }, [handleFound, stopAll]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
        <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <i className="ri-camera-off-line text-2xl" style={{ color: '#EF4444' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: '#F87171' }}>{error}</p>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>
          Kapat
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ maxWidth: '360px', margin: '0 auto' }}>
      <div className="relative rounded-2xl overflow-hidden" style={{ height: '280px', background: '#0A0F1E' }}>
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 52% 52% at 50% 50%, transparent 0%, rgba(0,0,0,0.65) 100%)' }} />
          <div className="relative z-10" style={{ width: '180px', height: '180px' }}>
            {['top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl', 'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl', 'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl', 'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl'].map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#34D399' }} />
            ))}
            {ready && (
              <div className="absolute left-2 right-2 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #34D399, transparent)', animation: 'qrScan 2s ease-in-out infinite', top: '10%' }} />
            )}
          </div>
        </div>
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: ready ? '#34D399' : '#FBBF24', animation: ready ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
            <span className="text-xs font-medium" style={{ color: '#E2E8F0' }}>{!ready ? 'Kamera başlatılıyor...' : 'QR aranıyor...'}</span>
          </div>
        </div>
      </div>
      <p className="text-center text-xs mt-3 font-medium" style={{ color: '#64748B' }}>QR kodu çerçeve içine getirin — otomatik okunur</p>
      <style>{`
        @keyframes qrScan { 0% { top: 10%; opacity: 0.5; } 50% { top: 82%; opacity: 1; } 100% { top: 10%; opacity: 0.5; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Durum konfigürasyonu
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<EkipmanStatus, { label: string; color: string; bg: string; icon: string }> = {
  'Uygun':       { label: 'Uygun',       color: '#34D399', bg: 'rgba(52,211,153,0.12)',  icon: 'ri-checkbox-circle-line' },
  'Uygun Değil': { label: 'Uygun Değil', color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
  'Bakımda':     { label: 'Bakımda',     color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  icon: 'ri-time-line' },
  'Hurda':       { label: 'Hurda',       color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-delete-bin-line' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Ekipman Listesi Modal
// ─────────────────────────────────────────────────────────────────────────────
function EkipmanListeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ekipmanlar, firmalar } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const aktif = ekipmanlar.filter(e => !e.silinmis);
  const filtered = aktif.filter(e => {
    const firma = firmalar.find(f => f.id === e.firmaId);
    const q = search.toLowerCase();
    const matchQ = !q || e.ad.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false) || e.seriNo.toLowerCase().includes(q);
    const matchS = !statusFilter || e.durum === statusFilter;
    return matchQ && matchS;
  });

  const getDays = (dateStr: string) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Ekipman Kontrolleri" size="lg" icon="ri-tools-line">
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Toplam', val: aktif.length, color: '#818CF8' },
          { label: 'Uygun', val: aktif.filter(e => e.durum === 'Uygun').length, color: '#34D399' },
          { label: 'Uygun Değil', val: aktif.filter(e => e.durum === 'Uygun Değil').length, color: '#F87171' },
          { label: 'Yaklaşan', val: aktif.filter(e => { const d = getDays(e.sonrakiKontrolTarihi); return d !== null && d >= 0 && d <= 7; }).length, color: '#FBBF24' },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-lg font-bold" style={{ color: s.color }}>{s.val}</span>
            <span className="text-[10px] mt-0.5 font-medium text-center" style={{ color: '#475569' }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ekipman veya firma ara..." className="isg-input pl-8 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input text-sm" style={{ minWidth: '130px' }}>
          <option value="">Tüm Durumlar</option>
          {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '400px' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-12"><i className="ri-tools-line text-3xl" style={{ color: '#334155' }} /><p className="text-sm mt-2" style={{ color: '#475569' }}>Ekipman bulunamadı</p></div>
        ) : filtered.map(ekipman => {
          const firma = firmalar.find(f => f.id === ekipman.firmaId);
          const sc = STATUS_CFG[ekipman.durum] ?? STATUS_CFG['Uygun'];
          const days = getDays(ekipman.sonrakiKontrolTarihi);
          const isOverdue = days !== null && days < 0;
          const isUrgent = days !== null && days >= 0 && days <= 7;
          return (
            <div key={ekipman.id} className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : isUrgent ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)'}` }}>
              <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: sc.bg }}>
                <i className={`${sc.icon} text-base`} style={{ color: sc.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ekipman.ad}</p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {firma && <span className="text-xs" style={{ color: '#475569' }}><i className="ri-building-2-line mr-0.5" />{firma.ad}</span>}
                  {ekipman.tur && <span className="text-xs" style={{ color: '#334155' }}>· {ekipman.tur}</span>}
                </div>
                {ekipman.sonrakiKontrolTarihi && (
                  <div className="flex items-center gap-1 mt-1">
                    <i className="ri-calendar-line text-[10px]" style={{ color: isOverdue ? '#EF4444' : isUrgent ? '#FBBF24' : '#334155' }} />
                    <span className="text-[10px] font-medium" style={{ color: isOverdue ? '#F87171' : isUrgent ? '#FCD34D' : '#475569' }}>
                      {isOverdue ? `${Math.abs(days!)} gün gecikmiş` : isUrgent ? `${days} gün kaldı` : new Date(ekipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                )}
              </div>
              {ekipman.seriNo && <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#334155' }}>{ekipman.seriNo}</span>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Ekipman Kartı — offline destekli
// ─────────────────────────────────────────────────────────────────────────────
function QrEkipmanKart({
  ekipman,
  onClose,
  onKontrolYapildi,
  onDurumDegistir,
  isOnline,
}: {
  ekipman: Ekipman;
  onClose: () => void;
  onKontrolYapildi: (ekipmanId: string) => void;
  onDurumDegistir: (ekipmanId: string, durum: EkipmanStatus) => void;
  isOnline: boolean;
}) {
  const { firmalar } = useApp();
  const sc = STATUS_CFG[ekipman.durum] ?? STATUS_CFG['Uygun'];
  const firma = firmalar.find(f => f.id === ekipman.firmaId);
  const days = ekipman.sonrakiKontrolTarihi
    ? Math.ceil((new Date(ekipman.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.25)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-qr-code-line text-sm" style={{ color: '#34D399' }} />
          </div>
          <span className="text-xs font-bold" style={{ color: '#34D399' }}>QR ile Bulunan Ekipman</span>
          {!isOnline && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>
              Çevrimdışı
            </span>
          )}
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
          <i className="ri-close-line text-xs" />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: sc.bg }}>
          <i className={`${sc.icon} text-xl`} style={{ color: sc.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{ekipman.ad}</p>
          {firma && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{firma.ad}</p>}
          {ekipman.tur && <p className="text-xs" style={{ color: '#334155' }}>{ekipman.tur}</p>}
          {ekipman.seriNo && <p className="text-[10px] font-mono mt-0.5" style={{ color: '#334155' }}>S/N: {ekipman.seriNo}</p>}
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
      </div>

      {days !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3" style={{ background: days < 0 ? 'rgba(239,68,68,0.08)' : days <= 7 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${days < 0 ? 'rgba(239,68,68,0.2)' : days <= 7 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
          <i className="ri-calendar-line text-xs" style={{ color: days < 0 ? '#EF4444' : days <= 7 ? '#FBBF24' : '#475569' }} />
          <span className="text-xs font-medium" style={{ color: days < 0 ? '#F87171' : days <= 7 ? '#FCD34D' : '#64748B' }}>
            {days < 0 ? `Kontrol ${Math.abs(days)} gün gecikmiş!` : days === 0 ? 'Kontrol bugün yapılmalı!' : days <= 7 ? `Kontrol ${days} gün içinde yapılmalı` : `Sonraki kontrol: ${new Date(ekipman.sonrakiKontrolTarihi!).toLocaleDateString('tr-TR')}`}
          </span>
        </div>
      )}

      {/* Kontrol Yaptım */}
      <button
        onClick={() => onKontrolYapildi(ekipman.id)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-3"
        style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.25)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.15)'; }}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <i className={`${!isOnline ? 'ri-save-line' : 'ri-checkbox-circle-line'} text-base`} style={{ color: '#34D399' }} />
        </div>
        <span className="text-sm font-bold" style={{ color: '#34D399' }}>
          {!isOnline ? 'Kontrol Yaptım (Çevrimdışı Kaydedilir)' : 'Kontrol Yaptım'}
        </span>
      </button>

      {/* Durum Değiştir */}
      <div>
        <p className="text-[10px] font-semibold mb-2 uppercase tracking-wide" style={{ color: '#475569' }}>Durum Değiştir</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(['Uygun', 'Uygun Değil', 'Bakımda', 'Hurda'] as EkipmanStatus[]).map(d => {
            const cfg = STATUS_CFG[d];
            const isActive = ekipman.durum === d;
            return (
              <button key={d} onClick={() => onDurumDegistir(ekipman.id, d)} className="py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all duration-150 whitespace-nowrap" style={{ background: isActive ? cfg.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? cfg.color + '80' : 'rgba(255,255,255,0.08)'}`, color: isActive ? cfg.color : '#64748B' }}>
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Son İşlemler
// ─────────────────────────────────────────────────────────────────────────────
function SonIslemler() {
  const { uygunsuzluklar, ekipmanlar, firmalar } = useApp();

  const items = useMemo(() => {
    const uyg = uygunsuzluklar
      .filter(u => !u.silinmis && !u.cascadeSilindi)
      .sort((a, b) => (b.olusturmaTarihi ?? b.tarih ?? '').localeCompare(a.olusturmaTarihi ?? a.tarih ?? ''))
      .slice(0, 5)
      .map(u => ({
        id: u.id, tip: 'Uygunsuzluk' as const,
        baslik: u.baslik, firma: firmalar.find(f => f.id === u.firmaId)?.ad ?? '',
        tarih: u.olusturmaTarihi ?? u.tarih ?? '', durum: u.durum, severity: u.severity,
        tipColor: '#F97316', tipBg: 'rgba(249,115,22,0.12)',
        icon: u.durum === 'Kapandı' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line',
        iconColor: u.severity === 'Kritik' ? '#EF4444' : u.severity === 'Yüksek' ? '#F97316' : '#FBBF24',
        durumColor: u.durum === 'Kapandı' ? '#22C55E' : '#EF4444',
        durumBg: u.durum === 'Kapandı' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      }));

    const ekp = ekipmanlar
      .filter(e => !e.silinmis && e.sonKontrolTarihi)
      .sort((a, b) => (b.sonKontrolTarihi ?? '').localeCompare(a.sonKontrolTarihi ?? ''))
      .slice(0, 4)
      .map(e => {
        const sc = STATUS_CFG[e.durum] ?? STATUS_CFG['Uygun'];
        return {
          id: e.id, tip: 'Ekipman Kontrolü' as const,
          baslik: e.ad, firma: firmalar.find(f => f.id === e.firmaId)?.ad ?? '',
          tarih: e.sonKontrolTarihi ?? '', durum: e.durum,
          tipColor: '#34D399', tipBg: 'rgba(52,211,153,0.12)',
          icon: sc.icon, iconColor: sc.color, durumColor: sc.color, durumBg: sc.bg,
        };
      });

    return [...uyg, ...ekp].sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, 7);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uygunsuzluklar, ekipmanlar, firmalar]);

  const fmtTime = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} sa önce`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} gün önce`;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <i className="ri-inbox-line text-3xl" style={{ color: '#334155' }} />
        <p className="text-xs mt-2 font-medium" style={{ color: '#475569' }}>Henüz kayıt yok</p>
        <p className="text-[10px] mt-0.5" style={{ color: '#334155' }}>Uygunsuzluk veya ekipman kontrolü eklenince burada görünür</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={`${item.tip}-${item.id}`} className="flex items-start gap-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: `${item.iconColor}18` }}>
            <i className={`${item.icon} text-sm`} style={{ color: item.iconColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ background: item.tipBg, color: item.tipColor }}>{item.tip}</span>
              {'severity' in item && item.severity && <span className="text-[9px] font-semibold" style={{ color: item.iconColor }}>{item.severity}</span>}
            </div>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.baslik}</p>
            {item.firma && <p className="text-xs truncate mt-0.5" style={{ color: '#475569' }}><i className="ri-building-2-line mr-0.5" />{item.firma}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ background: item.durumBg, color: item.durumColor }}>{item.durum}</span>
            <span className="text-[10px]" style={{ color: '#334155' }}>{fmtTime(item.tarih)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Firma Özeti
// ─────────────────────────────────────────────────────────────────────────────
function FirmaOzeti() {
  const { firmalar, ekipmanlar } = useApp();

  const firmaStats = useMemo(() => {
    return firmalar.filter(f => !f.silinmis).map(firma => {
      const firmaEkipman = ekipmanlar.filter(e => e.firmaId === firma.id && !e.silinmis);
      const uygunDegil = firmaEkipman.filter(e => e.durum === 'Uygun Değil').length;
      const gecikmis = firmaEkipman.filter(e => e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()).length;
      const yaklasan = firmaEkipman.filter(e => {
        if (!e.sonrakiKontrolTarihi) return false;
        const d = Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000);
        return d >= 0 && d <= 7;
      }).length;
      return { ...firma, toplam: firmaEkipman.length, uygunDegil, yaklasan, gecikmis, sorunlu: uygunDegil + gecikmis };
    }).filter(f => f.toplam > 0).sort((a, b) => b.sorunlu - a.sorunlu);
  }, [firmalar, ekipmanlar]);

  if (firmaStats.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>FİRMA EKİPMAN ÖZETİ</p>
        <span className="text-[10px]" style={{ color: '#334155' }}>{firmaStats.length} firma</span>
      </div>
      <div className="space-y-2">
        {firmaStats.slice(0, 6).map(firma => (
          <div key={firma.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${firma.sorunlu > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)'}` }}>
            <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
              {(firma.ad || 'F').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{firma.ad}</p>
              <p className="text-xs" style={{ color: '#475569' }}>{firma.toplam} ekipman</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              {firma.gecikmis > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>{firma.gecikmis} gecikmiş</span>}
              {firma.uygunDegil > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>{firma.uygunDegil} uygun değil</span>}
              {firma.yaklasan > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>{firma.yaklasan} yaklaşan</span>}
              {firma.sorunlu === 0 && firma.yaklasan === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>Sorun yok</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ana Saha Sayfası
// ─────────────────────────────────────────────────────────────────────────────
export default function SahaPage() {
  const { ekipmanlar, updateEkipman, addToast, ekipmanKontrolBildirimi } = useApp();

  const [showQr, setShowQr] = useState(false);
  const [showUygunsuzlukForm, setShowUygunsuzlukForm] = useState(false);
  const [showEkipmanModal, setShowEkipmanModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [qrFoundEkipman, setQrFoundEkipman] = useState<Ekipman | null>(null);

  // Offline queue — işlemleri uygula
  const applyQueueItem = useCallback(async (item: OfflineQueueItem) => {
    if (item.type === 'ekipman_kontrol') {
      const { ekipmanId, sonKontrolTarihi, sonrakiKontrolTarihi, durum } = item.payload as {
        ekipmanId: string;
        sonKontrolTarihi: string;
        sonrakiKontrolTarihi: string;
        durum: EkipmanStatus;
      };
      updateEkipman(ekipmanId, { sonKontrolTarihi, sonrakiKontrolTarihi, durum });
    } else if (item.type === 'ekipman_durum') {
      const { ekipmanId, durum } = item.payload as { ekipmanId: string; durum: EkipmanStatus };
      updateEkipman(ekipmanId, { durum });
    }
  }, [updateEkipman]);

  const {
    isOnline, isSyncing, pendingCount, pendingItems, lastSyncAt, syncError,
    addToQueue, syncNow, clearQueue,
  } = useOfflineQueue(applyQueueItem);

  // jsQR önceden yükle
  useEffect(() => { void loadJsQR(); }, []);

  // Sync tamamlanınca toast
  const prevSyncingRef = useRef(isSyncing);
  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && pendingCount === 0 && isOnline) {
      addToast('Çevrimdışı işlemler başarıyla senkronize edildi!', 'success');
    }
    prevSyncingRef.current = isSyncing;
  }, [isSyncing, pendingCount, isOnline, addToast]);

  const handleQrResult = useCallback((text: string) => {
    setShowQr(false);
    const match = text.match(/\/equipment\/qr\/([^/?#\s]+)/);
    if (match) {
      const ekipmanId = match[1];
      const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
      if (ekipman) {
        setQrFoundEkipman(ekipman);
        addToast(`Ekipman bulundu: ${ekipman.ad}`, 'success');
        return;
      }
      addToast('QR kodu okundu fakat ekipman bulunamadı.', 'warning');
      return;
    }
    if (text.startsWith('http://') || text.startsWith('https://')) {
      addToast('QR okundu — yönlendiriliyor...', 'success');
      window.open(text, '_blank', 'noopener,noreferrer');
      return;
    }
    addToast(`QR içeriği: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`, 'info');
  }, [ekipmanlar, addToast]);

  // Kontrol Yaptım — offline destekli
  const handleKontrolYapildi = useCallback(async (ekipmanId: string) => {
    const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
    if (!ekipman) return;

    const today = new Date().toISOString().split('T')[0];
    const sonraki = new Date();
    sonraki.setMonth(sonraki.getMonth() + 1);
    const sonrakiStr = sonraki.toISOString().split('T')[0];
    const gecikmisDi = ekipman.sonrakiKontrolTarihi
      ? new Date(ekipman.sonrakiKontrolTarihi) < new Date()
      : false;

    // UI'ya anında yansıt (optimistic)
    updateEkipman(ekipmanId, { sonKontrolTarihi: today, sonrakiKontrolTarihi: sonrakiStr, durum: 'Uygun' });
    ekipmanKontrolBildirimi(ekipman.ad, ekipmanId, 'Uygun', gecikmisDi);
    setQrFoundEkipman(null);

    if (!isOnline) {
      // Offline — kuyruğa ekle
      await addToQueue({
        type: 'ekipman_kontrol',
        label: `${ekipman.ad} — Kontrol kaydı`,
        payload: { ekipmanId, sonKontrolTarihi: today, sonrakiKontrolTarihi: sonrakiStr, durum: 'Uygun' },
      });
      addToast('Kontrol kaydedildi! Bağlantı gelince sunucuya gönderilecek.', 'success');
    } else {
      addToast('Kontrol kaydedildi! Durum "Uygun" olarak güncellendi.', 'success');
    }
  }, [ekipmanlar, updateEkipman, ekipmanKontrolBildirimi, isOnline, addToQueue, addToast]);

  // Durum Değiştir — offline destekli
  const handleDurumDegistir = useCallback(async (ekipmanId: string, yeniDurum: EkipmanStatus) => {
    const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
    if (!ekipman || ekipman.durum === yeniDurum) return;

    // UI'ya anında yansıt
    updateEkipman(ekipmanId, { durum: yeniDurum });
    // QR kartındaki ekipmanı güncelle
    setQrFoundEkipman(prev => prev?.id === ekipmanId ? { ...prev, durum: yeniDurum } : prev);

    if (!isOnline) {
      await addToQueue({
        type: 'ekipman_durum',
        label: `${ekipman.ad} — Durum: ${yeniDurum}`,
        payload: { ekipmanId, durum: yeniDurum },
      });
      addToast(`Durum "${yeniDurum}" olarak kaydedildi. Bağlantı gelince gönderilecek.`, 'success');
    } else {
      addToast(`Durum "${yeniDurum}" olarak güncellendi.`, 'success');
    }
  }, [ekipmanlar, updateEkipman, isOnline, addToQueue, addToast]);

  const aktifEkipmanlar = ekipmanlar.filter(e => !e.silinmis);
  const uygunDegil = aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length;
  const gecikmis = aktifEkipmanlar.filter(e => e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()).length;

  return (
    <div className="space-y-5 pb-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>İSG Saha</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Hızlı saha işlemleri</p>
        </div>
        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <i className="ri-shield-check-line text-sm" style={{ color: '#34D399' }} />
        </div>
      </div>

      {/* Offline Durum Bandı */}
      <OfflineBand
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        lastSyncAt={lastSyncAt}
        syncError={syncError}
        onSyncNow={syncNow}
        onShowDetails={() => setShowPendingModal(true)}
      />

      {/* Uyarı bantları */}
      {(uygunDegil > 0 || gecikmis > 0) && (
        <div className="space-y-2">
          {uygunDegil > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-error-warning-fill text-sm" style={{ color: '#EF4444' }} />
              <p className="text-sm font-semibold flex-1" style={{ color: '#F87171' }}>{uygunDegil} ekipman uygun değil</p>
              <button onClick={() => setShowEkipmanModal(true)} className="text-xs font-semibold cursor-pointer whitespace-nowrap" style={{ color: '#EF4444' }}>Görüntüle →</button>
            </div>
          )}
          {gecikmis > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <i className="ri-time-line text-sm" style={{ color: '#FBBF24' }} />
              <p className="text-sm font-semibold flex-1" style={{ color: '#FCD34D' }}>{gecikmis} ekipman kontrolü gecikmiş</p>
              <button onClick={() => setShowEkipmanModal(true)} className="text-xs font-semibold cursor-pointer whitespace-nowrap" style={{ color: '#FBBF24' }}>Görüntüle →</button>
            </div>
          )}
        </div>
      )}

      {/* QR Sonuç Kartı */}
      {qrFoundEkipman && (
        <QrEkipmanKart
          ekipman={qrFoundEkipman}
          onClose={() => setQrFoundEkipman(null)}
          onKontrolYapildi={handleKontrolYapildi}
          onDurumDegistir={handleDurumDegistir}
          isOnline={isOnline}
        />
      )}

      {/* QR Tarama Alanı */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
        {showQr ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>QR Kod Tara</p>
              <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
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
            <div className="relative">
              <div className="w-20 h-20 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(52,211,153,0.08)', border: '2px dashed rgba(52,211,153,0.3)' }}>
                <i className="ri-qr-code-line text-4xl" style={{ color: '#34D399' }} />
              </div>
              {['absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 rounded-tl-md', 'absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 rounded-tr-md', 'absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 rounded-bl-md', 'absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 rounded-br-md'].map((cls, i) => (
                <div key={i} className={cls} style={{ borderColor: '#34D399' }} />
              ))}
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
        <button
          onClick={() => setShowEkipmanModal(true)}
          className="flex flex-col items-center justify-center gap-2.5 py-5 rounded-2xl cursor-pointer transition-all duration-200"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.14)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.08)'; }}
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#34D399' }} />
          </div>
          <span className="text-sm font-bold" style={{ color: '#34D399' }}>Kontrol Yap</span>
          <span className="text-[10px]" style={{ color: '#475569' }}>{aktifEkipmanlar.length} ekipman</span>
        </button>

        <button
          onClick={() => setShowUygunsuzlukForm(true)}
          className="flex flex-col items-center justify-center gap-2.5 py-5 rounded-2xl cursor-pointer transition-all duration-200"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.14)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; }}
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: 'rgba(251,191,36,0.15)' }}>
            <i className="ri-error-warning-line text-2xl" style={{ color: '#FBBF24' }} />
          </div>
          <span className="text-sm font-bold" style={{ color: '#FBBF24' }}>Uygunsuzluk</span>
          <span className="text-[10px]" style={{ color: '#475569' }}>Yeni kayıt ekle</span>
        </button>
      </div>

      {/* Son İşlemler */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>SON İŞLEMLER</p>
          <span className="text-[10px]" style={{ color: '#334155' }}>Uygunsuzluk &amp; Ekipman</span>
        </div>
        <SonIslemler />
      </div>

      {/* Firma Özeti */}
      <FirmaOzeti />

      {/* Modallar */}
      <EkipmanListeModal open={showEkipmanModal} onClose={() => setShowEkipmanModal(false)} />
      <NonconformityForm isOpen={showUygunsuzlukForm} onClose={() => setShowUygunsuzlukForm(false)} editRecord={null} />
      <PendingModal
        open={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        items={pendingItems}
        isOnline={isOnline}
        isSyncing={isSyncing}
        onSyncNow={syncNow}
        onClear={clearQueue}
      />
    </div>
  );
}
