import { useState } from 'react';
import type { EkipmanKontrolKaydi, EkipmanStatus } from '@/types';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

const DURUM_CFG: Record<EkipmanStatus, { color: string; bg: string; icon: string; label: string }> = {
  'Uygun':       { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  icon: 'ri-checkbox-circle-line', label: 'Uygun' },
  'Uygun Değil': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line',    label: 'Uygun Değil' },
  'Bakımda':     { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  icon: 'ri-time-line',            label: 'Bakımda' },
  'Hurda':       { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-delete-bin-line',      label: 'Hurda' },
};

// Fotoğraf görüntüleyici — signed URL ile açar
function KontrolFoto({ fotoUrl }: { fotoUrl: string }) {
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const handleLoad = async () => {
    if (signedUrl) return;
    setLoading(true);
    try {
      const url = await getSignedUrlFromPath(fotoUrl);
      if (url) setSignedUrl(url);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    const win = window.open('', '_blank');
    if (win) win.document.write('<html><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Yükleniyor...</p></body></html>');
    const url = signedUrl ?? await getSignedUrlFromPath(fotoUrl);
    if (url && win && !win.closed) win.location.href = url;
    else if (win && !win.closed) win.close();
  };

  if (error) return null;

  return (
    <div className="mt-2 rounded-xl overflow-hidden cursor-pointer group relative"
      style={{ border: '1px solid rgba(255,255,255,0.08)', maxHeight: '160px' }}
      onMouseEnter={handleLoad}
      onClick={() => void handleOpen()}>
      {signedUrl ? (
        <>
          <img
            src={signedUrl}
            alt="Kontrol fotoğrafı"
            className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ maxHeight: '160px' }}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: 'rgba(0,0,0,0.45)' }}>
            <div className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
              <i className="ri-zoom-in-line text-white text-base" />
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="flex items-center justify-center py-8" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <i className="ri-loader-4-line animate-spin text-lg" style={{ color: '#475569' }} />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-3 cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'rgba(251,191,36,0.12)' }}>
            <i className="ri-image-line text-sm" style={{ color: '#FBBF24' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>Fotoğrafı görüntüle</span>
          <i className="ri-external-link-line text-xs ml-auto" style={{ color: '#475569' }} />
        </div>
      )}
    </div>
  );
}

interface Props {
  gecmis: EkipmanKontrolKaydi[];
}

export default function KontrolGecmisiPanel({ gecmis }: Props) {
  const sorted = [...gecmis].sort((a, b) => b.tarih.localeCompare(a.tarih));

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <div className="w-12 h-12 flex items-center justify-center rounded-xl mb-3"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <i className="ri-history-line text-xl" style={{ color: '#FBBF24' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Henüz kontrol kaydı yok</p>
        <p className="text-xs mt-1 text-center" style={{ color: '#334155' }}>
          QR okutulduğunda veya manuel kontrol yapıldığında burada görünür
        </p>
      </div>
    );
  }

  // İstatistikler
  const uygunSayisi = sorted.filter(k => k.durum === 'Uygun').length;
  const uygunDegil = sorted.filter(k => k.durum === 'Uygun Değil').length;
  const fotoluKayit = sorted.filter(k => k.fotoUrl).length;

  return (
    <div className="space-y-3">
      {/* Özet kartları */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center py-2.5 rounded-xl"
          style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)' }}>
          <span className="text-lg font-bold" style={{ color: '#818CF8' }}>{sorted.length}</span>
          <span className="text-[10px] mt-0.5 font-medium" style={{ color: '#475569' }}>Toplam</span>
        </div>
        <div className="flex flex-col items-center py-2.5 rounded-xl"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
          <span className="text-lg font-bold" style={{ color: '#34D399' }}>{uygunSayisi}</span>
          <span className="text-[10px] mt-0.5 font-medium" style={{ color: '#475569' }}>Uygun</span>
        </div>
        <div className="flex flex-col items-center py-2.5 rounded-xl"
          style={{ background: uygunDegil > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${uygunDegil > 0 ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.07)'}` }}>
          <span className="text-lg font-bold" style={{ color: uygunDegil > 0 ? '#F87171' : '#475569' }}>{uygunDegil}</span>
          <span className="text-[10px] mt-0.5 font-medium" style={{ color: '#475569' }}>Uygun Değil</span>
        </div>
      </div>

      {fotoluKayit > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <i className="ri-camera-line text-xs" style={{ color: '#FBBF24' }} />
          <span className="text-xs" style={{ color: '#FBBF24' }}>{fotoluKayit} kayıtta fotoğraf mevcut</span>
        </div>
      )}

      {/* Kayıtlar */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {sorted.map((kayit, idx) => {
          const cfg = DURUM_CFG[kayit.durum] ?? DURUM_CFG['Uygun'];
          const isFirst = idx === 0;
          const tarih = new Date(kayit.tarih);
          return (
            <div key={kayit.id}
              className="px-3 py-3 rounded-xl transition-all"
              style={{
                background: isFirst ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isFirst ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {/* Üst satır */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: cfg.bg }}>
                  <i className={`${cfg.icon} text-xs`} style={{ color: cfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    {isFirst && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
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
                    {kayit.fotoUrl && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap"
                        style={{ background: 'rgba(251,191,36,0.12)', color: '#FBBF24' }}>
                        <i className="ri-camera-line mr-0.5" />Fotoğraf
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs flex items-center gap-1" style={{ color: '#94A3B8' }}>
                      <i className="ri-user-line text-[10px]" />
                      {kayit.kontrolEden}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: '#64748B' }}>
                      <i className="ri-calendar-line text-[10px]" />
                      {tarih.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      <span style={{ color: '#475569' }}>
                        {' '}{tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </div>

                  {kayit.notlar && (
                    <p className="text-xs mt-1.5 px-2 py-1.5 rounded-lg italic"
                      style={{ color: '#64748B', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <i className="ri-chat-1-line mr-1 text-[10px]" />
                      {kayit.notlar}
                    </p>
                  )}
                </div>
              </div>

              {/* Fotoğraf */}
              {kayit.fotoUrl && (
                <div className="mt-2 ml-11">
                  <KontrolFoto fotoUrl={kayit.fotoUrl} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
