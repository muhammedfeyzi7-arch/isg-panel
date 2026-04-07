import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import type { IsIzni } from '@/types';
import { getSignedUrl, getSignedUrlFromPath } from '@/utils/fileUpload';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

// ─── Red fotoğrafı bileşeni ───────────────────────────────────────────────────
function RedFotoImg({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    if (src.startsWith('http')) {
      const match = src.match(/\/object\/(?:sign|public)\/uploads\/(.+?)(?:\?|$)/);
      if (match) { getSignedUrlFromPath(match[1]).then(url => setSignedUrl(url)); }
      else { setSignedUrl(src); }
      return;
    }
    getSignedUrlFromPath(src).then(url => setSignedUrl(url));
  }, [src]);
  if (!signedUrl) return <div className="rounded-lg h-20 animate-pulse" style={{ background: 'rgba(239,68,68,0.1)' }} />;
  return <img src={signedUrl} alt="Red fotoğrafı" className={className} style={style} />;
}

// ─── Durum config ────────────────────────────────────────────────────────────
const DURUM_CFG = {
  'Onay Bekliyor': { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: 'ri-time-line' },
  'Onaylandı':     { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)', icon: 'ri-checkbox-circle-line' },
  'Reddedildi':    { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)', icon: 'ri-close-circle-line' },
};

// ─── Evrak listesi ────────────────────────────────────────────────────────────
interface EvrakDosya {
  name: string;
  id: string;
  updated_at: string;
  metadata?: { size?: number };
  _slug?: string;
}

function IsIzniEvraklariSaha({ izinId, orgId, firmaId, izinTuru }: {
  izinId: string;
  orgId: string;
  firmaId: string;
  izinTuru: string;
}) {
  const [dosyalar, setDosyalar] = useState<EvrakDosya[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [acikDosya, setAcikDosya] = useState<string | null>(null);

  const izinTuruSlug = izinTuru
    .replace(/\s+/g, '-')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');

  const izinTuruSlugOrig = izinTuru.replace(/\s+/g, '-');

  const fetchDosyalar = useCallback(async () => {
    if (!orgId || orgId === 'unknown' || !firmaId) { setDosyalar([]); setYukleniyor(false); return; }
    setYukleniyor(true);
    try {
      const slugsToTry = izinTuruSlug === izinTuruSlugOrig ? [izinTuruSlug] : [izinTuruSlug, izinTuruSlugOrig];
      let allFiles: EvrakDosya[] = [];
      for (const slug of slugsToTry) {
        const prefix = `${orgId}/is-izni-evrak/${firmaId}/${slug}`;
        const { data, error } = await supabase.storage
          .from('uploads')
          .list(prefix, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });
        if (!error && data && data.length > 0) {
          const filtered = data
            .filter(f => f.name.startsWith(izinId) && !f.name.includes('_red_'))
            .map(f => ({ ...f, _slug: slug } as EvrakDosya));
          allFiles = [...allFiles, ...filtered];
        }
      }
      const seen = new Set<string>();
      setDosyalar(allFiles.filter(f => { if (seen.has(f.name)) return false; seen.add(f.name); return true; }));
    } catch {
      setDosyalar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [orgId, firmaId, izinTuruSlug, izinTuruSlugOrig, izinId]);

  useEffect(() => { void fetchDosyalar(); }, [fetchDosyalar]);

  const handleAc = async (dosya: EvrakDosya, usedSlug: string) => {
    setAcikDosya(dosya.name);
    const filePath = `${orgId}/is-izni-evrak/${firmaId}/${usedSlug}/${dosya.name}`;
    console.log('[ISG] Opening file:', filePath);
    const url = await getSignedUrl(filePath);
    console.log('[ISG] Signed URL:', url ? 'OK' : 'NULL', filePath);
    if (url) {
      window.open(url, '_blank');
    } else {
      // Fallback: tüm olası slug'larla dene
      const slugs = [usedSlug, izinTuruSlug, izinTuruSlugOrig].filter((s, i, arr) => arr.indexOf(s) === i);
      for (const slug of slugs) {
        const fp = `${orgId}/is-izni-evrak/${firmaId}/${slug}/${dosya.name}`;
        const u = await getSignedUrl(fp);
        if (u) { window.open(u, '_blank'); break; }
      }
    }
    setAcikDosya(null);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return { icon: 'ri-file-pdf-line', color: '#EF4444' };
    if (['doc', 'docx'].includes(ext)) return { icon: 'ri-file-word-line', color: '#60A5FA' };
    if (['xls', 'xlsx'].includes(ext)) return { icon: 'ri-file-excel-line', color: '#34D399' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { icon: 'ri-image-line', color: '#FBBF24' };
    return { icon: 'ri-file-line', color: '#94A3B8' };
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (yukleniyor) {
    return (
      <div className="flex items-center gap-2 py-3 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <i className="ri-loader-4-line animate-spin text-sm" style={{ color: '#475569' }} />
        <span className="text-xs" style={{ color: '#475569' }}>Evraklar yükleniyor...</span>
      </div>
    );
  }

  if (dosyalar.length === 0) {
    return (
      <div className="flex items-center gap-3 py-3 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <i className="ri-folder-open-line text-sm" style={{ color: '#475569' }} />
        <p className="text-xs" style={{ color: '#475569' }}>Henüz evrak yüklenmedi</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {dosyalar.map(dosya => {
        const { icon, color } = getFileIcon(dosya.name);
        const isLoading = acikDosya === dosya.name;
        return (
          <div key={dosya.id || dosya.name}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${color}18` }}>
              <i className={`${icon} text-xs`} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{dosya.name}</p>
              {dosya.metadata?.size && (
                <span className="text-[10px]" style={{ color: '#475569' }}>{formatSize(dosya.metadata.size)}</span>
              )}
            </div>
            <button
              onClick={() => void handleAc(dosya, dosya._slug ?? izinTuruSlug)}
              disabled={isLoading}
              className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
              title="Görüntüle"
            >
              {isLoading
                ? <i className="ri-loader-4-line animate-spin text-xs" />
                : <i className="ri-eye-line text-xs" />
              }
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Değerlendirme Modal ──────────────────────────────────────────────────────
interface DegerlendirmeModalProps {
  izin: IsIzni;
  firmaAd: string;
  orgId: string;
  onClose: () => void;
  onUygun: () => Promise<void>;
  onUygunDegil: (not: string, foto?: File) => Promise<void>;
}

function DegerlendirmeModal({ izin, firmaAd, orgId, onClose, onUygun, onUygunDegil }: DegerlendirmeModalProps) {
  const [adim, setAdim] = useState<'detay' | 'red'>('detay');
  const [redNot, setRedNot] = useState('');
  const [redFoto, setRedFoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const expired = izin.bitisTarihi ? new Date(izin.bitisTarihi) < new Date() : false;

  const handleUygun = async () => {
    setSubmitting(true);
    await onUygun();
  };

  const handleUygunDegil = async () => {
    if (!redNot.trim()) return;
    setSubmitting(true);
    await onUygunDegil(redNot.trim(), redFoto ?? undefined);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={adim === 'detay' ? `İş İzni — ${izin.izinNo}` : 'Uygun Değil — Açıklama'}
      size="md"
      icon={adim === 'detay' ? 'ri-shield-keyhole-line' : 'ri-close-circle-line'}
      footer={
        adim === 'detay' ? (
          <>
            <button onClick={onClose} className="btn-secondary whitespace-nowrap">Kapat</button>
            {izin.durum === 'Onay Bekliyor' && (
              <>
                <button
                  onClick={() => setAdim('red')}
                  disabled={submitting}
                  className="whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold cursor-pointer"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <i className="ri-close-circle-line mr-1.5" />UYGUN DEĞİL
                </button>
                <button
                  onClick={handleUygun}
                  disabled={submitting}
                  className="whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold cursor-pointer"
                  style={{ background: 'rgba(52,211,153,0.2)', color: '#34D399', border: '1px solid rgba(52,211,153,0.35)' }}
                >
                  <i className="ri-checkbox-circle-line mr-1.5" />UYGUN
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setAdim('detay')} className="btn-secondary whitespace-nowrap">Geri</button>
            <button
              onClick={() => void handleUygunDegil()}
              disabled={submitting || !redNot.trim()}
              className="whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold cursor-pointer"
              style={{
                background: redNot.trim() ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.05)',
                color: redNot.trim() ? '#EF4444' : '#64748B',
                border: `1px solid ${redNot.trim() ? 'rgba(239,68,68,0.35)' : 'rgba(100,116,139,0.2)'}`,
                cursor: redNot.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting
                ? <><i className="ri-loader-4-line animate-spin mr-1" />Gönderiliyor...</>
                : <><i className="ri-send-plane-line mr-1.5" />Reddet ve Gönder</>
              }
            </button>
          </>
        )
      }
    >
      {adim === 'detay' ? (
        <div className="space-y-4">
          {/* Durum */}
          {izin.durum !== 'Onay Bekliyor' && (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DURUM_CFG[izin.durum].border}` }}>
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: DURUM_CFG[izin.durum].bg }}>
                <i className={`${DURUM_CFG[izin.durum].icon} flex-shrink-0 text-base`} style={{ color: DURUM_CFG[izin.durum].color }} />
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: DURUM_CFG[izin.durum].color }}>{izin.durum}</p>
                  {izin.durum === 'Onaylandı' && izin.onaylayanKisi && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] flex items-center gap-1" style={{ color: '#64748B' }}>
                        <i className="ri-user-line text-[10px]" />{izin.onaylayanKisi}
                      </span>
                      {izin.onayTarihi && (
                        <span className="text-[11px] flex items-center gap-1" style={{ color: '#64748B' }}>
                          <i className="ri-calendar-check-line text-[10px]" />{new Date(izin.onayTarihi).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                    </div>
                  )}
                  {izin.durum === 'Reddedildi' && (
                    <div className="mt-1 space-y-0.5">
                      {izin.reddedenKisi && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] flex items-center gap-1" style={{ color: '#64748B' }}>
                            <i className="ri-user-line text-[10px]" />{izin.reddedenKisi}
                          </span>
                          {izin.reddetmeTarihi && (
                            <span className="text-[11px] flex items-center gap-1" style={{ color: '#64748B' }}>
                              <i className="ri-calendar-close-line text-[10px]" />{new Date(izin.reddetmeTarihi).toLocaleDateString('tr-TR')}
                            </span>
                          )}
                        </div>
                      )}
                      {izin.sahaNotu && (
                        <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                          <i className="ri-chat-1-line mr-1 text-[10px]" />{izin.sahaNotu}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Red fotoğrafı */}
              {izin.durum === 'Reddedildi' && izin.redFotoUrl && (
                <div className="px-4 py-3" style={{ borderTop: `1px solid ${DURUM_CFG[izin.durum].border}`, background: 'rgba(239,68,68,0.04)' }}>
                  <p className="text-[10px] font-semibold mb-2" style={{ color: '#EF4444' }}>
                    <i className="ri-camera-line mr-1" />Red Fotoğrafı
                  </p>
                  <RedFotoImg
                    src={izin.redFotoUrl!}
                    className="rounded-lg max-h-40 object-cover cursor-pointer w-full"
                    style={{ border: '1px solid rgba(239,68,68,0.2)' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Süresi geçmiş */}
          {expired && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-alarm-warning-line flex-shrink-0" style={{ color: '#EF4444' }} />
              <p className="text-xs font-semibold" style={{ color: '#EF4444' }}>Bu iş izninin süresi geçmiş!</p>
            </div>
          )}

          {/* Bilgi grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Firma',     value: firmaAd },
              { label: 'İzin Tipi', value: izin.tip },
              { label: 'Başlangıç', value: izin.baslamaTarihi ? new Date(izin.baslamaTarihi).toLocaleDateString('tr-TR') : '—' },
              { label: 'Bitiş',     value: izin.bitisTarihi ? new Date(izin.bitisTarihi).toLocaleDateString('tr-TR') : '—' },
            ].map(item => (
              <div key={item.label} className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#475569' }}>{item.label}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Açıklama */}
          {izin.aciklama && (
            <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] font-semibold mb-1" style={{ color: '#475569' }}>Açıklama</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{izin.aciklama}</p>
            </div>
          )}

          {/* Evraklar */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
              <i className="ri-attachment-2 text-sm" style={{ color: '#818CF8' }} />
              <p className="text-xs font-bold" style={{ color: '#818CF8' }}>Yüklü Evraklar</p>
              <span className="text-[10px] ml-1" style={{ color: '#475569' }}>— Sadece görüntüleme</span>
            </div>
            <div className="p-3">
              <IsIzniEvraklariSaha
                izinId={izin.id}
                orgId={orgId ?? ''}
                firmaId={izin.firmaId}
                izinTuru={izin.tip}
              />
            </div>
          </div>

          {/* Onay bekliyor bilgi */}
          {izin.durum === 'Onay Bekliyor' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <i className="ri-information-line flex-shrink-0" style={{ color: '#F59E0B' }} />
              <p className="text-xs" style={{ color: '#F59E0B' }}>Evrakları inceledikten sonra değerlendirmenizi yapın.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line flex-shrink-0" style={{ color: '#EF4444' }} />
            <p className="text-xs" style={{ color: '#EF4444' }}>Reddetme sebebini açıklayın. Bu not admin ve evrakçıya bildirim olarak gidecek.</p>
          </div>

          <div>
            <label className="form-label">Reddetme Sebebi <span style={{ color: '#EF4444' }}>*</span></label>
            <textarea
              value={redNot}
              onChange={e => setRedNot(e.target.value)}
              placeholder="Neden uygun değil? Eksik evrak, güvenlik riski, eksik bilgi vb..."
              rows={4}
              maxLength={500}
              className="isg-input w-full resize-none"
            />
            <p className="text-[10px] mt-1 text-right" style={{ color: '#475569' }}>{redNot.length}/500</p>
          </div>

          <div>
            <label className="form-label">Fotoğraf Ekle <span className="text-[10px]" style={{ color: '#475569' }}>(opsiyonel)</span></label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setRedFoto(e.target.files?.[0] ?? null)}
            />
            {redFoto ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <i className="ri-image-line text-sm" style={{ color: '#FBBF24' }} />
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{redFoto.name}</span>
                <button onClick={() => setRedFoto(null)} className="w-6 h-6 flex items-center justify-center rounded cursor-pointer" style={{ color: '#EF4444' }}>
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer text-sm"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', color: '#475569' }}
              >
                <i className="ri-camera-line" />Fotoğraf Seç
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function IsIzniSahaBolumu() {
  const { isIzinleri, firmalar, updateIsIzni, addToast, currentUser, org, isIzniBildirimi } = useApp();
  const [seciliIzinId, setSeciliIzinId] = useState<string | null>(null);
  const [tab, setTab] = useState<'bekleyen' | 'tamamlanan'>('bekleyen');

  const aktifIzinler = isIzinleri.filter(i => !i.silinmis);
  const bekleyenler = aktifIzinler
    .filter(i => i.durum === 'Onay Bekliyor')
    .sort((a, b) => (b.olusturmaTarihi ?? '').localeCompare(a.olusturmaTarihi ?? ''));
  const tamamlananlar = aktifIzinler
    .filter(i => i.durum !== 'Onay Bekliyor')
    .sort((a, b) => (b.guncellemeTarihi ?? b.olusturmaTarihi ?? '').localeCompare(a.guncellemeTarihi ?? a.olusturmaTarihi ?? ''));

  const liste = tab === 'bekleyen' ? bekleyenler : tamamlananlar;

  // Store'dan canlı oku — admin güncellediğinde modal otomatik yenilenir
  const seciliIzin = seciliIzinId
    ? (isIzinleri.find(i => i.id === seciliIzinId) ?? null)
    : null;

  // Eğer seçili izin artık "Onay Bekliyor" değilse ve admin tarafından tekrar gönderildiyse
  // modal açıksa otomatik güncellenir (reactive)
  useEffect(() => {
    if (!seciliIzinId) return;
    const izin = isIzinleri.find(i => i.id === seciliIzinId);
    // İzin silinmişse modalı kapat
    if (!izin || izin.silinmis) {
      setSeciliIzinId(null);
    }
  }, [isIzinleri, seciliIzinId]);

  const isExpired = (bitisTarihi: string) => {
    if (!bitisTarihi) return false;
    const end = new Date(bitisTarihi);
    end.setHours(23, 59, 59, 999);
    return end < new Date();
  };

  const handleUygun = async (izin: IsIzni) => {
    try {
      await updateIsIzni(izin.id, {
        durum: 'Onaylandı',
        sahaNotu: 'Sahada uygundur',
        onaylayanKisi: currentUser.ad,
        onayTarihi: new Date().toISOString().split('T')[0],
      } as Partial<IsIzni>);
      isIzniBildirimi(izin.izinNo, izin.id, 'onaylandi', 'Sahada uygundur');
      addToast(`${izin.izinNo} onaylandı.`, 'success');
      setSeciliIzinId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Onay kaydedilemedi: ${msg}`, 'error');
    }
  };

  const normalizeSlug = (str: string) => str
    .replace(/\s+/g, '-')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');

  const sanitizeFileName = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() ?? 'bin';
    const base = name.slice(0, name.lastIndexOf('.'));
    const safe = base
      .replace(/ş/g, 's').replace(/Ş/g, 'S')
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O')
      .replace(/ı/g, 'i').replace(/İ/g, 'I')
      .replace(/ç/g, 'c').replace(/Ç/g, 'C')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return `${safe || 'file'}.${ext}`;
  };

  const handleUygunDegil = async (izin: IsIzni, not: string, foto?: File): Promise<void> => {
    const orgId = org?.id ?? 'unknown';
    let redFotoUrl: string | undefined;
    if (foto && orgId !== 'unknown') {
      const izinTuruSlug = normalizeSlug(izin.tip);
      const safeFileName = sanitizeFileName(foto.name);
      const path = `${orgId}/is-izni-evrak/${izin.firmaId}/${izinTuruSlug}/${izin.id}_red_${Date.now()}_${safeFileName}`;
      const ext = safeFileName.split('.').pop()?.toLowerCase() ?? '';
      const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
      const redMime = foto.type || mimeMap[ext] || 'image/jpeg';
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('uploads').upload(path, foto, { upsert: true, contentType: redMime });
      if (uploadErr) console.error('[ISG] Red foto upload error:', uploadErr.message, uploadErr.statusCode, JSON.stringify(uploadErr));
      if (uploadData?.path) {
        // Path olarak kaydet — gösterirken signed URL üretilir, expire olmaz
        redFotoUrl = uploadData.path;
      }
    }
    try {
      await updateIsIzni(izin.id, {
        durum: 'Reddedildi',
        sahaNotu: not,
        reddedenKisi: currentUser.ad,
        reddetmeTarihi: new Date().toISOString().split('T')[0],
        ...(redFotoUrl ? { redFotoUrl } : {}),
      } as Partial<IsIzni>);
      isIzniBildirimi(izin.izinNo, izin.id, 'reddedildi', not);
      addToast(`${izin.izinNo} reddedildi.`, 'error');
      setSeciliIzinId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Red kaydedilemedi: ${msg}`, 'error');
    }
  };

  const TIP_ICON: Record<string, string> = {
    'Sıcak Çalışma': 'ri-fire-line',
    'Yüksekte Çalışma': 'ri-arrow-up-line',
    'Kapalı Alan': 'ri-door-closed-line',
    'Elektrikli Çalışma': 'ri-flashlight-line',
    'Kazı': 'ri-tools-line',
    'Genel': 'ri-file-shield-2-line',
  };

  return (
    <>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>İŞ İZİNLERİ</p>
        <div className="flex items-center gap-1 px-1 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setTab('bekleyen')}
            className="px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap"
            style={{
              background: tab === 'bekleyen' ? 'rgba(245,158,11,0.2)' : 'transparent',
              color: tab === 'bekleyen' ? '#F59E0B' : '#64748B',
            }}
          >
            Bekleyen ({bekleyenler.length})
          </button>
          <button
            onClick={() => setTab('tamamlanan')}
            className="px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 whitespace-nowrap"
            style={{
              background: tab === 'tamamlanan' ? 'rgba(52,211,153,0.2)' : 'transparent',
              color: tab === 'tamamlanan' ? '#34D399' : '#64748B',
            }}
          >
            Tamamlanan ({tamamlananlar.length})
          </button>
        </div>
      </div>

      {/* Bekleyen uyarı */}
      {bekleyenler.length > 0 && tab === 'bekleyen' && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <i className="ri-time-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
          <p className="text-xs font-semibold" style={{ color: '#FCD34D' }}>
            {bekleyenler.length} iş izni değerlendirmenizi bekliyor
          </p>
        </div>
      )}

      {/* Liste */}
      {liste.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <i className={`${tab === 'bekleyen' ? 'ri-time-line' : 'ri-checkbox-circle-line'} text-3xl`} style={{ color: '#334155' }} />
          <p className="text-xs mt-2 font-medium" style={{ color: '#475569' }}>
            {tab === 'bekleyen' ? 'Bekleyen iş izni yok' : 'Tamamlanan iş izni yok'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {liste.map(izin => {
            const firma = firmalar.find(f => f.id === izin.firmaId);
            const dur = DURUM_CFG[izin.durum] ?? DURUM_CFG['Onay Bekliyor'];
            const expired = isExpired(izin.bitisTarihi);
            const tipIcon = TIP_ICON[izin.tip] ?? 'ri-file-shield-2-line';

            return (
              <button
                key={izin.id}
                onClick={() => setSeciliIzinId(izin.id)}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150 text-left"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${izin.durum === 'Onay Bekliyor' ? 'rgba(245,158,11,0.2)' : izin.durum === 'Reddedildi' ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)'}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              >
                {/* İkon */}
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: dur.bg }}>
                  <i className={`${tipIcon} text-sm`} style={{ color: dur.color }} />
                </div>

                {/* İçerik */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-xs font-mono font-bold" style={{ color: '#818CF8' }}>{izin.izinNo}</span>
                    {expired && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                        Süresi Geçmiş
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {firma?.ad || '—'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px]" style={{ color: '#475569' }}>{izin.tip}</span>
                    {izin.baslamaTarihi && (
                      <span className="text-[10px]" style={{ color: '#334155' }}>
                        <i className="ri-calendar-line mr-0.5" />
                        {new Date(izin.baslamaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                        {izin.bitisTarihi && ` → ${new Date(izin.bitisTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}`}
                      </span>
                    )}
                  </div>
                  {izin.durum === 'Reddedildi' && izin.sahaNotu && (
                    <p className="text-[10px] mt-1 truncate" style={{ color: '#EF4444' }}>
                      <i className="ri-close-circle-line mr-0.5" />{izin.sahaNotu}
                    </p>
                  )}
                  {izin.durum === 'Onaylandı' && izin.onaylayanKisi && (
                    <p className="text-[10px] mt-1" style={{ color: '#34D399' }}>
                      <i className="ri-checkbox-circle-line mr-0.5" />{izin.onaylayanKisi}
                    </p>
                  )}
                </div>

                {/* Sağ */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ background: dur.bg, color: dur.color, border: `1px solid ${dur.border}` }}>
                    <i className={`${dur.icon} mr-0.5`} />{izin.durum}
                  </span>
                  {izin.durum === 'Onay Bekliyor' && (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                      Değerlendir →
                    </span>
                  )}
                  <i className="ri-arrow-right-s-line text-xs" style={{ color: '#475569' }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Değerlendirme Modal — seciliIzin store'dan canlı okunuyor */}
      {seciliIzin && (
        <DegerlendirmeModal
          izin={seciliIzin}
          firmaAd={firmalar.find(f => f.id === seciliIzin.firmaId)?.ad || '—'}
          orgId={org?.id ?? 'unknown'}
          onClose={() => setSeciliIzinId(null)}
          onUygun={() => handleUygun(seciliIzin)}
          onUygunDegil={(not, foto) => handleUygunDegil(seciliIzin, not, foto)}
        />
      )}
    </>
  );
}
