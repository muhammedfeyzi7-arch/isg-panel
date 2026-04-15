import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import SahaUygunsuzlukForm from './components/SahaUygunsuzlukForm';
import { SahaDetayModal, SahaKapatmaModal } from './components/SahaUygunsuzlukModals';
import type { Ekipman, EkipmanStatus, Uygunsuzluk } from '@/types';
import { useQueue } from '@/store/OfflineQueueContext';
import { STATUS_CONFIG, SEV_CONFIG } from '@/pages/nonconformity/utils/statusHelper';
import IsIzniSahaBolumu from './components/IsIzniSahaBolumu';
import { OfflineBand, PendingModal, SyncHistoryPanel, QueueInspector } from './components/OfflineBand';
import QrScanner, { loadJsQR } from './components/QrScanner';
import ZiyaretCheckIn from './components/ZiyaretCheckIn';
import {
  STATUS_CFG,
  EkipmanDetayPanel,
  EkipmanListeModal,
  FirmaEkipmanModal,
  FirmaOzeti,
} from './components/EkipmanKontrol';
import { uploadFileToStorage } from '@/utils/fileUpload';

// ─── Sekme Tanımları ──────────────────────────────────────────────────────────
type SahaTab = 'ziyaret' | 'qr' | 'ekipman' | 'izin' | 'uygunsuzluk';

const TABS: { id: SahaTab; label: string; icon: string; color: string; activeBg: string }[] = [
  { id: 'ziyaret',      label: 'Ziyaret',     icon: 'ri-map-pin-user-line',     color: '#0EA5E9', activeBg: 'rgba(14,165,233,0.15)' },
  { id: 'qr',           label: 'QR Tara',     icon: 'ri-qr-code-line',          color: '#0EA5E9', activeBg: 'rgba(14,165,233,0.15)' },
  { id: 'ekipman',      label: 'Ekipmanlar',  icon: 'ri-tools-line',            color: '#0EA5E9', activeBg: 'rgba(14,165,233,0.15)' },
  { id: 'izin',         label: 'İş İzinleri', icon: 'ri-shield-keyhole-line',   color: '#0EA5E9', activeBg: 'rgba(14,165,233,0.15)' },
  { id: 'uygunsuzluk',  label: 'Uygunsuzluk', icon: 'ri-error-warning-line',    color: '#0EA5E9', activeBg: 'rgba(14,165,233,0.15)' },
];

// ─── QR Sekme ─────────────────────────────────────────────────────────────────
interface QrTabProps {
  isOnline: boolean;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
}

const QrTab = memo(function QrTab({ isOnline, onKontrolYapildi, onDurumDegistir }: QrTabProps) {
  const { ekipmanlar, addToast } = useApp();
  const [showQr, setShowQr] = useState(false);
  const [qrFoundEkipman, setQrFoundEkipman] = useState<Ekipman | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const handleQrResult = useCallback((text: string) => {
    setShowQr(false);
    setScanCount(prev => prev + 1);
    const urlMatch    = text.match(/\/equipment\/qr\/([^/?#\s]+)/);
    const moduleMatch = text.match(/[?&]qr=([^&\s]+)/);
    const uuidMatch   = text.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    const ekipmanId   = urlMatch?.[1] ?? moduleMatch?.[1] ?? (uuidMatch ? text.trim() : null);

    if (ekipmanId) {
      const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
      if (ekipman) { setQrFoundEkipman(ekipman); addToast(`Ekipman bulundu: ${ekipman.ad}`, 'success'); return; }
      addToast('QR kodu geçerli fakat bu ekipman kayıtlı değil.', 'warning');
      return;
    }
    if (text.startsWith('http://') || text.startsWith('https://')) {
      const segments  = text.replace(/[?#].*/, '').split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        const ekipman = ekipmanlar.find(e => e.id === lastSegment);
        if (ekipman) { setQrFoundEkipman(ekipman); addToast(`Ekipman bulundu: ${ekipman.ad}`, 'success'); return; }
      }
      addToast('QR okundu — harici link açılıyor...', 'success');
      window.open(text, '_blank', 'noopener,noreferrer');
      return;
    }
    const ekipmanByText = ekipmanlar.find(e => e.id === text.trim());
    if (ekipmanByText) { setQrFoundEkipman(ekipmanByText); addToast(`Ekipman bulundu: ${ekipmanByText.ad}`, 'success'); return; }
    addToast('QR içeriği okunamadı veya ekipman bulunamadı.', 'warning');
  }, [ekipmanlar, addToast]);

  return (
    <div className="space-y-5">
      {/* QR Bulundu Kartı */}
      {qrFoundEkipman && (
        <QrEkipmanKart
          ekipman={qrFoundEkipman}
          onClose={() => setQrFoundEkipman(null)}
          onKontrolYapildi={(id) => { onKontrolYapildi(id); setQrFoundEkipman(null); }}
          onDurumDegistir={(id, durum, aciklama, foto) => { onDurumDegistir(id, durum, aciklama, foto); setQrFoundEkipman(prev => prev?.id === id ? { ...prev, durum } : prev); }}
          isOnline={isOnline}
        />
      )}

      {/* Ana QR Tarama Alanı */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(6,182,212,0.04) 50%, rgba(14,165,233,0.06) 100%)', border: '1px solid rgba(52,211,153,0.18)' }}>
        {/* Köşe dekorasyonları */}
        <div className="absolute top-0 left-0 w-16 h-16 opacity-20" style={{ background: 'radial-gradient(circle at top left, rgba(52,211,153,0.4), transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-20 h-20 opacity-15" style={{ background: 'radial-gradient(circle at bottom right, rgba(6,182,212,0.4), transparent 70%)' }} />

        {showQr ? (
          <div className="p-4 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center rounded-xl" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <i className="ri-qr-scan-2-line text-xs" style={{ color: '#34D399' }} />
                </div>
                <p className="text-sm font-bold" style={{ color: '#34D399', letterSpacing: '-0.02em' }}>QR Kod Taranıyor</p>
              </div>
              <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-xl cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
          </div>
        ) : (
          <button
            onClick={() => setShowQr(true)}
            className="w-full relative z-10 cursor-pointer transition-all duration-300 group"
            style={{ padding: '32px 24px' }}
          >
            {/* İkon + animasyon */}
            <div className="flex flex-col items-center gap-5">
              {/* Pulse ring + QR ikonu */}
              <div className="relative">
                {/* Dış pulse halkası */}
                <div className="absolute inset-0 rounded-2xl" style={{ background: 'rgba(52,211,153,0.06)', animation: 'qrPulseRing 3s ease-in-out infinite', transform: 'scale(1.3)' }} />
                {/* Orta halka */}
                <div className="absolute inset-0 rounded-2xl" style={{ background: 'rgba(52,211,153,0.08)', animation: 'qrPulseRing 3s ease-in-out infinite 0.5s', transform: 'scale(1.15)' }} />
                {/* Ana ikon kutusu */}
                <div className="relative w-28 h-28 flex items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(6,182,212,0.08))', border: '1.5px solid rgba(52,211,153,0.28)' }}>
                  {/* Köşe çizgileri */}
                  <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: '#34D399' }} />
                  <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: '#34D399' }} />
                  <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: '#34D399' }} />
                  <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: '#34D399' }} />
                  {/* Tarama çizgisi animasyonu */}
                  <div className="absolute left-4 right-4 h-0.5 rounded-full opacity-60" style={{ background: 'linear-gradient(90deg, transparent, #34D399, transparent)', animation: 'qrIdleScan 2.5s ease-in-out infinite', top: '30%' }} />
                  <i className="ri-qr-code-line text-5xl" style={{ color: '#34D399' }} />
                </div>
              </div>

              {/* Metin */}
              <div className="text-center">
                <p className="text-lg font-bold mb-1.5" style={{ color: '#34D399', letterSpacing: '-0.03em' }}>
                  QR Kodu Tara
                </p>
                <p className="text-xs font-medium" style={{ color: '#475569', lineHeight: '1.5' }}>
                  Ekipman etiketini kameranıza gösterin<br />otomatik olarak tanınır
                </p>
              </div>

              {/* Başlat butonu */}
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(6,182,212,0.15))', border: '1px solid rgba(52,211,153,0.35)' }}>
                <i className="ri-camera-line text-sm" style={{ color: '#34D399' }} />
                <span className="text-sm font-bold" style={{ color: '#34D399' }}>Kamerayı Aç</span>
                <i className="ri-arrow-right-s-line text-base" style={{ color: 'rgba(52,211,153,0.6)' }} />
              </div>
            </div>
          </button>
        )}

        <style>{`
          @keyframes qrPulseRing {
            0%, 100% { opacity: 0; transform: scale(1.1); }
            50% { opacity: 1; transform: scale(1.3); }
          }
          @keyframes qrIdleScan {
            0% { top: 18%; opacity: 0.3; }
            50% { top: 72%; opacity: 0.9; }
            100% { top: 18%; opacity: 0.3; }
          }
        `}</style>
      </div>

      {/* Bilgi kartları */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <i className="ri-scan-line text-sm" style={{ color: '#34D399' }} />
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: '#34D399' }}>{scanCount}</p>
            <p className="text-[10px] font-medium" style={{ color: '#475569' }}>Bu oturumda</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: isOnline ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${isOnline ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}` }}>
            <i className={`${isOnline ? 'ri-wifi-line' : 'ri-wifi-off-line'} text-sm`} style={{ color: isOnline ? '#34D399' : '#FBBF24' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: isOnline ? '#34D399' : '#FBBF24' }}>{isOnline ? 'Online' : 'Offline'}</p>
            <p className="text-[10px] font-medium" style={{ color: '#475569' }}>{isOnline ? 'Canlı bağlantı' : 'Yerel kayıt'}</p>
          </div>
        </div>
      </div>

      {/* Nasıl çalışır */}
      <div className="rounded-2xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>NASIL ÇALIŞIR</p>
        <div className="space-y-2.5">
          {[
            { icon: 'ri-qr-code-line', color: '#34D399', text: 'Ekipmandaki QR etiketi kameranıza gösterin' },
            { icon: 'ri-search-eye-line', color: '#0EA5E9', text: 'Sistem otomatik olarak ekipmanı tanır' },
            { icon: 'ri-checkbox-circle-line', color: '#818CF8', text: 'Kontrol yapın veya durum güncelleyin' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${step.color}12`, border: `1px solid ${step.color}22` }}>
                <i className={`${step.icon} text-xs`} style={{ color: step.color }} />
              </div>
              <p className="text-xs font-medium" style={{ color: '#475569' }}>{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Son kontrol edilenler */}
      <RecentEkipmanlar onKontrolYapildi={onKontrolYapildi} onDurumDegistir={onDurumDegistir} isOnline={isOnline} />
    </div>
  );
});

// ─── Son Kontrol Edilen Ekipmanlar ────────────────────────────────────────────
function RecentEkipmanlar({ onKontrolYapildi, onDurumDegistir, isOnline }: {
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
  isOnline: boolean;
}) {
  const { ekipmanlar, firmalar } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const recent = useMemo(() => ekipmanlar.filter(e => !e.silinmis && e.sonKontrolTarihi).sort((a, b) => (b.sonKontrolTarihi ?? '').localeCompare(a.sonKontrolTarihi ?? '')).slice(0, 5), [ekipmanlar]);
  const overdue = useMemo(() => ekipmanlar.filter(e => !e.silinmis && e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()).sort((a, b) => (a.sonrakiKontrolTarihi ?? '').localeCompare(b.sonrakiKontrolTarihi ?? '')).slice(0, 5), [ekipmanlar]);

  const currentEkipman = selectedId ? (ekipmanlar.find(e => e.id === selectedId) ?? null) : null;
  if (overdue.length === 0 && recent.length === 0) return null;

  return (
    <>
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-alarm-warning-line text-sm" style={{ color: '#EF4444' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#EF4444' }}>GECİKMİŞ KONTROLLER</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>{overdue.length}</span>
          </div>
          <div className="space-y-2">
            {overdue.map(e => {
              const sc    = STATUS_CFG[e.durum] ?? STATUS_CFG['Uygun'];
              const firma = firmalar.find(f => f.id === e.firmaId);
              const days  = Math.ceil((new Date(e.sonrakiKontrolTarihi!).getTime() - Date.now()) / 86400000);
              return (
                <button key={e.id} onClick={() => setSelectedId(e.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-left" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }} onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }} onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: sc.bg }}><i className={`${sc.icon} text-sm`} style={{ color: sc.color }} /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{e.ad}</p>{firma && <p className="text-xs" style={{ color: '#475569' }}>{firma.ad}</p>}</div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>{Math.abs(days)} gün gecikmiş</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {recent.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>SON KONTROL EDİLENLER</p>
          <div className="space-y-2">
            {recent.map(e => {
              const sc    = STATUS_CFG[e.durum] ?? STATUS_CFG['Uygun'];
              const firma = firmalar.find(f => f.id === e.firmaId);
              return (
                <button key={e.id} onClick={() => setSelectedId(e.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }} onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: sc.bg }}><i className={`${sc.icon} text-sm`} style={{ color: sc.color }} /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{e.ad}</p>{firma && <p className="text-xs" style={{ color: '#475569' }}>{firma.ad}</p>}</div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span><span className="text-[10px]" style={{ color: '#334155' }}>{new Date(e.sonKontrolTarihi!).toLocaleDateString('tr-TR')}</span></div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <EkipmanListeModal open={!!currentEkipman} onClose={() => setSelectedId(null)} onKontrolYapildi={onKontrolYapildi} onDurumDegistir={onDurumDegistir} isOnline={isOnline} initialEkipmanId={currentEkipman?.id ?? null} />
    </>
  );
}

// ─── Ekipman Sekmesi ──────────────────────────────────────────────────────────
const EkipmanTab = memo(function EkipmanTab({ isOnline, onKontrolYapildi, onDurumDegistir }: {
  isOnline: boolean;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
}) {
  const { ekipmanlar } = useApp();
  const [showEkipmanModal, setShowEkipmanModal] = useState(false);
  const [showFirmaModal, setShowFirmaModal]     = useState(false);
  const [selectedFirmaId, setSelectedFirmaId]   = useState<string | null>(null);

  const aktif       = useMemo(() => ekipmanlar.filter(e => !e.silinmis && !e.cascadeSilindi), [ekipmanlar]);
  const uygunDegil  = useMemo(() => aktif.filter(e => e.durum === 'Uygun Değil').length, [aktif]);
  const gecikmis    = useMemo(() => aktif.filter(e => e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()).length, [aktif]);
  const yaklasan    = useMemo(() => aktif.filter(e => { if (!e.sonrakiKontrolTarihi) return false; const d = Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000); return d >= 0 && d <= 7; }).length, [aktif]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="px-4 py-4 rounded-2xl" style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)' }}><p className="text-2xl font-bold" style={{ color: '#818CF8' }}>{aktif.length}</p><p className="text-xs mt-1 font-medium" style={{ color: '#475569' }}>Toplam Ekipman</p></div>
        <div className="px-4 py-4 rounded-2xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}><p className="text-2xl font-bold" style={{ color: '#34D399' }}>{aktif.filter(e => e.durum === 'Uygun').length}</p><p className="text-xs mt-1 font-medium" style={{ color: '#475569' }}>Uygun</p></div>
        <div className="px-4 py-4 rounded-2xl" style={{ background: uygunDegil > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${uygunDegil > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.07)'}` }}><p className="text-2xl font-bold" style={{ color: uygunDegil > 0 ? '#F87171' : '#475569' }}>{uygunDegil}</p><p className="text-xs mt-1 font-medium" style={{ color: '#475569' }}>Uygun Değil</p></div>
        <div className="px-4 py-4 rounded-2xl" style={{ background: gecikmis > 0 ? 'rgba(239,68,68,0.08)' : yaklasan > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${gecikmis > 0 ? 'rgba(239,68,68,0.2)' : yaklasan > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)'}` }}><p className="text-2xl font-bold" style={{ color: gecikmis > 0 ? '#EF4444' : yaklasan > 0 ? '#FBBF24' : '#475569' }}>{gecikmis + yaklasan}</p><p className="text-xs mt-1 font-medium" style={{ color: '#475569' }}>Gecikmiş / Yaklaşan</p></div>
      </div>
      {(uygunDegil > 0 || gecikmis > 0) && (
        <div className="space-y-2">
          {uygunDegil > 0 && <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}><i className="ri-error-warning-fill text-sm" style={{ color: '#EF4444' }} /><p className="text-sm font-semibold flex-1" style={{ color: '#F87171' }}>{uygunDegil} ekipman uygun değil</p><button onClick={() => setShowEkipmanModal(true)} className="text-xs font-semibold cursor-pointer whitespace-nowrap" style={{ color: '#EF4444' }}>Görüntüle →</button></div>}
          {gecikmis > 0 && <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}><i className="ri-time-line text-sm" style={{ color: '#FBBF24' }} /><p className="text-sm font-semibold flex-1" style={{ color: '#FCD34D' }}>{gecikmis} ekipman kontrolü gecikmiş</p><button onClick={() => setShowEkipmanModal(true)} className="text-xs font-semibold cursor-pointer whitespace-nowrap" style={{ color: '#FBBF24' }}>Görüntüle →</button></div>}
        </div>
      )}
      <button onClick={() => setShowEkipmanModal(true)} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl cursor-pointer transition-all duration-200" style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.18)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.1)'; }}>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(129,140,248,0.2)' }}><i className="ri-checkbox-circle-line text-xl" style={{ color: '#818CF8' }} /></div>
        <div className="text-left"><p className="text-sm font-bold" style={{ color: '#818CF8' }}>Ekipman Kontrol Listesi</p><p className="text-xs" style={{ color: '#475569' }}>{aktif.length} ekipman — tümünü görüntüle</p></div>
        <i className="ri-arrow-right-s-line text-lg ml-auto" style={{ color: '#818CF8' }} />
      </button>
      <FirmaOzeti onFirmaEkipmanAc={(id) => { setSelectedFirmaId(id); setShowFirmaModal(true); }} />
      <EkipmanListeModal open={showEkipmanModal} onClose={() => setShowEkipmanModal(false)} onKontrolYapildi={onKontrolYapildi} onDurumDegistir={onDurumDegistir} isOnline={isOnline} />
      <FirmaEkipmanModal open={showFirmaModal} firmaId={selectedFirmaId} onClose={() => { setShowFirmaModal(false); setSelectedFirmaId(null); }} onKontrolYapildi={onKontrolYapildi} onDurumDegistir={onDurumDegistir} isOnline={isOnline} />
    </div>
  );
});

// ─── Uygunsuzluk Sekmesi ──────────────────────────────────────────────────────
const UygunsuzlukTab = memo(function UygunsuzlukTab() {
  const { uygunsuzluklar, firmalar } = useApp();
  const [tab,          setTab]          = useState<'acik' | 'kapali'>('acik');
  const [detailRecord, setDetailRecord] = useState<Uygunsuzluk | null>(null);
  const [kapatmaRecord,setKapatmaRecord]= useState<Uygunsuzluk | null>(null);
  const [editRecord,   setEditRecord]   = useState<Uygunsuzluk | null>(null);
  const [showForm,     setShowForm]     = useState(false);

  const aktif     = useMemo(() => uygunsuzluklar.filter(u => !u.silinmis && !u.cascadeSilindi), [uygunsuzluklar]);
  const aciklar   = useMemo(() => aktif.filter(u => u.durum !== 'Kapandı').sort((a, b) => (b.olusturmaTarihi ?? b.tarih ?? '').localeCompare(a.olusturmaTarihi ?? a.tarih ?? '')), [aktif]);
  const kapalilar = useMemo(() => aktif.filter(u => u.durum === 'Kapandı').sort((a, b) => (b.kapatmaTarihi ?? b.olusturmaTarihi ?? b.tarih ?? '').localeCompare(a.kapatmaTarihi ?? a.olusturmaTarihi ?? a.tarih ?? '')), [aktif]);
  const liste     = tab === 'acik' ? aciklar : kapalilar;

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso); if (isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime(); const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Bugün'; if (days === 1) return 'Dün'; if (days < 7) return `${days} gün önce`;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  return (
    <>
      <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl cursor-pointer transition-all duration-200 mb-4" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.18)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; }}>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(248,113,113,0.2)' }}><i className="ri-add-circle-line text-xl" style={{ color: '#F87171' }} /></div>
        <div className="text-left"><p className="text-sm font-bold" style={{ color: '#F87171' }}>Yeni Uygunsuzluk Kaydı</p><p className="text-xs" style={{ color: '#475569' }}>Saha tespitini hemen kaydet</p></div>
        <i className="ri-arrow-right-s-line text-lg ml-auto" style={{ color: '#F87171' }} />
      </button>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}><p className="text-xl font-bold" style={{ color: '#F87171' }}>{aciklar.length}</p><p className="text-xs mt-0.5 font-medium" style={{ color: '#475569' }}>Açık</p></div>
        <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}><p className="text-xl font-bold" style={{ color: '#34D399' }}>{kapalilar.length}</p><p className="text-xs mt-0.5 font-medium" style={{ color: '#475569' }}>Kapalı</p></div>
      </div>
      <div className="flex items-center gap-1 px-1 py-1 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => setTab('acik')} className="flex-1 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap" style={{ background: tab === 'acik' ? 'rgba(239,68,68,0.2)' : 'transparent', color: tab === 'acik' ? '#F87171' : '#64748B' }}>Açık ({aciklar.length})</button>
        <button onClick={() => setTab('kapali')} className="flex-1 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap" style={{ background: tab === 'kapali' ? 'rgba(34,197,94,0.2)' : 'transparent', color: tab === 'kapali' ? '#22C55E' : '#64748B' }}>Kapalı ({kapalilar.length})</button>
      </div>
      {liste.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <i className={`${tab === 'acik' ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'} text-3xl`} style={{ color: '#334155' }} />
          <p className="text-xs mt-2 font-medium" style={{ color: '#475569' }}>{tab === 'acik' ? 'Açık uygunsuzluk yok' : 'Kapalı uygunsuzluk yok'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {liste.map(u => {
            const firma = firmalar.find(f => f.id === u.firmaId);
            const sc    = STATUS_CONFIG[u.durum] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)', icon: 'ri-question-line', label: u.durum };
            const sev   = SEV_CONFIG[u.severity] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8' };
            const isKritik = u.severity === 'Kritik';
            const acilColor = isKritik ? '#EF4444' : u.severity === 'Yüksek' ? '#F97316' : '#FBBF24';
            return (
              <button key={u.id} onClick={() => setDetailRecord(u)} className="w-full flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isKritik && tab === 'acik' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}` }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: `${acilColor}18` }}><i className={`${sc.icon} text-sm`} style={{ color: acilColor }} /></div>
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
                </div>
              </button>
            );
          })}
        </div>
      )}
      <SahaDetayModal record={detailRecord} onClose={() => setDetailRecord(null)} onKapat={(rec) => { setDetailRecord(null); setKapatmaRecord(rec); }} onEdit={(rec) => { setDetailRecord(null); setEditRecord(rec); setShowForm(true); }} />
      <SahaKapatmaModal record={kapatmaRecord} onClose={() => setKapatmaRecord(null)} />
      <SahaUygunsuzlukForm isOpen={showForm} onClose={() => { setShowForm(false); setEditRecord(null); }} editRecord={editRecord} />
    </>
  );
});

// ─── QR Ekipman Kartı ─────────────────────────────────────────────────────────
function QrEkipmanKart({ ekipman, onClose, onKontrolYapildi, onDurumDegistir, isOnline }: {
  ekipman: Ekipman;
  onClose: () => void;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
  isOnline: boolean;
}) {
  const [kontrolBasarili, setKontrolBasarili] = useState(false);
  const handleKontrol = (id: string) => { onKontrolYapildi(id); setKontrolBasarili(true); setTimeout(() => setKontrolBasarili(false), 3000); };
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.25)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center"><i className="ri-qr-code-line text-sm" style={{ color: '#34D399' }} /></div>
          <span className="text-xs font-bold" style={{ color: '#34D399' }}>QR ile Bulunan Ekipman</span>
          {!isOnline && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>Çevrimdışı</span>}
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}><i className="ri-close-line text-xs" /></button>
      </div>
      <EkipmanDetayPanel ekipman={ekipman} onBack={onClose} onKontrolYapildi={handleKontrol} onDurumDegistir={onDurumDegistir} isOnline={isOnline} kontrolBasarili={kontrolBasarili} />
    </div>
  );
}

// ─── Ana Saha Sayfası ─────────────────────────────────────────────────────────
export default function SahaPage() {
  const { ekipmanlar, updateEkipman, addEkipmanKontrolKaydi, addToast, ekipmanKontrolBildirimi, currentUser, dataLoading, uygunsuzluklar, isIzinleri, org } = useApp();

  const isGeziciUzman = org?.osgbRole === 'gezici_uzman';
  const visibleTabs = isGeziciUzman ? TABS : TABS.filter(t => t.id !== 'ziyaret');
  const [activeTab, setActiveTab] = useState<SahaTab>(() => isGeziciUzman ? 'ziyaret' : 'qr');
  const [showPendingModal,   setShowPendingModal]   = useState(false);
  const [showHistoryModal,   setShowHistoryModal]   = useState(false);
  const [showInspectorModal, setShowInspectorModal] = useState(false);

  // ── Global queue context (tek instance) ──────────────────────────────────
  const { isOnline, isSyncing, pendingCount, pendingItems, lastSyncAt, syncError, queueLimitWarn, sessionId, addToQueue, syncNow, forceSyncAll, clearQueue, retryItem } = useQueue();

  const [pendingQrId, setPendingQrId] = useState<string | null>(() => sessionStorage.getItem('qr_ekipman_id'));

  useEffect(() => { const qrId = sessionStorage.getItem('qr_ekipman_id'); if (qrId) setPendingQrId(qrId); }, []);
  useEffect(() => {
    if (!pendingQrId || dataLoading) return;
    const ekipman = ekipmanlar.find(e => e.id === pendingQrId);
    sessionStorage.removeItem('qr_ekipman_id'); setPendingQrId(null);
    if (ekipman) { setActiveTab('qr'); addToast(`Ekipman bulundu: ${ekipman.ad}`, 'success'); }
    else addToast('QR kodu okundu fakat ekipman bulunamadı.', 'warning');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQrId, dataLoading, ekipmanlar]);

  useEffect(() => { void loadJsQR(); }, []);

  // Admin / dev tespiti — email domain veya role ile
  const { user: authUser } = useAuth();
  const isAdmin = useMemo(() => {
    if (!authUser?.email) return false;
    const email = authUser.email.toLowerCase();
    // super-admin, dev, osgb-admin rolleri
    const adminDomains = ['@admin.', '@dev.', 'superadmin', '+admin'];
    const isAdminEmail = adminDomains.some(d => email.includes(d));
    const isAdminRole  = authUser.user_metadata?.role === 'super_admin'
      || authUser.user_metadata?.role === 'osgb_admin'
      || authUser.user_metadata?.is_admin === true;
    // OSGB yöneticisi de görür
    const isOsgbYonetici = org?.osgbRole === 'yonetici' || org?.osgbRole === 'admin';
    return isAdminEmail || isAdminRole || isOsgbYonetici;
  }, [authUser, org]);

  // Sync tamamlandığında toast — kaç işlem sync'lendi bilgisi ile
  const prevSyncingRef  = useRef(false);
  const prevPendingRef  = useRef(pendingCount);
  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && isOnline) {
      const synced = prevPendingRef.current;
      if (synced > 0) {
        if (syncError) {
          addToast(`Bazı işlemler gönderilemedi — ${syncError}`, 'error');
        } else {
          addToast(`${synced} işlem senkronize edildi`, 'success');
        }
      }
    }
    if (!isSyncing) prevPendingRef.current = pendingCount;
    prevSyncingRef.current = isSyncing;
  }, [isSyncing, pendingCount, isOnline, addToast, syncError]);

  // ── Ekipman kontrol handler'ları ──────────────────────────────────────────
  const handleKontrolYapildi = useCallback(async (ekipmanId: string) => {
    const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
    if (!ekipman || !org?.id) return;
    const now        = new Date().toISOString();
    const today      = now.split('T')[0];
    const sonraki    = new Date(); sonraki.setMonth(sonraki.getMonth() + 1);
    const sonrakiStr = sonraki.toISOString().split('T')[0];
    const gecikmisDi = ekipman.sonrakiKontrolTarihi ? new Date(ekipman.sonrakiKontrolTarihi) < new Date() : false;

    // Yeni kontrol kaydı — hem UI hem Supabase'e aynı ID ile gidecek
    const yeniKayitId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const yeniKayit = {
      id:            yeniKayitId,
      tarih:         now,
      kontrolEden:   currentUser?.ad || 'Saha Kullanıcısı',
      kontrolEdenId: currentUser?.id || '',
      durum:         'Uygun' as const,
      kaynak:        'qr' as const,
    };

    // Optimistic UI güncelle
    addEkipmanKontrolKaydi(ekipmanId, yeniKayit);
    updateEkipman(ekipmanId, { sonrakiKontrolTarihi: sonrakiStr });
    ekipmanKontrolBildirimi(ekipman.ad, ekipmanId, 'Uygun', gecikmisDi);

    // Online ve offline her iki durumda da queue üzerinden Supabase'e yaz
    await addToQueue({
      type:  'ekipman_kontrol',
      label: `${ekipman.ad} — Kontrol kaydı`,
      payload: {
        ekipmanId,
        organizationId:       org.id,
        sonKontrolTarihi:     today,
        sonrakiKontrolTarihi: sonrakiStr,
        durum:                'Uygun',
        yeniKayit,
      } as unknown as Record<string, unknown>,
    });

    if (!isOnline) {
      addToast('Kontrol kaydedildi (çevrimdışı) — bağlantı gelince sunucuya gönderilecek.', 'success');
    } else {
      // Online ise hemen sync et
      void syncNow();
      addToast('Kontrol başarıyla kaydedildi — durum "Uygun" olarak güncellendi.', 'success');
    }
  }, [ekipmanlar, updateEkipman, addEkipmanKontrolKaydi, currentUser, ekipmanKontrolBildirimi, isOnline, addToQueue, syncNow, addToast, org]);

  const handleDurumDegistir = useCallback(async (ekipmanId: string, yeniDurum: EkipmanStatus, aciklama?: string, foto?: File | null) => {
    const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
    if (!ekipman || ekipman.durum === yeniDurum || !org?.id) return;
    const now   = new Date().toISOString();
    const orgId = org.id;
    let fotoUrl: string | undefined;
    if (foto) {
      try { const u = await uploadFileToStorage(foto, orgId, 'ekipman-kontrol', `${ekipmanId}-${Date.now()}`); if (u) fotoUrl = u; } catch { /* devam et */ }
    }

    const yeniKayitId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const yeniKayit = {
      id:            yeniKayitId,
      tarih:         now,
      kontrolEden:   currentUser?.ad || 'Saha Kullanıcısı',
      kontrolEdenId: currentUser?.id || '',
      durum:         yeniDurum,
      notlar:        aciklama || undefined,
      fotoUrl,
      kaynak:        'qr' as const,
    };

    // Optimistic UI güncelle
    addEkipmanKontrolKaydi(ekipmanId, yeniKayit);

    await addToQueue({
      type:  'ekipman_durum',
      label: `${ekipman.ad} — Durum: ${yeniDurum}`,
      payload: {
        ekipmanId,
        organizationId: orgId,
        durum:          yeniDurum,
        yeniKayit,
      } as unknown as Record<string, unknown>,
    });

    if (!isOnline) {
      addToast(`İşlem kaydedildi (çevrimdışı) — bağlantı gelince sunucuya gönderilecek.`, 'success');
    } else {
      void syncNow();
      addToast(`İşlem başarıyla kaydedildi — durum "${yeniDurum}" olarak güncellendi.`, 'success');
    }
  }, [ekipmanlar, addEkipmanKontrolKaydi, currentUser, org, isOnline, addToQueue, syncNow, addToast]);

  // ── Badge sayıları ─────────────────────────────────────────────────────────
  const { uygunsuzlukBadge, izinBadge, ekipmanBadge } = useMemo(() => ({
    uygunsuzlukBadge: uygunsuzluklar.filter(u => !u.silinmis && !u.cascadeSilindi && u.durum !== 'Kapandı').length,
    izinBadge:        isIzinleri.filter(i => !i.silinmis && i.durum === 'Onay Bekliyor').length,
    ekipmanBadge:     ekipmanlar.filter(e => !e.silinmis && !e.cascadeSilindi && (e.durum === 'Uygun Değil' || (e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()))).length,
  }), [ekipmanlar, uygunsuzluklar, isIzinleri]);



  return (
    <div className="flex flex-col min-h-screen pb-8" style={{ maxWidth: '520px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Başlık Kartı */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--bg-card-solid, rgba(17,24,39,0.8))', border: '1px solid rgba(14,165,233,0.2)' }}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #0284C7 0%, #0EA5E9 50%, #38BDF8 100%)' }} />
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)' }}><i className="ri-map-pin-user-line text-lg" style={{ color: '#0EA5E9' }} /></div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary, #f1f5f9)', letterSpacing: '-0.02em' }}>Saha Denetimleri</h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted, #64748b)' }}>Hızlı saha işlemleri</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <button onClick={() => setShowPendingModal(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}>
                  <i className="ri-time-line text-xs" /><span className="text-xs font-bold">{pendingCount}</span>
                </button>
              )}
              <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#0EA5E9' }} />
                {isOnline ? 'Aktif' : 'Çevrimdışı'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-error-warning-line text-xs" style={{ color: uygunsuzlukBadge > 0 ? '#F87171' : '#334155' }} /></div><span className="text-[11px] font-semibold" style={{ color: uygunsuzlukBadge > 0 ? '#F87171' : '#334155' }}>{uygunsuzlukBadge} açık</span></div>
            <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-tools-line text-xs" style={{ color: ekipmanBadge > 0 ? '#FBBF24' : '#334155' }} /></div><span className="text-[11px] font-semibold" style={{ color: ekipmanBadge > 0 ? '#FBBF24' : '#334155' }}>{ekipmanBadge} ekipman</span></div>
            <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-shield-keyhole-line text-xs" style={{ color: izinBadge > 0 ? '#F59E0B' : '#334155' }} /></div><span className="text-[11px] font-semibold" style={{ color: izinBadge > 0 ? '#F59E0B' : '#334155' }}>{izinBadge} bekleyen izin</span></div>
          </div>
        </div>
      </div>

      {/* Offline Durum Bandı */}
      <div className="mb-4">
        <OfflineBand isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} lastSyncAt={lastSyncAt} syncError={syncError} queueLimitWarn={queueLimitWarn} isAdmin={isAdmin} onSyncNow={() => void syncNow()} onForceSyncAll={() => void forceSyncAll()} onShowDetails={() => setShowPendingModal(true)} />
      </div>

      {/* Sekme Navigasyonu */}
      <div className="flex items-center gap-0.5 mb-5 p-1 rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', scrollbarWidth: 'none' }}>
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          const badge    = tab.id === 'ekipman' ? ekipmanBadge : tab.id === 'izin' ? izinBadge : tab.id === 'uygunsuzluk' ? uygunsuzlukBadge : 0;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl cursor-pointer transition-all duration-200 whitespace-nowrap flex-1 min-w-0"
              style={{ background: isActive ? tab.activeBg : 'transparent', border: isActive ? `1px solid ${tab.color}38` : '1px solid transparent' }}>
              {badge > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: '#EF4444', zIndex: 1 }}>{badge > 9 ? '9+' : badge}</span>}
              <div className="w-5 h-5 flex items-center justify-center"><i className={`${tab.icon} text-sm`} style={{ color: isActive ? tab.color : '#475569' }} /></div>
              <span className="text-[10px] font-bold leading-none" style={{ color: isActive ? tab.color : '#475569' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sekme İçerikleri */}
      <div className="flex-1">
        {activeTab === 'ziyaret'     && <ZiyaretCheckIn />}
        {activeTab === 'qr'          && <QrTab isOnline={isOnline} onKontrolYapildi={handleKontrolYapildi} onDurumDegistir={handleDurumDegistir} />}
        {activeTab === 'ekipman'     && <EkipmanTab isOnline={isOnline} onKontrolYapildi={handleKontrolYapildi} onDurumDegistir={handleDurumDegistir} />}
        {activeTab === 'izin'        && <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}><IsIzniSahaBolumu /></div>}
        {activeTab === 'uygunsuzluk' && <UygunsuzlukTab />}
      </div>

      <PendingModal
        open={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        items={pendingItems}
        isOnline={isOnline}
        isSyncing={isSyncing}
        isAdmin={isAdmin}
        onSyncNow={() => void syncNow()}
        onForceSyncAll={() => void forceSyncAll()}
        onClear={() => void clearQueue()}
        onShowHistory={() => { setShowPendingModal(false); setShowHistoryModal(true); }}
        onShowInspector={() => { setShowPendingModal(false); setShowInspectorModal(true); }}
        sessionId={sessionId}
      />
      <SyncHistoryPanel
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
      {isAdmin && (
        <QueueInspector
          open={showInspectorModal}
          onClose={() => setShowInspectorModal(false)}
          items={pendingItems}
          isOnline={isOnline}
          isSyncing={isSyncing}
          isAdmin={isAdmin}
          onRetry={(id) => void retryItem(id)}
          onClear={() => void clearQueue()}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}


