import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AltFirma {
  id: string;
  name: string;
  personelSayisi: number;
  uzmanAd: string | null;
  uygunsuzluk: number;
  invite_code: string;
  created_at: string;
}

interface Uzman {
  user_id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  active_firm_id: string | null;
  active_firm_ids: string[] | null;
  active_firm_name: string | null;
}

interface Ziyaret {
  id: string;
  uzman_user_id: string;
  firma_org_id: string;
  firma_ad: string | null;
  uzman_ad: string | null;
  giris_saati: string;
  cikis_saati: string | null;
}

interface MobileDashboardTabProps {
  altFirmalar: AltFirma[];
  uzmanlar: Uzman[];
  orgId: string;
  onFirmaEkle: () => void;
  onUzmanEkle: () => void;
  onFirmaClick: (f: { id: string; name: string }) => void;
  onUzmanClick: (u: Uzman) => void;
  setActiveTab: (tab: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'Az önce';
  if (m < 60) return `${m}dk önce`;
  if (h < 24) return `${h}sa önce`;
  return `${d}g önce`;
}

function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(since).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 's ' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [since]);
  return <span className="font-mono font-black text-sm" style={{ color: '#22C55E' }}>{elapsed}</span>;
}

const GRADIENT_COLORS = [
  { from: '#FF6B35', to: '#FF8C42' },
  { from: '#7C3AED', to: '#9F67FF' },
  { from: '#0EA5E9', to: '#38BDF8' },
  { from: '#10B981', to: '#34D399' },
  { from: '#F59E0B', to: '#FCD34D' },
  { from: '#EF4444', to: '#F87171' },
];

export default function MobileDashboardTab({
  altFirmalar, uzmanlar, orgId, onFirmaEkle, onUzmanEkle,
  onFirmaClick, onUzmanClick, setActiveTab,
}: MobileDashboardTabProps) {
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);

  useEffect(() => {
    if (!orgId) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    supabase
      .from('osgb_ziyaretler')
      .select('id,uzman_user_id,firma_org_id,firma_ad,uzman_ad,giris_saati,cikis_saati')
      .eq('osgb_org_id', orgId)
      .gte('giris_saati', thirtyDaysAgo.toISOString())
      .order('giris_saati', { ascending: false })
      .limit(50)
      .then(({ data }) => setZiyaretler((data ?? []) as Ziyaret[]));
  }, [orgId]);

  const aktifZiyaretler = ziyaretler.filter(z => !z.cikis_saati);
  const todayStr = new Date().toDateString();
  const bugunZiyaretler = ziyaretler.filter(z => new Date(z.giris_saati).toDateString() === todayStr);
  const sonZiyaret = ziyaretler[0] ?? null;

  const getUzmanAd = (uid: string) => {
    const u = uzmanlar.find(x => x.user_id === uid);
    return u?.display_name ?? u?.email ?? 'Bilinmeyen';
  };

  return (
    <div className="space-y-5">

      {/* ── STAT KARTLARI — referans görseldeki renkli bloklar ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[22px] font-black" style={{ color: 'var(--text-primary)' }}>
            Özet
          </h2>
          <button
            onClick={() => setActiveTab('ziyaretler')}
            className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer"
            style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}
          >
            Tümünü gör
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Aktif Ziyaret */}
          <div
            className="rounded-2xl p-4 cursor-pointer active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              boxShadow: '0 8px 24px rgba(34,197,94,0.3)',
            }}
            onClick={() => setActiveTab('ziyaretler')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <i className="ri-map-pin-user-fill text-white text-base" />
              </div>
              {aktifZiyaretler.length > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-black text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  CANLI
                </span>
              )}
            </div>
            <p className="text-[36px] font-black text-white leading-none">{aktifZiyaretler.length}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Aktif Ziyaret
            </p>
          </div>

          {/* Bugün */}
          <div
            className="rounded-2xl p-4 cursor-pointer active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)',
              boxShadow: '0 8px 24px rgba(255,107,53,0.3)',
            }}
            onClick={() => setActiveTab('ziyaretler')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <i className="ri-calendar-check-fill text-white text-base" />
              </div>
            </div>
            <p className="text-[36px] font-black text-white leading-none">{bugunZiyaretler.length}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Bugün
            </p>
          </div>

          {/* Firmalar */}
          <div
            className="rounded-2xl p-4 cursor-pointer active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
              boxShadow: '0 8px 24px rgba(14,165,233,0.3)',
            }}
            onClick={() => setActiveTab('firmalar')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <i className="ri-building-2-fill text-white text-base" />
              </div>
            </div>
            <p className="text-[36px] font-black text-white leading-none">{altFirmalar.length}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Müşteri Firma
            </p>
          </div>

          {/* Personel */}
          <div
            className="rounded-2xl p-4 cursor-pointer active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #9F67FF 100%)',
              boxShadow: '0 8px 24px rgba(124,58,237,0.3)',
            }}
            onClick={() => setActiveTab('uzmanlar')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <i className="ri-shield-user-fill text-white text-base" />
              </div>
            </div>
            <p className="text-[36px] font-black text-white leading-none">{uzmanlar.length}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Personel
            </p>
          </div>
        </div>
      </div>

      {/* ── AKTİF ZİYARETLER ── */}
      {aktifZiyaretler.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[18px] font-black" style={{ color: 'var(--text-primary)' }}>
              Şu An Sahada
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: '#22C55E' }}>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {aktifZiyaretler.length} aktif
            </span>
          </div>

          <div className="space-y-2.5">
            {aktifZiyaretler.slice(0, 3).map(z => (
              <div
                key={z.id}
                className="rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
                style={{
                  background: 'var(--bg-card-solid)',
                  border: '1.5px solid rgba(34,197,94,0.25)',
                }}
                onClick={() => setActiveTab('ziyaretler')}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                  >
                    {(z.uzman_ad ?? getUzmanAd(z.uzman_user_id)).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {z.uzman_ad ?? getUzmanAd(z.uzman_user_id)}
                    </p>
                    <p className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {z.firma_ad ?? '—'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <ElapsedTimer since={z.giris_saati} />
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>geçen süre</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SON ZİYARETLER ── */}
      {ziyaretler.filter(z => z.cikis_saati).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[18px] font-black" style={{ color: 'var(--text-primary)' }}>
              Son Ziyaretler
            </h2>
            <button
              onClick={() => setActiveTab('ziyaretler')}
              className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer"
              style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}
            >
              Tümü
            </button>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            {ziyaretler.filter(z => z.cikis_saati).slice(0, 5).map((z, i, arr) => (
              <div
                key={z.id}
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                style={{
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onClick={() => setActiveTab('ziyaretler')}
              >
                {/* Colored avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length].from}, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length].to})`,
                  }}
                >
                  {(z.uzman_ad ?? getUzmanAd(z.uzman_user_id)).charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {z.uzman_ad ?? getUzmanAd(z.uzman_user_id)}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {z.firma_ad ?? '—'}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(z.giris_saati)}
                  </p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8' }}
                  >
                    Bitti
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FIRMALAR ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[18px] font-black" style={{ color: 'var(--text-primary)' }}>
            Firmalar
          </h2>
          <button
            onClick={() => setActiveTab('firmalar')}
            className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer"
            style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}
          >
            Tümü
          </button>
        </div>

        {altFirmalar.length === 0 ? (
          <div
            className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.1)' }}>
              <i className="ri-building-2-line text-xl" style={{ color: '#0EA5E9' }} />
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Henüz firma yok</p>
            <button
              onClick={onFirmaEkle}
              className="px-4 py-2 rounded-full text-sm font-bold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
            >
              + Firma Ekle
            </button>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            {altFirmalar.slice(0, 5).map((f, i, arr) => (
              <div
                key={f.id}
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                onClick={() => onFirmaClick({ id: f.id, name: f.name })}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length].from}, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length].to})`,
                  }}
                >
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {f.name}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {f.personelSayisi} personel
                    {f.uzmanAd ? ` · ${f.uzmanAd}` : ''}
                  </p>
                </div>
                {f.uygunsuzluk > 0 && (
                  <span
                    className="text-[11px] font-black px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                  >
                    {f.uygunsuzluk}
                  </span>
                )}
                <i className="ri-arrow-right-s-line text-base flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PERSONEL ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[18px] font-black" style={{ color: 'var(--text-primary)' }}>
            Personel
          </h2>
          <button
            onClick={() => setActiveTab('uzmanlar')}
            className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer"
            style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}
          >
            Tümü
          </button>
        </div>

        {uzmanlar.length === 0 ? (
          <div
            className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)' }}>
              <i className="ri-shield-user-line text-xl" style={{ color: '#7C3AED' }} />
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Henüz personel yok</p>
            <button
              onClick={onUzmanEkle}
              className="px-4 py-2 rounded-full text-sm font-bold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9F67FF)' }}
            >
              + Personel Ekle
            </button>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            {uzmanlar.slice(0, 5).map((u, i, arr) => {
              const isSahada = aktifZiyaretler.some(z => z.uzman_user_id === u.user_id);
              return (
                <div
                  key={u.user_id}
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                  onClick={() => onUzmanClick(u)}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white"
                      style={{
                        background: isSahada
                          ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                          : `linear-gradient(135deg, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length].from}, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length].to})`,
                      }}
                    >
                      {(u.display_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                    </div>
                    {isSahada && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 animate-pulse"
                        style={{ background: '#22C55E', borderColor: 'var(--bg-card-solid)' }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {u.display_name ?? u.email}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {u.active_firm_name ?? 'Firma atanmamış'}
                    </p>
                  </div>
                  {isSahada ? (
                    <span
                      className="text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}
                    >
                      Sahada
                    </span>
                  ) : (
                    <i className="ri-arrow-right-s-line text-base flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── HIZLI EYLEMLER ── */}
      <div>
        <h2 className="text-[18px] font-black mb-3" style={{ color: 'var(--text-primary)' }}>
          Hızlı Eylemler
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onFirmaEkle}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer active:scale-95 transition-transform"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.1)' }}>
              <i className="ri-building-2-line text-xl" style={{ color: '#0EA5E9' }} />
            </div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Firma Ekle</p>
          </button>
          <button
            onClick={onUzmanEkle}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer active:scale-95 transition-transform"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)' }}>
              <i className="ri-user-add-line text-xl" style={{ color: '#7C3AED' }} />
            </div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Personel Ekle</p>
          </button>
          <button
            onClick={() => setActiveTab('raporlar')}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer active:scale-95 transition-transform"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <i className="ri-bar-chart-2-line text-xl" style={{ color: '#F59E0B' }} />
            </div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Raporlar</p>
          </button>
          <button
            onClick={() => setActiveTab('ziyaretler')}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer active:scale-95 transition-transform"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <i className="ri-map-pin-2-line text-xl" style={{ color: '#22C55E' }} />
            </div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Ziyaretler</p>
          </button>
        </div>
      </div>

      {/* Son ziyaret bilgisi */}
      {sonZiyaret && (
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
            Son Aktivite
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #64748B, #475569)' }}
            >
              {(sonZiyaret.uzman_ad ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {sonZiyaret.uzman_ad ?? '—'}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {sonZiyaret.firma_ad ?? '—'} · {timeAgo(sonZiyaret.giris_saati)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
