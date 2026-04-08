import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import NonconformityForm from '@/pages/nonconformity/components/NonconformityForm';
import DetailModal from '@/pages/nonconformity/components/DetailModal';
import KapatmaModal from '@/pages/nonconformity/components/KapatmaModal';
import Modal from '@/components/base/Modal';
import type { Ekipman, EkipmanStatus, Uygunsuzluk, Evrak } from '@/types';
import { useOfflineQueue, type OfflineQueueItem } from '@/hooks/useOfflineQueue';
import { STATUS_CONFIG, SEV_CONFIG } from '@/pages/nonconformity/utils/statusHelper';
import { getSignedUrlFromPath } from '@/utils/fileUpload';
import { supabase } from '@/lib/supabase';
import IsIzniSahaBolumu from './components/IsIzniSahaBolumu';

// jsQR modül yükleyici
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

function OfflineBand({ isOnline, isSyncing, pendingCount, lastSyncAt, syncError, onSyncNow, onShowDetails }: OfflineBandProps) {
  const fmtTime = (d: Date) => d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  if (isOnline && pendingCount === 0 && !syncError) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
        <span className="text-xs font-medium flex-1" style={{ color: '#34D399' }}>Çevrimiçi</span>
        {lastSyncAt && <span className="text-[10px]" style={{ color: '#334155' }}>Son sync: {fmtTime(lastSyncAt)}</span>}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }} onClick={onShowDetails}>
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(251,191,36,0.15)' }}>
          <i className="ri-wifi-off-line text-sm" style={{ color: '#FBBF24' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: '#FCD34D' }}>Çevrimdışı Mod</p>
          <p className="text-xs" style={{ color: '#92400E' }}>
            {pendingCount > 0 ? `${pendingCount} işlem bekliyor — bağlantı gelince otomatik gönderilir` : 'İşlemler kaydedilir, bağlantı gelince gönderilir'}
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(251,191,36,0.2)', color: '#FBBF24' }}>{pendingCount}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: syncError ? 'rgba(239,68,68,0.06)' : 'rgba(99,102,241,0.06)', border: `1px solid ${syncError ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}` }}>
      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: syncError ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)' }}>
        {isSyncing ? <i className="ri-loader-4-line text-sm animate-spin" style={{ color: '#818CF8' }} /> : syncError ? <i className="ri-error-warning-line text-sm" style={{ color: '#EF4444' }} /> : <i className="ri-upload-cloud-2-line text-sm" style={{ color: '#818CF8' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: syncError ? '#F87171' : '#A5B4FC' }}>
          {isSyncing ? 'Senkronize ediliyor...' : syncError ? 'Sync hatası' : `${pendingCount} işlem bekliyor`}
        </p>
        <p className="text-xs truncate" style={{ color: '#475569' }}>{syncError ?? 'Çevrimdışıyken kaydedilen işlemler gönderiliyor'}</p>
      </div>
      {!isSyncing && (
        <button onClick={onSyncNow} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
          Şimdi Gönder
        </button>
      )}
      {pendingCount > 0 && (
        <button onClick={onShowDetails} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', color: '#64748B' }}>
          <i className="ri-list-check text-xs" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bekleyen İşlemler Modal
// ─────────────────────────────────────────────────────────────────────────────
function PendingModal({ open, onClose, items, isOnline, isSyncing, onSyncNow, onClear }: {
  open: boolean; onClose: () => void; items: OfflineQueueItem[];
  isOnline: boolean; isSyncing: boolean; onSyncNow: () => void; onClear: () => void;
}) {
  const fmtTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };
  const typeLabel = (type: string) => type === 'ekipman_kontrol' ? 'Kontrol Kaydı' : type === 'ekipman_durum' ? 'Durum Değişikliği' : type;

  return (
    <Modal isOpen={open} onClose={onClose} title="Bekleyen İşlemler" size="md" icon="ri-time-line">
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: isOnline ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)', border: `1px solid ${isOnline ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}` }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOnline ? '#34D399' : '#FBBF24' }} />
          <p className="text-sm font-semibold flex-1" style={{ color: isOnline ? '#34D399' : '#FCD34D' }}>
            {isOnline ? 'Çevrimiçi — işlemler gönderilebilir' : 'Çevrimdışı — bağlantı bekleniyor'}
          </p>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>{items.length} işlem</span>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-checkbox-circle-line text-3xl" style={{ color: '#34D399' }} />
            <p className="text-sm mt-2 font-medium" style={{ color: '#34D399' }}>Tüm işlemler gönderildi!</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '320px' }}>
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <i className="ri-time-line text-sm" style={{ color: '#FBBF24' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>{typeLabel(item.type)}</span>
                    {item.retryCount > 0 && <span className="text-[10px]" style={{ color: '#EF4444' }}>{item.retryCount} deneme</span>}
                  </div>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: '#334155' }}>{fmtTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          {items.length > 0 && (
            <button onClick={onClear} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}>
              <i className="ri-delete-bin-line text-xs" />Kuyruğu Temizle
            </button>
          )}
          <div className="flex-1" />
          {isOnline && items.length > 0 && (
            <button onClick={() => { onSyncNow(); onClose(); }} disabled={isSyncing} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', opacity: isSyncing ? 0.7 : 1 }}>
              {isSyncing ? <><i className="ri-loader-4-line animate-spin text-xs" />Gönderiliyor...</> : <><i className="ri-upload-cloud-2-line text-xs" />Şimdi Gönder</>}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}>Kapat</button>
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
      } catch { detectorRef.current = null; }
    }
    void loadJsQR();

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
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
        if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) setError('Kamera izni reddedildi. Tarayıcı ayarlarından kamera iznini açın.');
        else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) setError('Kamera bulunamadı.');
        else setError('Kamera başlatılamadı: ' + msg);
      }
    };

    const tick = async () => {
      if (!activeRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) { rafRef.current = requestAnimationFrame(tick); return; }
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
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>Kapat</button>
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
            {ready && <div className="absolute left-2 right-2 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #34D399, transparent)', animation: 'qrScan 2s ease-in-out infinite', top: '10%' }} />}
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
// Ekipman Evrakları Paneli
// ─────────────────────────────────────────────────────────────────────────────
function EkipmanEvraklari({ ekipman }: { ekipman: Ekipman }) {
  const { evraklar, addToast } = useApp();
  const [downloading, setDownloading] = useState<string | null>(null);

  const firmaEvraklari = useMemo(() => {
    return evraklar
      .filter(e => !e.silinmis && !e.cascadeSilindi && e.firmaId === ekipman.firmaId)
      .sort((a, b) => (b.olusturmaTarihi ?? '').localeCompare(a.olusturmaTarihi ?? ''));
  }, [evraklar, ekipman.firmaId]);

  const handleView = async (evrak: Evrak) => {
    const url = evrak.dosyaUrl ? await getSignedUrlFromPath(evrak.dosyaUrl) : null;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else addToast('Belge erişim linki alınamadı.', 'error');
  };

  const handleDownload = async (evrak: Evrak) => {
    if (!evrak.dosyaUrl) { addToast('Bu evrak için dosya bulunamadı.', 'error'); return; }
    setDownloading(evrak.id);
    try {
      const url = await getSignedUrlFromPath(evrak.dosyaUrl);
      if (!url) { addToast('Dosya indirilemedi.', 'error'); return; }
      const a = document.createElement('a');
      a.href = url; a.download = evrak.dosyaAdi || evrak.ad;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      addToast(`"${evrak.ad}" indiriliyor...`, 'success');
    } finally { setDownloading(null); }
  };

  const getStatusColor = (durum: string) => {
    if (durum === 'Yüklü') return { color: '#34D399', bg: 'rgba(52,211,153,0.12)' };
    if (durum === 'Süre Yaklaşıyor') return { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' };
    if (durum === 'Süre Dolmuş') return { color: '#F87171', bg: 'rgba(248,113,113,0.12)' };
    return { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Ekipman Belgesi</p>
        {ekipman.dosyaUrl ? (
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
              <i className="ri-file-check-line text-base" style={{ color: '#34D399' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ekipman.dosyaAdi || 'Ekipman Belgesi'}</p>
              {ekipman.dosyaBoyutu ? <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{(ekipman.dosyaBoyutu / 1024).toFixed(1)} KB</p> : null}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={async () => { const url = await getSignedUrlFromPath(ekipman.dosyaUrl!); if (url) window.open(url, '_blank', 'noopener,noreferrer'); else addToast('Belge açılamadı.', 'error'); }} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }} title="Görüntüle">
                <i className="ri-eye-line text-sm" />
              </button>
              <button onClick={async () => { const url = await getSignedUrlFromPath(ekipman.dosyaUrl!); if (url) { const a = document.createElement('a'); a.href = url; a.download = ekipman.dosyaAdi || 'belge'; document.body.appendChild(a); a.click(); document.body.removeChild(a); addToast('İndiriliyor...', 'success'); } else addToast('Dosya indirilemedi.', 'error'); }} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }} title="İndir">
                <i className="ri-download-2-line text-sm" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <i className="ri-file-line text-base" style={{ color: '#475569' }} />
            </div>
            <p className="text-sm" style={{ color: '#475569' }}>Ekipman belgesi yüklenmemiş</p>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Firma Evrakları</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>{firmaEvraklari.length} evrak</span>
        </div>
        {firmaEvraklari.length === 0 ? (
          <div className="text-center py-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <i className="ri-folder-open-line text-2xl" style={{ color: '#334155' }} />
            <p className="text-xs mt-2" style={{ color: '#475569' }}>Bu firmaya ait evrak bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: '280px' }}>
            {firmaEvraklari.map(evrak => {
              const sc = getStatusColor(evrak.durum);
              const isExpired = evrak.durum === 'Süre Dolmuş';
              const isNearing = evrak.durum === 'Süre Yaklaşıyor';
              return (
                <div key={evrak.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isExpired ? 'rgba(248,113,113,0.2)' : isNearing ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)'}` }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: sc.bg }}>
                    <i className="ri-file-text-line text-sm" style={{ color: sc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{evrak.ad}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {evrak.tur && <span className="text-[10px]" style={{ color: '#475569' }}>{evrak.tur}</span>}
                      {evrak.gecerlilikTarihi && <span className="text-[10px]" style={{ color: isExpired ? '#F87171' : isNearing ? '#FCD34D' : '#475569' }}><i className="ri-calendar-line mr-0.5" />{fmtDate(evrak.gecerlilikTarihi)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ background: sc.bg, color: sc.color }}>{evrak.durum}</span>
                    {evrak.dosyaUrl && (
                      <>
                        <button onClick={() => handleView(evrak)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }} title="Görüntüle"><i className="ri-eye-line text-xs" /></button>
                        <button onClick={() => handleDownload(evrak)} disabled={downloading === evrak.id} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }} title="İndir"><i className={`${downloading === evrak.id ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'} text-xs`} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ekipman Detay Paneli — sekmeli (Kontrol + Evraklar)
// ─────────────────────────────────────────────────────────────────────────────
function EkipmanDetayPanel({
  ekipman,
  onBack,
  onKontrolYapildi,
  onDurumDegistir,
  isOnline,
  kontrolBasarili,
}: {
  ekipman: Ekipman;
  onBack: () => void;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus) => void;
  isOnline: boolean;
  kontrolBasarili?: boolean;
}) {
  const { firmalar } = useApp();
  const [activeTab, setActiveTab] = useState<'detay' | 'evraklar'>('detay');
  const sc = STATUS_CFG[ekipman.durum] ?? STATUS_CFG['Uygun'];
  const firma = firmalar.find(f => f.id === ekipman.firmaId);
  const days = ekipman.sonrakiKontrolTarihi
    ? Math.ceil((new Date(ekipman.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-4">
      {/* Geri butonu */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: '#64748B' }}>
        <i className="ri-arrow-left-line text-base" />
        Listeye Dön
      </button>

      {/* Kontrol başarılı banner */}
      {kontrolBasarili && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(52,211,153,0.2)' }}>
            <i className="ri-checkbox-circle-fill text-base" style={{ color: '#34D399' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: '#34D399' }}>Kontrol kaydedildi!</p>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
              {isOnline ? 'Durum "Uygun" olarak güncellendi.' : 'Bağlantı gelince sunucuya gönderilecek.'}
            </p>
          </div>
        </div>
      )}

      {/* Ekipman başlık */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: sc.bg }}>
          <i className={`${sc.icon} text-xl`} style={{ color: sc.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{ekipman.ad}</p>
          {firma && <p className="text-xs mt-0.5" style={{ color: '#475569' }}><i className="ri-building-2-line mr-1" />{firma.ad}</p>}
          {ekipman.tur && <p className="text-xs" style={{ color: '#334155' }}>{ekipman.tur}</p>}
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
      </div>

      {/* Sekmeler */}
      <div className="flex items-center gap-1 px-1 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setActiveTab('detay')}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap"
          style={{ background: activeTab === 'detay' ? 'rgba(52,211,153,0.2)' : 'transparent', color: activeTab === 'detay' ? '#34D399' : '#64748B' }}
        >
          <i className="ri-tools-line text-xs" />Kontrol
        </button>
        <button
          onClick={() => setActiveTab('evraklar')}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap"
          style={{ background: activeTab === 'evraklar' ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === 'evraklar' ? '#818CF8' : '#64748B' }}
        >
          <i className="ri-file-list-3-line text-xs" />Evraklar
        </button>
      </div>

      {/* Sekme içerikleri */}
      {activeTab === 'detay' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {ekipman.seriNo && (
              <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569' }}>Seri No</p>
                <p className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{ekipman.seriNo}</p>
              </div>
            )}
            {ekipman.marka && (
              <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569' }}>Marka / Model</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ekipman.marka} {ekipman.model}</p>
              </div>
            )}
            {ekipman.sonKontrolTarihi && (
              <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569' }}>Son Kontrol</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{new Date(ekipman.sonKontrolTarihi).toLocaleDateString('tr-TR')}</p>
              </div>
            )}
            {ekipman.bulunduguAlan && (
              <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569' }}>Bulunduğu Alan</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ekipman.bulunduguAlan}</p>
              </div>
            )}
          </div>

          {days !== null && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: days < 0 ? 'rgba(239,68,68,0.08)' : days <= 7 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${days < 0 ? 'rgba(239,68,68,0.2)' : days <= 7 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
              <i className="ri-calendar-line text-sm" style={{ color: days < 0 ? '#EF4444' : days <= 7 ? '#FBBF24' : '#475569' }} />
              <span className="text-sm font-medium" style={{ color: days < 0 ? '#F87171' : days <= 7 ? '#FCD34D' : '#64748B' }}>
                {days < 0 ? `Kontrol ${Math.abs(days)} gün gecikmiş!` : days === 0 ? 'Kontrol bugün yapılmalı!' : days <= 7 ? `Kontrol ${days} gün içinde yapılmalı` : `Sonraki kontrol: ${new Date(ekipman.sonrakiKontrolTarihi!).toLocaleDateString('tr-TR')}`}
              </span>
            </div>
          )}

          <button
            onClick={() => onKontrolYapildi(ekipman.id)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer transition-all duration-200"
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
      ) : (
        <EkipmanEvraklari ekipman={ekipman} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ekipman Listesi Modal — tıklayınca detay açılır, kontrol sonrası detayda kalır
// ─────────────────────────────────────────────────────────────────────────────
function EkipmanListeModal({
  open,
  onClose,
  onKontrolYapildi,
  onDurumDegistir,
  isOnline,
  initialEkipmanId,
}: {
  open: boolean;
  onClose: () => void;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus) => void;
  isOnline: boolean;
  initialEkipmanId?: string | null;
}) {
  const { ekipmanlar, firmalar, dataLoading } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kontrolBasarili, setKontrolBasarili] = useState(false);

  // Modal açılınca initialEkipmanId varsa direkt detaya git
  useEffect(() => {
    if (open) {
      setSelectedId(initialEkipmanId ?? null);
      setKontrolBasarili(false);
    } else {
      setSelectedId(null);
      setKontrolBasarili(false);
    }
  }, [open, initialEkipmanId]);

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

  // Kontrol yapılınca detayda kal, başarı banner'ı göster
  const handleKontrol = (id: string) => {
    onKontrolYapildi(id);
    setKontrolBasarili(true);
    setTimeout(() => setKontrolBasarili(false), 3000);
  };

  const handleDurum = (id: string, durum: EkipmanStatus) => {
    onDurumDegistir(id, durum);
  };

  // Store'dan güncel ekipman verisini al
  const currentEkipman = selectedId
    ? (ekipmanlar.find(e => e.id === selectedId) ?? null)
    : null;

  return (
    <Modal
      isOpen={open}
      onClose={() => { setSelectedId(null); onClose(); }}
      title={currentEkipman ? currentEkipman.ad : 'Ekipman Kontrolleri'}
      size="lg"
      icon="ri-tools-line"
    >
      {currentEkipman ? (
        <EkipmanDetayPanel
          ekipman={currentEkipman}
          onBack={() => { setSelectedId(null); setKontrolBasarili(false); }}
          onKontrolYapildi={handleKontrol}
          onDurumDegistir={handleDurum}
          isOnline={isOnline}
          kontrolBasarili={kontrolBasarili}
        />
      ) : (
        <>
          {/* İstatistikler */}
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

          {/* Filtreler */}
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

          {/* Liste */}
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgba(52,211,153,0.3)', borderTopColor: '#34D399' }} />
              <p className="text-sm font-medium" style={{ color: '#475569' }}>Ekipmanlar yükleniyor...</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '400px' }}>
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <i className="ri-tools-line text-3xl" style={{ color: '#334155' }} />
                  <p className="text-sm mt-2" style={{ color: '#475569' }}>
                    {aktif.length === 0 ? 'Henüz ekipman eklenmemiş' : 'Ekipman bulunamadı'}
                  </p>
                </div>
              ) : filtered.map(ekipman => {
                const firma = firmalar.find(f => f.id === ekipman.firmaId);
                const sc = STATUS_CFG[ekipman.durum] ?? STATUS_CFG['Uygun'];
                const days = getDays(ekipman.sonrakiKontrolTarihi);
                const isOverdue = days !== null && days < 0;
                const isUrgent = days !== null && days >= 0 && days <= 7;
                return (
                  <button
                    key={ekipman.id}
                    onClick={() => { setSelectedId(ekipman.id); setKontrolBasarili(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150 text-left"
                    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : isUrgent ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)'}` }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  >
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
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {ekipman.seriNo && <span className="text-[10px] font-mono" style={{ color: '#334155' }}>{ekipman.seriNo}</span>}
                      <i className="ri-arrow-right-s-line text-sm" style={{ color: '#475569' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Ekipman Kartı — offline destekli + evraklar
// ─────────────────────────────────────────────────────────────────────────────
function QrEkipmanKart({ ekipman, onClose, onKontrolYapildi, onDurumDegistir, isOnline }: {
  ekipman: Ekipman; onClose: () => void;
  onKontrolYapildi: (ekipmanId: string) => void;
  onDurumDegistir: (ekipmanId: string, durum: EkipmanStatus) => void;
  isOnline: boolean;
}) {
  const { firmalar, addToast, org } = useApp();
  const sc = STATUS_CFG[ekipman.durum] ?? STATUS_CFG['Uygun'];
  const firma = firmalar.find(f => f.id === ekipman.firmaId);
  const days = ekipman.sonrakiKontrolTarihi
    ? Math.ceil((new Date(ekipman.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000)
    : null;

  // Evraklar — direkt Supabase'den çek
  const [evraklar, setEvraklar] = useState<Evrak[]>([]);
  const [evraklarLoading, setEvraklarLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!ekipman.firmaId || !org?.id) {
      setEvraklar([]);
      setEvraklarLoading(false);
      return;
    }
    setEvraklarLoading(true);
    supabase
      .from('evraklar')
      .select('id, data')
      .eq('organization_id', org.id)
      .is('deleted_at', null)
      .then(({ data, error }) => {
        if (error || !data) { setEvraklar([]); setEvraklarLoading(false); return; }
        const parsed: Evrak[] = data
          .map((row: { id: string; data: Evrak }) => ({ ...row.data, id: row.id }))
          .filter((e: Evrak) =>
            !e.silinmis &&
            !e.cascadeSilindi &&
            e.firmaId === ekipman.firmaId
          )
          .sort((a: Evrak, b: Evrak) => (b.olusturmaTarihi ?? '').localeCompare(a.olusturmaTarihi ?? ''));
        setEvraklar(parsed);
        setEvraklarLoading(false);
      });
  }, [ekipman.firmaId, org?.id]);

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (durum: string) => {
    if (durum === 'Yüklü') return { color: '#34D399', bg: 'rgba(52,211,153,0.12)' };
    if (durum === 'Süre Yaklaşıyor') return { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' };
    if (durum === 'Süre Dolmuş') return { color: '#F87171', bg: 'rgba(248,113,113,0.12)' };
    return { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  };

  const handleView = async (evrak: Evrak) => {
    const url = evrak.dosyaUrl ? await getSignedUrlFromPath(evrak.dosyaUrl) : null;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else addToast('Belge erişim linki alınamadı.', 'error');
  };

  const handleDownload = async (evrak: Evrak) => {
    if (!evrak.dosyaUrl) { addToast('Bu evrak için dosya bulunamadı.', 'error'); return; }
    setDownloading(evrak.id);
    try {
      const url = await getSignedUrlFromPath(evrak.dosyaUrl);
      if (!url) { addToast('Dosya indirilemedi.', 'error'); return; }
      const a = document.createElement('a');
      a.href = url; a.download = evrak.dosyaAdi || evrak.ad;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      addToast(`"${evrak.ad}" indiriliyor...`, 'success');
    } finally { setDownloading(null); }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.25)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-qr-code-line text-sm" style={{ color: '#34D399' }} />
          </div>
          <span className="text-xs font-bold" style={{ color: '#34D399' }}>QR ile Bulunan Ekipman</span>
          {!isOnline && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>Çevrimdışı</span>}
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
          <i className="ri-close-line text-xs" />
        </button>
      </div>

      {/* Ekipman başlık */}
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

      {/* Kontrol tarihi */}
      {days !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3" style={{ background: days < 0 ? 'rgba(239,68,68,0.08)' : days <= 7 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${days < 0 ? 'rgba(239,68,68,0.2)' : days <= 7 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
          <i className="ri-calendar-line text-xs" style={{ color: days < 0 ? '#EF4444' : days <= 7 ? '#FBBF24' : '#475569' }} />
          <span className="text-xs font-medium" style={{ color: days < 0 ? '#F87171' : days <= 7 ? '#FCD34D' : '#64748B' }}>
            {days < 0 ? `Kontrol ${Math.abs(days)} gün gecikmiş!` : days === 0 ? 'Kontrol bugün yapılmalı!' : days <= 7 ? `Kontrol ${days} gün içinde yapılmalı` : `Sonraki kontrol: ${new Date(ekipman.sonrakiKontrolTarihi!).toLocaleDateString('tr-TR')}`}
          </span>
        </div>
      )}

      {/* Kontrol Yaptım butonu */}
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
      <div className="mb-4">
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

      {/* ── EVRAKLAR BÖLÜMÜ ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Firma Evrakları</p>
          {!evraklarLoading && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>{evraklar.length} evrak</span>
          )}
        </div>

        {evraklarLoading ? (
          <div className="flex items-center gap-2 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#818CF8' }} />
            <span className="text-xs" style={{ color: '#475569' }}>Evraklar yükleniyor...</span>
          </div>
        ) : evraklar.length === 0 ? (
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <i className="ri-folder-open-line text-sm" style={{ color: '#475569' }} />
            </div>
            <p className="text-xs" style={{ color: '#475569' }}>Bu firmaya ait evrak bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: '240px' }}>
            {evraklar.map(evrak => {
              const sc2 = getStatusColor(evrak.durum);
              const isExpired = evrak.durum === 'Süre Dolmuş';
              const isNearing = evrak.durum === 'Süre Yaklaşıyor';
              return (
                <div key={evrak.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isExpired ? 'rgba(248,113,113,0.2)' : isNearing ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)'}` }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: sc2.bg }}>
                    <i className="ri-file-text-line text-sm" style={{ color: sc2.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{evrak.ad}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {evrak.tur && <span className="text-[10px]" style={{ color: '#475569' }}>{evrak.tur}</span>}
                      {evrak.gecerlilikTarihi && (
                        <span className="text-[10px]" style={{ color: isExpired ? '#F87171' : isNearing ? '#FCD34D' : '#475569' }}>
                          <i className="ri-calendar-line mr-0.5" />{fmtDate(evrak.gecerlilikTarihi)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ background: sc2.bg, color: sc2.color }}>{evrak.durum}</span>
                    {evrak.dosyaUrl && (
                      <>
                        <button onClick={() => handleView(evrak)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }} title="Görüntüle">
                          <i className="ri-eye-line text-xs" />
                        </button>
                        <button onClick={() => handleDownload(evrak)} disabled={downloading === evrak.id} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }} title="İndir">
                          <i className={`${downloading === evrak.id ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'} text-xs`} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ekipmanın kendi belgesi varsa onu da göster */}
        {ekipman.dosyaUrl && (
          <div className="mt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#475569' }}>Ekipman Belgesi</p>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
                <i className="ri-file-check-line text-sm" style={{ color: '#34D399' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ekipman.dosyaAdi || 'Ekipman Belgesi'}</p>
                {ekipman.dosyaBoyutu ? <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{(ekipman.dosyaBoyutu / 1024).toFixed(1)} KB</p> : null}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={async () => { const url = await getSignedUrlFromPath(ekipman.dosyaUrl!); if (url) window.open(url, '_blank', 'noopener,noreferrer'); else addToast('Belge açılamadı.', 'error'); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }} title="Görüntüle"
                >
                  <i className="ri-eye-line text-xs" />
                </button>
                <button
                  onClick={async () => { const url = await getSignedUrlFromPath(ekipman.dosyaUrl!); if (url) { const a = document.createElement('a'); a.href = url; a.download = ekipman.dosyaAdi || 'belge'; document.body.appendChild(a); a.click(); document.body.removeChild(a); addToast('İndiriliyor...', 'success'); } else addToast('Dosya indirilemedi.', 'error'); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }} title="İndir"
                >
                  <i className="ri-download-2-line text-xs" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Uygunsuzluklar Bölümü — açık/kapalı liste + detay + kapatma (sekme geçişi yok)
// ─────────────────────────────────────────────────────────────────────────────
function UygunsuzlukBolumu() {
  const { uygunsuzluklar, firmalar } = useApp();
  const [tab, setTab] = useState<'acik' | 'kapali'>('acik');
  const [detailRecord, setDetailRecord] = useState<Uygunsuzluk | null>(null);
  const [kapatmaRecord, setKapatmaRecord] = useState<Uygunsuzluk | null>(null);
  const [editRecord, setEditRecord] = useState<Uygunsuzluk | null>(null);
  const [showForm, setShowForm] = useState(false);

  const aktif = uygunsuzluklar.filter(u => !u.silinmis && !u.cascadeSilindi);
  const aciklar = aktif.filter(u => u.durum !== 'Kapandı').sort((a, b) => (b.olusturmaTarihi ?? b.tarih ?? '').localeCompare(a.olusturmaTarihi ?? a.tarih ?? ''));
  const kapalilar = aktif.filter(u => u.durum === 'Kapandı').sort((a, b) => (b.kapatmaTarihi ?? '').localeCompare(a.kapatmaTarihi ?? ''));
  const liste = tab === 'acik' ? aciklar : kapalilar;

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>UYGUNSUZLUKLAR</p>
        <div className="flex items-center gap-1 px-1 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setTab('acik')}
            className="px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap"
            style={{ background: tab === 'acik' ? 'rgba(239,68,68,0.2)' : 'transparent', color: tab === 'acik' ? '#F87171' : '#64748B' }}
          >
            Açık ({aciklar.length})
          </button>
          <button
            onClick={() => setTab('kapali')}
            className="px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap"
            style={{ background: tab === 'kapali' ? 'rgba(34,197,94,0.2)' : 'transparent', color: tab === 'kapali' ? '#22C55E' : '#64748B' }}
          >
            Kapalı ({kapalilar.length})
          </button>
        </div>
      </div>

      {liste.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <i className={`${tab === 'acik' ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'} text-3xl`} style={{ color: '#334155' }} />
          <p className="text-xs mt-2 font-medium" style={{ color: '#475569' }}>
            {tab === 'acik' ? 'Açık uygunsuzluk yok' : 'Kapalı uygunsuzluk yok'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {liste.slice(0, 8).map(u => {
            const firma = firmalar.find(f => f.id === u.firmaId);
            const sc = STATUS_CONFIG[u.durum] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)', icon: 'ri-question-line', label: u.durum };
            const sev = SEV_CONFIG[u.severity] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8' };
            const isKritik = u.severity === 'Kritik';
            const isYuksek = u.severity === 'Yüksek';
            const acilColor = isKritik ? '#EF4444' : isYuksek ? '#F97316' : '#FBBF24';

            return (
              <button
                key={u.id}
                onClick={() => setDetailRecord(u)}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150 text-left"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isKritik && tab === 'acik' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}` }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: `${acilColor}18` }}>
                  <i className={`${sc.icon} text-sm`} style={{ color: acilColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {u.acilisNo && <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>{u.acilisNo}</span>}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: sev.bg, color: sev.color }}>{u.severity}</span>
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.baslik}</p>
                  {firma && <p className="text-xs truncate mt-0.5" style={{ color: '#475569' }}><i className="ri-building-2-line mr-0.5" />{firma.ad}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                  <span className="text-[10px]" style={{ color: '#334155' }}>{fmtDate(u.olusturmaTarihi ?? u.tarih)}</span>
                  <i className="ri-arrow-right-s-line text-xs" style={{ color: '#475569' }} />
                </div>
              </button>
            );
          })}
          {liste.length > 8 && (
            <p className="text-center text-xs py-2" style={{ color: '#475569' }}>+{liste.length - 8} daha var</p>
          )}
        </div>
      )}

      {/* Detay Modal — sekme geçişi yok, modal içinde açılır */}
      <DetailModal
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onKapat={(rec) => { setDetailRecord(null); setKapatmaRecord(rec); }}
        onEdit={(rec) => { setDetailRecord(null); setEditRecord(rec); setShowForm(true); }}
      />
      <KapatmaModal record={kapatmaRecord} onClose={() => setKapatmaRecord(null)} />
      <NonconformityForm isOpen={showForm} onClose={() => { setShowForm(false); setEditRecord(null); }} editRecord={editRecord} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Firma Özeti — firmaya tıklayınca o firmanın ekipmanları modal içinde açılır
// ─────────────────────────────────────────────────────────────────────────────
function FirmaOzeti({
  onFirmaEkipmanAc,
}: {
  onFirmaEkipmanAc: (firmaId: string) => void;
}) {
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
          <button
            key={firma.id}
            onClick={() => onFirmaEkipmanAc(firma.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-left"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${firma.sorunlu > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)'}` }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #334155, #1e293b)' }}>
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
              <i className="ri-arrow-right-s-line text-xs ml-0.5" style={{ color: '#475569' }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Firma Ekipman Modal — o firmaya ait ekipmanları listeler
// ─────────────────────────────────────────────────────────────────────────────
function FirmaEkipmanModal({
  open,
  firmaId,
  onClose,
  onKontrolYapildi,
  onDurumDegistir,
  isOnline,
}: {
  open: boolean;
  firmaId: string | null;
  onClose: () => void;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus) => void;
  isOnline: boolean;
}) {
  const { ekipmanlar, firmalar } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kontrolBasarili, setKontrolBasarili] = useState(false);

  useEffect(() => {
    if (!open) { setSelectedId(null); setKontrolBasarili(false); }
  }, [open]);

  const firma = firmalar.find(f => f.id === firmaId);
  const firmaEkipmanlari = ekipmanlar.filter(e => e.firmaId === firmaId && !e.silinmis);

  const getDays = (dateStr: string) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  };

  const handleKontrol = (id: string) => {
    onKontrolYapildi(id);
    setKontrolBasarili(true);
    setTimeout(() => setKontrolBasarili(false), 3000);
  };

  const currentEkipman = selectedId ? (ekipmanlar.find(e => e.id === selectedId) ?? null) : null;

  return (
    <Modal
      isOpen={open}
      onClose={() => { setSelectedId(null); onClose(); }}
      title={currentEkipman ? currentEkipman.ad : (firma?.ad ?? 'Firma Ekipmanları')}
      size="lg"
      icon="ri-building-2-line"
    >
      {currentEkipman ? (
        <EkipmanDetayPanel
          ekipman={currentEkipman}
          onBack={() => { setSelectedId(null); setKontrolBasarili(false); }}
          onKontrolYapildi={handleKontrol}
          onDurumDegistir={(id, durum) => onDurumDegistir(id, durum)}
          isOnline={isOnline}
          kontrolBasarili={kontrolBasarili}
        />
      ) : (
        <>
          {/* Firma başlık */}
          {firma && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #334155, #1e293b)' }}>
                {(firma.ad || 'F').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{firma.ad}</p>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{firmaEkipmanlari.length} ekipman</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {firmaEkipmanlari.filter(e => e.durum === 'Uygun Değil').length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>
                    {firmaEkipmanlari.filter(e => e.durum === 'Uygun Değil').length} uygun değil
                  </span>
                )}
                {firmaEkipmanlari.filter(e => e.durum === 'Uygun').length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
                    {firmaEkipmanlari.filter(e => e.durum === 'Uygun').length} uygun
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Ekipman listesi */}
          <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '440px' }}>
            {firmaEkipmanlari.length === 0 ? (
              <div className="text-center py-12">
                <i className="ri-tools-line text-3xl" style={{ color: '#334155' }} />
                <p className="text-sm mt-2" style={{ color: '#475569' }}>Bu firmaya ait ekipman yok</p>
              </div>
            ) : firmaEkipmanlari.map(ekipman => {
              const sc = STATUS_CFG[ekipman.durum] ?? STATUS_CFG['Uygun'];
              const days = getDays(ekipman.sonrakiKontrolTarihi);
              const isOverdue = days !== null && days < 0;
              const isUrgent = days !== null && days >= 0 && days <= 7;
              return (
                <button
                  key={ekipman.id}
                  onClick={() => { setSelectedId(ekipman.id); setKontrolBasarili(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150 text-left"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : isUrgent ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)'}` }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: sc.bg }}>
                    <i className={`${sc.icon} text-base`} style={{ color: sc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ekipman.ad}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    {ekipman.tur && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{ekipman.tur}</p>}
                    {ekipman.sonrakiKontrolTarihi && (
                      <div className="flex items-center gap-1 mt-1">
                        <i className="ri-calendar-line text-[10px]" style={{ color: isOverdue ? '#EF4444' : isUrgent ? '#FBBF24' : '#334155' }} />
                        <span className="text-[10px] font-medium" style={{ color: isOverdue ? '#F87171' : isUrgent ? '#FCD34D' : '#475569' }}>
                          {isOverdue ? `${Math.abs(days!)} gün gecikmiş` : isUrgent ? `${days} gün kaldı` : new Date(ekipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {ekipman.seriNo && <span className="text-[10px] font-mono" style={{ color: '#334155' }}>{ekipman.seriNo}</span>}
                    <i className="ri-arrow-right-s-line text-sm" style={{ color: '#475569' }} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Modal>
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
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [selectedFirmaId, setSelectedFirmaId] = useState<string | null>(null);
  const [qrFoundEkipman, setQrFoundEkipman] = useState<Ekipman | null>(null);

  // QR redirect'ten gelen ekipman ID'sini sessionStorage'dan oku
  useEffect(() => {
    const qrId = sessionStorage.getItem('qr_ekipman_id');
    if (qrId) {
      sessionStorage.removeItem('qr_ekipman_id');
      const ekipman = ekipmanlar.find(e => e.id === qrId);
      if (ekipman) {
        setQrFoundEkipman(ekipman);
        addToast(`Ekipman bulundu: ${ekipman.ad}`, 'success');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ekipmanlar]);

  const applyQueueItem = useCallback(async (item: OfflineQueueItem) => {
    if (item.type === 'ekipman_kontrol') {
      const { ekipmanId, sonKontrolTarihi, sonrakiKontrolTarihi, durum } = item.payload as { ekipmanId: string; sonKontrolTarihi: string; sonrakiKontrolTarihi: string; durum: EkipmanStatus };
      updateEkipman(ekipmanId, { sonKontrolTarihi, sonrakiKontrolTarihi, durum });
    } else if (item.type === 'ekipman_durum') {
      const { ekipmanId, durum } = item.payload as { ekipmanId: string; durum: EkipmanStatus };
      updateEkipman(ekipmanId, { durum });
    }
  }, [updateEkipman]);

  const { isOnline, isSyncing, pendingCount, pendingItems, lastSyncAt, syncError, addToQueue, syncNow, clearQueue } = useOfflineQueue(applyQueueItem);

  useEffect(() => { void loadJsQR(); }, []);

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
      if (ekipman) { setQrFoundEkipman(ekipman); addToast(`Ekipman bulundu: ${ekipman.ad}`, 'success'); return; }
      addToast('QR kodu okundu fakat ekipman bulunamadı.', 'warning');
      return;
    }
    if (text.startsWith('http://') || text.startsWith('https://')) { addToast('QR okundu — yönlendiriliyor...', 'success'); window.open(text, '_blank', 'noopener,noreferrer'); return; }
    addToast(`QR içeriği: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`, 'info');
  }, [ekipmanlar, addToast]);

  const handleKontrolYapildi = useCallback(async (ekipmanId: string) => {
    const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
    if (!ekipman) return;
    const today = new Date().toISOString().split('T')[0];
    const sonraki = new Date();
    sonraki.setMonth(sonraki.getMonth() + 1);
    const sonrakiStr = sonraki.toISOString().split('T')[0];
    const gecikmisDi = ekipman.sonrakiKontrolTarihi ? new Date(ekipman.sonrakiKontrolTarihi) < new Date() : false;
    const updates = { sonKontrolTarihi: today, sonrakiKontrolTarihi: sonrakiStr, durum: 'Uygun' as const };

    if (!isOnline) {
      // Çevrimdışı: sadece offline queue'ya ekle — updateEkipman DB'ye yazmaya çalışır, başarısız olur
      // Önce UI'yi optimistik güncelle
      updateEkipman(ekipmanId, updates);
      ekipmanKontrolBildirimi(ekipman.ad, ekipmanId, 'Uygun', gecikmisDi);
      setQrFoundEkipman(null);
      await addToQueue({
        type: 'ekipman_kontrol',
        label: `${ekipman.ad} — Kontrol kaydı`,
        payload: { ekipmanId, sonKontrolTarihi: today, sonrakiKontrolTarihi: sonrakiStr, durum: 'Uygun' },
      });
      addToast('Kontrol kaydedildi! Bağlantı gelince sunucuya gönderilecek.', 'success');
    } else {
      // Çevrimiçi: direkt updateEkipman — hem state'i hem DB'yi günceller, realtime karşı tarafı tetikler
      updateEkipman(ekipmanId, updates);
      ekipmanKontrolBildirimi(ekipman.ad, ekipmanId, 'Uygun', gecikmisDi);
      setQrFoundEkipman(null);
      addToast('Kontrol kaydedildi! Durum "Uygun" olarak güncellendi.', 'success');
    }
  }, [ekipmanlar, updateEkipman, ekipmanKontrolBildirimi, isOnline, addToQueue, addToast]);

  const handleDurumDegistir = useCallback(async (ekipmanId: string, yeniDurum: EkipmanStatus) => {
    const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
    if (!ekipman || ekipman.durum === yeniDurum) return;

    if (!isOnline) {
      // Çevrimdışı: UI güncelle + queue'ya ekle
      updateEkipman(ekipmanId, { durum: yeniDurum });
      setQrFoundEkipman(prev => prev?.id === ekipmanId ? { ...prev, durum: yeniDurum } : prev);
      await addToQueue({
        type: 'ekipman_durum',
        label: `${ekipman.ad} — Durum: ${yeniDurum}`,
        payload: { ekipmanId, durum: yeniDurum },
      });
      addToast(`Durum "${yeniDurum}" olarak kaydedildi. Bağlantı gelince gönderilecek.`, 'success');
    } else {
      // Çevrimiçi: direkt DB'ye yaz
      updateEkipman(ekipmanId, { durum: yeniDurum });
      setQrFoundEkipman(prev => prev?.id === ekipmanId ? { ...prev, durum: yeniDurum } : prev);
      addToast(`Durum "${yeniDurum}" olarak güncellendi.`, 'success');
    }
  }, [ekipmanlar, updateEkipman, isOnline, addToQueue, addToast]);

  const handleFirmaEkipmanAc = useCallback((firmaId: string) => {
    setSelectedFirmaId(firmaId);
    setShowFirmaModal(true);
  }, []);

  const aktifEkipmanlar = ekipmanlar.filter(e => !e.silinmis);
  const uygunDegil = aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length;
  const gecikmis = aktifEkipmanlar.filter(e => e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()).length;

  return (
    <div className="space-y-5 pb-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Saha Denetimleri</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Hızlı saha işlemleri</p>
        </div>
        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <i className="ri-shield-check-line text-sm" style={{ color: '#34D399' }} />
        </div>
      </div>

      {/* Offline Durum Bandı */}
      <OfflineBand isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} lastSyncAt={lastSyncAt} syncError={syncError} onSyncNow={syncNow} onShowDetails={() => setShowPendingModal(true)} />

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

      {/* Uygunsuzluklar Bölümü */}
      <UygunsuzlukBolumu />

      {/* İş İzinleri Bölümü */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <IsIzniSahaBolumu />
      </div>

      {/* Firma Özeti */}
      <FirmaOzeti onFirmaEkipmanAc={handleFirmaEkipmanAc} />

      {/* Modallar */}
      <EkipmanListeModal
        open={showEkipmanModal}
        onClose={() => setShowEkipmanModal(false)}
        onKontrolYapildi={handleKontrolYapildi}
        onDurumDegistir={handleDurumDegistir}
        isOnline={isOnline}
      />

      <FirmaEkipmanModal
        open={showFirmaModal}
        firmaId={selectedFirmaId}
        onClose={() => { setShowFirmaModal(false); setSelectedFirmaId(null); }}
        onKontrolYapildi={handleKontrolYapildi}
        onDurumDegistir={handleDurumDegistir}
        isOnline={isOnline}
      />

      <NonconformityForm isOpen={showUygunsuzlukForm} onClose={() => setShowUygunsuzlukForm(false)} editRecord={null} />
      <PendingModal open={showPendingModal} onClose={() => setShowPendingModal(false)} items={pendingItems} isOnline={isOnline} isSyncing={isSyncing} onSyncNow={syncNow} onClear={clearQueue} />
    </div>
  );
}
