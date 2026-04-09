import { useState } from 'react';
import type { EkipmanKontrolKaydi, EkipmanStatus } from '@/types';
import { getSignedUrlFromPath } from '@/utils/fileUpload';
import { useApp } from '@/store/AppContext';

const DURUM_CFG: Record<EkipmanStatus, { color: string; bg: string; icon: string }> = {
  'Uygun':       { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  icon: 'ri-checkbox-circle-line' },
  'Uygun Değil': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
  'Bakımda':     { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  icon: 'ri-time-line' },
  'Hurda':       { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-delete-bin-line' },
};

// ─── Fotoğraf Lightbox ───────────────────────────────────────────────────────
function FotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(248,113,113,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Başlık */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'rgba(248,113,113,0.1)', borderBottom: '1px solid rgba(248,113,113,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-image-line text-sm" style={{ color: '#F87171' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: '#F87171' }}>Uygun Değil — Sorun Fotoğrafı</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#F87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94A3B8'; }}
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* Fotoğraf */}
        <div style={{ background: '#0A0F1E', maxHeight: '70vh', overflow: 'hidden' }}>
          <img
            src={url}
            alt="Sorun fotoğrafı"
            className="w-full h-full object-contain"
            style={{ maxHeight: '70vh' }}
          />
        </div>

        {/* Alt bilgi */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-xs" style={{ color: '#475569' }}>Kapatmak için dışarıya tıklayın</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <i className="ri-external-link-line text-xs" />
            Tam Ekran Aç
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Fotoğraf Butonu ─────────────────────────────────────────────────────────
function FotoButton({ fotoUrl }: { fotoUrl: string }) {
  const { addToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  const handleClick = async () => {
    if (signedUrl) {
      setShowLightbox(true);
      return;
    }
    setLoading(true);
    try {
      const url = await getSignedUrlFromPath(fotoUrl);
      if (!url) {
        addToast('Fotoğraf yüklenemedi.', 'error');
        return;
      }
      setSignedUrl(url);
      setShowLightbox(true);
    } catch {
      addToast('Fotoğraf açılırken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => void handleClick()}
        disabled={loading}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap"
        style={{
          background: 'rgba(248,113,113,0.12)',
          border: '1px solid rgba(248,113,113,0.25)',
          color: '#F87171',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.22)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.12)'; }}
        title="Sorun fotoğrafını görüntüle"
      >
        {loading
          ? <i className="ri-loader-4-line animate-spin text-[10px]" />
          : <i className="ri-image-line text-[10px]" />
        }
        {loading ? 'Yükleniyor...' : 'Fotoğraf'}
      </button>

      {showLightbox && signedUrl && (
        <FotoLightbox url={signedUrl} onClose={() => setShowLightbox(false)} />
      )}
    </>
  );
}

// ─── Ana Panel ───────────────────────────────────────────────────────────────
interface Props {
  gecmis: EkipmanKontrolKaydi[];
}

export default function KontrolGecmisiPanel({ gecmis }: Props) {
  if (gecmis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <div className="w-12 h-12 flex items-center justify-center rounded-xl mb-3"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <i className="ri-history-line text-xl" style={{ color: '#FBBF24' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Henüz kontrol kaydı yok</p>
        <p className="text-xs mt-1" style={{ color: '#334155' }}>
          QR okutulduğunda veya manuel kontrol yapıldığında burada görünür
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Özet */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <i className="ri-history-line text-sm" style={{ color: '#818CF8' }} />
        <span className="text-xs font-semibold" style={{ color: '#818CF8' }}>
          Toplam {gecmis.length} kontrol kaydı
        </span>
        <span className="text-xs ml-auto" style={{ color: '#475569' }}>
          Son: {new Date(gecmis[0].tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      </div>

      {/* Kayıtlar */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {gecmis.map((kayit, idx) => {
          const cfg = DURUM_CFG[kayit.durum] ?? DURUM_CFG['Uygun'];
          const isFirst = idx === 0;
          const isUygunDegil = kayit.durum === 'Uygun Değil';

          return (
            <div key={kayit.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: isFirst
                  ? (isUygunDegil ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.05)')
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isFirst
                  ? (isUygunDegil ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.15)')
                  : 'rgba(255,255,255,0.06)'}`,
              }}>
              {/* İkon */}
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                style={{ background: cfg.bg }}>
                <i className={`${cfg.icon} text-xs`} style={{ color: cfg.color }} />
              </div>

              {/* İçerik */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {kayit.durum}
                  </span>
                  {isFirst && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        background: isUygunDegil ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)',
                        color: isUygunDegil ? '#F87171' : '#34D399',
                      }}>
                      Son Kontrol
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap"
                    style={{
                      background: kayit.kaynak === 'qr' ? 'rgba(168,85,247,0.12)' : 'rgba(99,102,241,0.12)',
                      color: kayit.kaynak === 'qr' ? '#A855F7' : '#818CF8',
                    }}>
                    <i className={`${kayit.kaynak === 'qr' ? 'ri-qr-code-line' : 'ri-edit-line'} mr-0.5`} />
                    {kayit.kaynak === 'qr' ? 'QR' : 'Manuel'}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs flex items-center gap-1" style={{ color: '#94A3B8' }}>
                    <i className="ri-user-line text-[10px]" />
                    {kayit.kontrolEden}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: '#64748B' }}>
                    <i className="ri-calendar-line text-[10px]" />
                    {new Date(kayit.tarih).toLocaleDateString('tr-TR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                    {' '}
                    <span style={{ color: '#475569' }}>
                      {new Date(kayit.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </div>

                {kayit.notlar && (
                  <p className="text-xs mt-1 italic" style={{ color: '#64748B' }}>
                    <i className="ri-chat-1-line mr-1 text-[10px]" />
                    {kayit.notlar}
                  </p>
                )}

                {/* Fotoğraf butonu — Uygun Değil + fotoUrl varsa */}
                {kayit.fotoUrl && (
                  <div className="mt-1.5">
                    <FotoButton fotoUrl={kayit.fotoUrl} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
