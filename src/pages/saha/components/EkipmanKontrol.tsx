import { useState, useEffect, useMemo, memo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/store/AppContext';
import type { Ekipman, EkipmanStatus, Evrak } from '@/types';
import { getSignedUrlFromPath, uploadFileToStorage } from '@/utils/fileUpload';

export const STATUS_CFG: Record<EkipmanStatus, { label: string; color: string; bg: string; icon: string }> = {
  'Uygun':       { label: 'Uygun',       color: '#34D399', bg: 'rgba(52,211,153,0.12)',  icon: 'ri-checkbox-circle-line' },
  'Uygun Değil': { label: 'Uygun Değil', color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
  'Bakımda':     { label: 'Bakımda',     color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  icon: 'ri-time-line' },
  'Hurda':       { label: 'Hurda',       color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-delete-bin-line' },
};

const REQUIRES_DETAIL: EkipmanStatus[] = ['Uygun Değil', 'Bakımda', 'Hurda'];

// ─── Saha Bottom Sheet Wrapper ────────────────────────────────────────────────
interface SahaSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
  maxWidth?: number;
}

function SahaSheet({ open, onClose, title, icon, iconColor = '#34D399', children, maxWidth = 520 }: SahaSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
    } else {
      setAnimIn(false);
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center"
      style={{
        background: animIn ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0)',
        backdropFilter: animIn ? 'blur(6px)' : 'none',
        transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
      }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl flex flex-col"
        style={{
          maxWidth,
          background: 'var(--bg-card, #0f172a)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          maxHeight: '92vh',
          transform: animIn ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {icon && (
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${iconColor}18` }}>
              <i className={`${icon} text-base`} style={{ color: iconColor }} />
            </div>
          )}
          <p className="flex-1 font-bold text-base" style={{ color: 'var(--text-primary, #f1f5f9)' }}>{title}</p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Durum Detay Modal (bottom-sheet) ────────────────────────────────────────
interface DurumDetayModalProps {
  open: boolean;
  durum: EkipmanStatus;
  onConfirm: (aciklama: string, foto: File | null) => void;
  onCancel: () => void;
}

function DurumDetayModal({ open, durum, onConfirm, onCancel }: DurumDetayModalProps) {
  const [aciklama, setAciklama] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const cfg = STATUS_CFG[durum] ?? STATUS_CFG['Uygun Değil'];

  useEffect(() => {
    if (open) { setAciklama(''); setFoto(null); setFotoPreview(null); }
  }, [open]);

  const handleFoto = (file: File) => {
    setFoto(file);
    const reader = new FileReader();
    reader.onload = ev => setFotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const canConfirm = aciklama.trim().length > 0 || foto !== null;

  return (
    <SahaSheet
      open={open}
      onClose={onCancel}
      title={`Durum: ${durum}`}
      icon={cfg.icon}
      iconColor={cfg.color}
      maxWidth={480}
    >
      <div className="space-y-4">
        {/* Açıklama */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
            Açıklama <span className="text-[10px] font-normal" style={{ color: '#475569' }}>(opsiyonel)</span>
          </label>
          <textarea
            value={aciklama}
            onChange={e => setAciklama(e.target.value)}
            placeholder={`${durum} nedeni, gözlem veya öneri...`}
            rows={3}
            maxLength={500}
            className="isg-input resize-none text-sm w-full"
          />
          <p className="text-[10px] mt-1 text-right" style={{ color: '#334155' }}>{aciklama.length}/500</p>
        </div>

        {/* Fotoğraf */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
            Fotoğraf <span className="text-[10px] font-normal" style={{ color: '#475569' }}>(opsiyonel)</span>
          </label>
          {fotoPreview ? (
            <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${cfg.color}40` }}>
              <img src={fotoPreview} alt="Kontrol fotoğrafı" className="w-full object-cover rounded-xl" style={{ maxHeight: '180px' }} />
              <button
                onClick={() => { setFoto(null); setFotoPreview(null); }}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#EF4444' }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { if (fotoRef.current) { fotoRef.current.removeAttribute('capture'); fotoRef.current.click(); } }}
                className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)' }}
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: cfg.bg }}>
                  <i className="ri-image-line text-base" style={{ color: cfg.color }} />
                </div>
                <p className="text-xs font-medium" style={{ color: '#64748B' }}>Galeriden</p>
              </button>
              <button
                onClick={() => { if (fotoRef.current) { fotoRef.current.setAttribute('capture', 'environment'); fotoRef.current.click(); } }}
                className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)' }}
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: cfg.bg }}>
                  <i className="ri-camera-line text-base" style={{ color: cfg.color }} />
                </div>
                <p className="text-xs font-medium" style={{ color: '#64748B' }}>Kamera</p>
              </button>
            </div>
          )}
          <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFoto(f); }} />
        </div>

        {!canConfirm && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <i className="ri-information-line text-xs" style={{ color: '#FBBF24' }} />
            <p className="text-xs" style={{ color: '#FCD34D' }}>En az bir açıklama veya fotoğraf gereklidir.</p>
          </div>
        )}

        <div className="flex gap-2 pt-1 pb-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748B' }}
          >
            İptal
          </button>
          <button
            onClick={() => canConfirm && onConfirm(aciklama, foto)}
            disabled={!canConfirm}
            className="flex-1 py-3 rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: cfg.bg, border: `1px solid ${cfg.color}60`, color: cfg.color }}
          >
            <i className="ri-save-line mr-1" />Kaydet
          </button>
        </div>
      </div>
    </SahaSheet>
  );
}

// ─── Ekipman Evrakları ────────────────────────────────────────────────────────
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
              <button onClick={async () => { const url = await getSignedUrlFromPath(ekipman.dosyaUrl!); if (url) window.open(url, '_blank', 'noopener,noreferrer'); else addToast('Belge açılamadı.', 'error'); }} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
                <i className="ri-eye-line text-sm" />
              </button>
              <button onClick={async () => { const url = await getSignedUrlFromPath(ekipman.dosyaUrl!); if (url) { const a = document.createElement('a'); a.href = url; a.download = ekipman.dosyaAdi || 'belge'; document.body.appendChild(a); a.click(); document.body.removeChild(a); addToast('İndiriliyor...', 'success'); } else addToast('Dosya indirilemedi.', 'error'); }} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}>
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
          <div className="space-y-2">
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
                        <button onClick={() => handleView(evrak)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}><i className="ri-eye-line text-xs" /></button>
                        <button onClick={() => handleDownload(evrak)} disabled={downloading === evrak.id} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}><i className={`${downloading === evrak.id ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'} text-xs`} /></button>
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

// ─── Kontrol Geçmişi ──────────────────────────────────────────────────────────
function KontrolGecmisi({ ekipman }: { ekipman: Ekipman }) {
  const { addToast } = useApp();
  const gecmis = ekipman.kontrolGecmisi ?? [];

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleFotoAc = async (fotoUrl: string) => {
    try {
      const url = await getSignedUrlFromPath(fotoUrl);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else addToast('Fotoğraf açılamadı.', 'error');
    } catch {
      addToast('Fotoğraf açılamadı.', 'error');
    }
  };

  if (gecmis.length === 0) {
    return (
      <div className="text-center py-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <i className="ri-history-line text-2xl" style={{ color: '#334155' }} />
        <p className="text-xs mt-2" style={{ color: '#475569' }}>Henüz kontrol geçmişi yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {gecmis.map((kayit, idx) => {
        const sc = STATUS_CFG[kayit.durum] ?? STATUS_CFG['Uygun'];
        return (
          <div key={kayit.id ?? idx} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${sc.color}25` }}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: sc.bg }}>
                <i className={`${sc.icon} text-sm`} style={{ color: sc.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                  {kayit.kaynak === 'qr' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>QR</span>
                  )}
                </div>
                <p className="text-xs mt-0.5 font-medium" style={{ color: '#94A3B8' }}>{kayit.kontrolEden}</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{fmtDate(kayit.tarih)}</p>
              </div>
            </div>
            {kayit.notlar && (
              <div className="px-3 pb-2.5">
                <p className="text-xs px-2.5 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8', borderLeft: `2px solid ${sc.color}50` }}>
                  {kayit.notlar}
                </p>
              </div>
            )}
            {kayit.fotoUrl && (
              <div className="px-3 pb-2.5">
                <button
                  onClick={() => handleFotoAc(kayit.fotoUrl!)}
                  className="relative w-full rounded-xl overflow-hidden cursor-pointer group"
                  style={{ border: `1px solid ${sc.color}30` }}
                >
                  <FotoThumbnail fotoUrl={kayit.fotoUrl} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.7)' }}>
                      <i className="ri-zoom-in-line text-sm text-white" />
                      <span className="text-xs font-semibold text-white">Büyüt</span>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Fotoğraf thumbnail — signed URL ile yükler
function FotoThumbnail({ fotoUrl }: { fotoUrl: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSignedUrlFromPath(fotoUrl).then(url => {
      if (!cancelled && url) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [fotoUrl]);

  if (!src) {
    return (
      <div className="w-full h-24 flex items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <i className="ri-loader-4-line animate-spin text-lg" style={{ color: '#475569' }} />
      </div>
    );
  }

  return (
    <img src={src} alt="Kontrol fotoğrafı" className="w-full object-cover rounded-xl" style={{ maxHeight: '160px' }} />
  );
}

// ─── Ekipman Detay Paneli ─────────────────────────────────────────────────────
interface EkipmanDetayPanelProps {
  ekipman: Ekipman;
  onBack: () => void;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
  isOnline: boolean;
  kontrolBasarili?: boolean;
}

export const EkipmanDetayPanel = memo(function EkipmanDetayPanel({
  ekipman, onBack, onKontrolYapildi, onDurumDegistir, isOnline, kontrolBasarili,
}: EkipmanDetayPanelProps) {
  const { firmalar } = useApp();
  const [activeTab, setActiveTab] = useState<'detay' | 'gecmis' | 'evraklar'>('detay');
  const [pendingDurum, setPendingDurum] = useState<EkipmanStatus | null>(null);
  const sc = STATUS_CFG[ekipman.durum] ?? STATUS_CFG['Uygun'];
  const firma = firmalar.find(f => f.id === ekipman.firmaId);
  const days = ekipman.sonrakiKontrolTarihi
    ? Math.ceil((new Date(ekipman.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000)
    : null;
  const gecmisCount = ekipman.kontrolGecmisi?.length ?? 0;

  const handleDurumClick = (d: EkipmanStatus) => {
    if (REQUIRES_DETAIL.includes(d)) {
      setPendingDurum(d);
    } else {
      onDurumDegistir(ekipman.id, d);
    }
  };

  const handleDetayConfirm = (aciklama: string, foto: File | null) => {
    if (!pendingDurum) return;
    onDurumDegistir(ekipman.id, pendingDurum, aciklama, foto);
    setPendingDurum(null);
  };

  return (
    <>
      <DurumDetayModal
        open={pendingDurum !== null}
        durum={pendingDurum ?? 'Uygun Değil'}
        onConfirm={handleDetayConfirm}
        onCancel={() => setPendingDurum(null)}
      />

      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: '#64748B' }}>
          <i className="ri-arrow-left-line text-base" />Listeye Dön
        </button>

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

        {/* Ekipman Başlık Kartı */}
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
          <button onClick={() => setActiveTab('detay')} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-150 whitespace-nowrap" style={{ background: activeTab === 'detay' ? 'rgba(52,211,153,0.2)' : 'transparent', color: activeTab === 'detay' ? '#34D399' : '#64748B' }}>
            <i className="ri-tools-line text-xs" />Kontrol
          </button>
          <button onClick={() => setActiveTab('gecmis')} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-150 whitespace-nowrap relative" style={{ background: activeTab === 'gecmis' ? 'rgba(251,191,36,0.2)' : 'transparent', color: activeTab === 'gecmis' ? '#FBBF24' : '#64748B' }}>
            <i className="ri-history-line text-xs" />Geçmiş
            {gecmisCount > 0 && (
              <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.2)', color: '#FBBF24' }}>{gecmisCount}</span>
            )}
          </button>
          <button onClick={() => setActiveTab('evraklar')} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-150 whitespace-nowrap" style={{ background: activeTab === 'evraklar' ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === 'evraklar' ? '#818CF8' : '#64748B' }}>
            <i className="ri-file-list-3-line text-xs" />Evraklar
          </button>
        </div>

        {activeTab === 'detay' && (
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
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl cursor-pointer transition-all duration-200"
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
              <div className="grid grid-cols-2 gap-2">
                {(['Uygun', 'Uygun Değil', 'Bakımda', 'Hurda'] as EkipmanStatus[]).map(d => {
                  const cfg = STATUS_CFG[d];
                  const isActive = ekipman.durum === d;
                  return (
                    <button key={d} onClick={() => handleDurumClick(d)} className="py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap flex items-center justify-center gap-1.5" style={{ background: isActive ? cfg.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? cfg.color + '80' : 'rgba(255,255,255,0.08)'}`, color: isActive ? cfg.color : '#64748B' }}>
                      <i className={`${cfg.icon} text-xs`} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              {REQUIRES_DETAIL.includes(ekipman.durum) && (
                <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: '#475569' }}>
                  <i className="ri-information-line" />
                  Bu durum için açıklama/fotoğraf kontrol geçmişine kaydedildi.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'gecmis' && (
          <KontrolGecmisi ekipman={ekipman} />
        )}

        {activeTab === 'evraklar' && (
          <EkipmanEvraklari ekipman={ekipman} />
        )}
      </div>
    </>
  );
});

// ─── Ekipman Kart (liste satırı) ──────────────────────────────────────────────
interface EkipmanKartProps {
  ekipman: Ekipman;
  firmaAd?: string;
  onClick: () => void;
}

export const EkipmanKart = memo(function EkipmanKart({ ekipman, firmaAd, onClick }: EkipmanKartProps) {
  const sc = STATUS_CFG[ekipman.durum] ?? STATUS_CFG['Uygun'];
  const days = ekipman.sonrakiKontrolTarihi
    ? Math.ceil((new Date(ekipman.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000)
    : null;
  const isOverdue = days !== null && days < 0;
  const isUrgent = days !== null && days >= 0 && days <= 7;

  return (
    <button
      onClick={onClick}
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
        {firmaAd && <p className="text-xs mt-0.5" style={{ color: '#475569' }}><i className="ri-building-2-line mr-0.5" />{firmaAd}</p>}
        {ekipman.tur && <p className="text-xs" style={{ color: '#334155' }}>· {ekipman.tur}</p>}
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
});

// ─── Ekipman Liste Modal (bottom-sheet) ──────────────────────────────────────
interface EkipmanListeModalProps {
  open: boolean;
  onClose: () => void;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
  isOnline: boolean;
  initialEkipmanId?: string | null;
}

export function EkipmanListeModal({ open, onClose, onKontrolYapildi, onDurumDegistir, isOnline, initialEkipmanId }: EkipmanListeModalProps) {
  const { ekipmanlar, firmalar, dataLoading } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kontrolBasarili, setKontrolBasarili] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedId(initialEkipmanId ?? null);
      setKontrolBasarili(false);
    } else {
      setSelectedId(null);
      setKontrolBasarili(false);
    }
  }, [open, initialEkipmanId]);

  const aktif = useMemo(() => ekipmanlar.filter(e => !e.silinmis && !e.cascadeSilindi), [ekipmanlar]);

  const filtered = useMemo(() => aktif.filter(e => {
    const firma = firmalar.find(f => f.id === e.firmaId);
    const q = search.toLowerCase();
    const matchQ = !q || e.ad.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false) || e.seriNo.toLowerCase().includes(q);
    const matchS = !statusFilter || e.durum === statusFilter;
    return matchQ && matchS;
  }), [aktif, firmalar, search, statusFilter]);

  const stats = useMemo(() => ({
    toplam: aktif.length,
    uygun: aktif.filter(e => e.durum === 'Uygun').length,
    uygunDegil: aktif.filter(e => e.durum === 'Uygun Değil').length,
    gecikmis: aktif.filter(e => e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()).length,
  }), [aktif]);

  const handleKontrol = (id: string) => {
    onKontrolYapildi(id);
    setKontrolBasarili(true);
    setTimeout(() => setKontrolBasarili(false), 3000);
  };

  const currentEkipman = selectedId ? (ekipmanlar.find(e => e.id === selectedId) ?? null) : null;

  return (
    <SahaSheet
      open={open}
      onClose={() => { setSelectedId(null); onClose(); }}
      title={currentEkipman ? currentEkipman.ad : 'Ekipman Kontrolleri'}
      icon={currentEkipman ? (STATUS_CFG[currentEkipman.durum]?.icon ?? 'ri-tools-line') : 'ri-tools-line'}
      iconColor={currentEkipman ? (STATUS_CFG[currentEkipman.durum]?.color ?? '#818CF8') : '#818CF8'}
    >
      {currentEkipman ? (
        <EkipmanDetayPanel
          ekipman={currentEkipman}
          onBack={() => { setSelectedId(null); setKontrolBasarili(false); }}
          onKontrolYapildi={handleKontrol}
          onDurumDegistir={onDurumDegistir}
          isOnline={isOnline}
          kontrolBasarili={kontrolBasarili}
        />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Toplam', val: stats.toplam, color: '#818CF8' },
              { label: 'Uygun', val: stats.uygun, color: '#34D399' },
              { label: 'Uygun Değil', val: stats.uygunDegil, color: '#F87171' },
              { label: 'Gecikmiş', val: stats.gecikmis, color: '#EF4444' },
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
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ekipman veya firma ara..." className="isg-input pl-8 text-sm w-full" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input text-sm" style={{ minWidth: '120px' }}>
              <option value="">Tümü</option>
              {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(52,211,153,0.3)', borderTopColor: '#34D399' }} />
              <p className="text-sm font-medium" style={{ color: '#475569' }}>Ekipmanlar yükleniyor...</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <i className="ri-tools-line text-3xl" style={{ color: '#334155' }} />
                  <p className="text-sm mt-2" style={{ color: '#475569' }}>
                    {aktif.length === 0 ? 'Henüz ekipman eklenmemiş' : 'Ekipman bulunamadı'}
                  </p>
                </div>
              ) : filtered.map(ekipman => (
                <EkipmanKart
                  key={ekipman.id}
                  ekipman={ekipman}
                  firmaAd={firmalar.find(f => f.id === ekipman.firmaId)?.ad}
                  onClick={() => { setSelectedId(ekipman.id); setKontrolBasarili(false); }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </SahaSheet>
  );
}

// ─── Firma Ekipman Modal (bottom-sheet) ──────────────────────────────────────
interface FirmaEkipmanModalProps {
  open: boolean;
  firmaId: string | null;
  onClose: () => void;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
  isOnline: boolean;
}

export function FirmaEkipmanModal({ open, firmaId, onClose, onKontrolYapildi, onDurumDegistir, isOnline }: FirmaEkipmanModalProps) {
  const { ekipmanlar, firmalar } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kontrolBasarili, setKontrolBasarili] = useState(false);

  useEffect(() => {
    if (!open) { setSelectedId(null); setKontrolBasarili(false); }
  }, [open]);

  const firma = firmalar.find(f => f.id === firmaId);
  const firmaEkipmanlari = useMemo(() => ekipmanlar.filter(e => e.firmaId === firmaId && !e.silinmis), [ekipmanlar, firmaId]);

  const handleKontrol = (id: string) => {
    onKontrolYapildi(id);
    setKontrolBasarili(true);
    setTimeout(() => setKontrolBasarili(false), 3000);
  };

  const currentEkipman = selectedId ? (ekipmanlar.find(e => e.id === selectedId) ?? null) : null;

  return (
    <SahaSheet
      open={open}
      onClose={() => { setSelectedId(null); onClose(); }}
      title={currentEkipman ? currentEkipman.ad : (firma?.ad ?? 'Firma Ekipmanları')}
      icon={currentEkipman ? (STATUS_CFG[currentEkipman.durum]?.icon ?? 'ri-building-2-line') : 'ri-building-2-line'}
      iconColor={currentEkipman ? (STATUS_CFG[currentEkipman.durum]?.color ?? '#818CF8') : '#818CF8'}
    >
      {currentEkipman ? (
        <EkipmanDetayPanel
          ekipman={currentEkipman}
          onBack={() => { setSelectedId(null); setKontrolBasarili(false); }}
          onKontrolYapildi={handleKontrol}
          onDurumDegistir={onDurumDegistir}
          isOnline={isOnline}
          kontrolBasarili={kontrolBasarili}
        />
      ) : (
        <>
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
          <div className="space-y-2 pb-4">
            {firmaEkipmanlari.length === 0 ? (
              <div className="text-center py-12">
                <i className="ri-tools-line text-3xl" style={{ color: '#334155' }} />
                <p className="text-sm mt-2" style={{ color: '#475569' }}>Bu firmaya ait ekipman yok</p>
              </div>
            ) : firmaEkipmanlari.map(ekipman => (
              <EkipmanKart
                key={ekipman.id}
                ekipman={ekipman}
                onClick={() => { setSelectedId(ekipman.id); setKontrolBasarili(false); }}
              />
            ))}
          </div>
        </>
      )}
    </SahaSheet>
  );
}

// ─── Firma Özeti ──────────────────────────────────────────────────────────────
interface FirmaOzetiProps {
  onFirmaEkipmanAc: (firmaId: string) => void;
}

export const FirmaOzeti = memo(function FirmaOzeti({ onFirmaEkipmanAc }: FirmaOzetiProps) {
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
});
