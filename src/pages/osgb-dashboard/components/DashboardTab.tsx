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
  uzman_id: string;
  firma_id: string;
  giris_saati: string;
  cikis_saati: string | null;
  ziyaret_tipi?: string;
}

interface DashboardTabProps {
  altFirmalar: AltFirma[];
  uzmanlar: Uzman[];
  isDark: boolean;
  orgId: string;
  onFirmaEkle: () => void;
  onUzmanEkle: () => void;
  onAtamaYap: () => void;
  onFirmaClick: (firma: { id: string; name: string }) => void;
  onUzmanClick: (uzman: Uzman) => void;
  setActiveTab: (tab: string) => void;
}

// ── Helpers ──
function getDaysDiff(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dakika önce`;
  if (hours < 24) return `${hours} saat önce`;
  return `${days} gün önce`;
}

function formatDuration(giris: string, cikis: string | null): string {
  if (!cikis) {
    const mins = Math.floor((new Date().getTime() - new Date(giris).getTime()) / 60000);
    if (mins < 1) return 'Yeni başladı';
    if (mins < 60) return `${mins}dk devam ediyor`;
    return `${Math.floor(mins / 60)}sa ${mins % 60}dk devam ediyor`;
  }
  const mins = Math.floor((new Date(cikis).getTime() - new Date(giris).getTime()) / 60000);
  if (mins < 60) return `${mins} dk`;
  return `${Math.floor(mins / 60)}sa ${mins % 60}dk`;
}

function VisitStatusBadge({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.15)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#94A3B8' }} />
        Ziyaret yok
      </span>
    );
  }
  if (days === 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
      Bugün
    </span>
  );
  if (days <= 2) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
      {days}g önce
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
      {days}g önce
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444' }} />
      {days}g önce
    </span>
  );
}

export default function DashboardTab({
  altFirmalar, uzmanlar, isDark, orgId, onFirmaEkle, onUzmanEkle,
  onFirmaClick, onUzmanClick, setActiveTab,
}: DashboardTabProps) {
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [loading, setLoading] = useState(true);

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const card: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
    borderRadius: '20px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  };

  // ── Ziyaretleri çek ──
  useEffect(() => {
    if (!orgId) return;
    const fetchZiyaretler = async () => {
      setLoading(true);
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data } = await supabase
          .from('osgb_ziyaretler')
          .select('id, uzman_id, firma_id, giris_saati, cikis_saati, ziyaret_tipi')
          .eq('organization_id', orgId)
          .gte('giris_saati', thirtyDaysAgo.toISOString())
          .order('giris_saati', { ascending: false });
        setZiyaretler(data ?? []);
      } catch (err) {
        console.error('[DashboardTab] ziyaret fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchZiyaretler();
  }, [orgId]);

  const todayStr = new Date().toDateString();
  const aktifZiyaretler = ziyaretler.filter(z => !z.cikis_saati);
  const bugunZiyaretler = ziyaretler.filter(z => new Date(z.giris_saati).toDateString() === todayStr);
  const sonZiyaret = ziyaretler[0] ?? null;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const buHaftaZiyaretler = ziyaretler.filter(z => new Date(z.giris_saati) >= weekAgo);

  const firmaLastVisit: Record<string, string> = {};
  ziyaretler.forEach(z => {
    if (!firmaLastVisit[z.firma_id] || z.giris_saati > firmaLastVisit[z.firma_id]) {
      firmaLastVisit[z.firma_id] = z.giris_saati;
    }
  });

  const uzmanLastVisit: Record<string, string> = {};
  ziyaretler.forEach(z => {
    if (!uzmanLastVisit[z.uzman_id] || z.giris_saati > uzmanLastVisit[z.uzman_id]) {
      uzmanLastVisit[z.uzman_id] = z.giris_saati;
    }
  });

  const aktifUzmanIds = new Set(aktifZiyaretler.map(z => z.uzman_id));

  const gec3Firma = altFirmalar.filter(f => {
    const days = getDaysDiff(firmaLastVisit[f.id]);
    return days === null || days >= 3;
  });

  const pasifUzmanlar = uzmanlar.filter(u => {
    const days = getDaysDiff(uzmanLastVisit[u.user_id]);
    return days === null || days >= 3;
  });

  const son5 = ziyaretler.slice(0, 5);

  const getUzmanAd = (uid: string) => {
    const u = uzmanlar.find(x => x.user_id === uid);
    return u?.display_name ?? u?.email ?? 'Bilinmeyen';
  };

  const getFirmaAd = (fid: string) => {
    const f = altFirmalar.find(x => x.id === fid);
    return f?.name ?? 'Bilinmeyen Firma';
  };

  return (
    <div className="space-y-5 page-enter">

      {/* ── KPI KARTLARI (PREMIUM) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Müşteri Firma */}
        <div className="rounded-2xl p-5 cursor-pointer group"
          style={card}
          onClick={() => setActiveTab('firmalar')}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLElement).style.boxShadow = isDark
              ? '0 12px 32px rgba(0,0,0,0.35)' : '0 12px 28px rgba(15,23,42,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))' }}>
                <i className="ri-building-2-fill text-sm" style={{ color: '#10B981' }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                Müşteri Firma
              </span>
            </div>
          </div>
          <p className="text-[32px] font-black leading-none mb-2" style={{ color: textPrimary }}>
            {altFirmalar.length}
          </p>
          <p className="text-[11px] font-medium" style={{ color: textSecondary }}>
            {altFirmalar.length === 0 ? 'Henüz firma yok' : `${altFirmalar.filter(f => f.uzmanAd).length} firmaya uzman atanmış`}
          </p>
        </div>

        {/* Aktif Ziyaret */}
        <div className="rounded-2xl p-5 cursor-pointer group relative overflow-hidden"
          style={{
            ...card,
            border: aktifZiyaretler.length > 0
              ? `1px solid rgba(34,197,94,0.3)`
              : card.border,
            boxShadow: aktifZiyaretler.length > 0
              ? `0 0 0 1px rgba(34,197,94,0.1), inset 0 0 32px rgba(34,197,94,0.04)`
              : 'none',
          }}
          onClick={() => setActiveTab('ziyaretler')}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLElement).style.boxShadow = aktifZiyaretler.length > 0
              ? '0 12px 32px rgba(34,197,94,0.2)' : (isDark ? '0 12px 32px rgba(0,0,0,0.35)' : '0 12px 28px rgba(15,23,42,0.1)');
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.boxShadow = aktifZiyaretler.length > 0
              ? '0 0 0 1px rgba(34,197,94,0.1), inset 0 0 32px rgba(34,197,94,0.04)' : 'none';
          }}>
          {/* Glow bg */}
          {aktifZiyaretler.length > 0 && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(34,197,94,0.08) 0%, transparent 65%)' }} />
          )}
          <div className="relative flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))' }}>
                <i className="ri-map-pin-user-fill text-sm" style={{ color: '#22C55E' }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                Aktif Ziyaret
              </span>
            </div>
            {aktifZiyaretler.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                <span className="text-[10px] font-bold" style={{ color: '#22C55E' }}>CANLI</span>
              </div>
            )}
          </div>
          <p className="relative text-[32px] font-black leading-none mb-2" style={{ color: aktifZiyaretler.length > 0 ? '#22C55E' : textPrimary }}>
            {aktifZiyaretler.length}
          </p>
          <p className="relative text-[11px] font-medium" style={{ color: aktifZiyaretler.length > 0 ? '#22C55E' : textSecondary }}>
            {aktifZiyaretler.length === 0 ? 'Sahada kimse yok' : `${aktifZiyaretler.length} uzman şu an sahada`}
          </p>
        </div>

        {/* Bugünkü Ziyaret */}
        <div className="rounded-2xl p-5 cursor-pointer group"
          style={card}
          onClick={() => setActiveTab('ziyaretler')}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLElement).style.boxShadow = isDark ? '0 12px 32px rgba(0,0,0,0.35)' : '0 12px 28px rgba(15,23,42,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.08))' }}>
                <i className="ri-calendar-check-fill text-sm" style={{ color: '#06B6D4' }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                Bugünkü Ziyaret
              </span>
            </div>
          </div>
          <p className="text-[32px] font-black leading-none mb-2" style={{ color: textPrimary }}>
            {bugunZiyaretler.length}
          </p>
          <p className="text-[11px] font-medium" style={{ color: textSecondary }}>
            Bu hafta {buHaftaZiyaretler.length} ziyaret
          </p>
        </div>

        {/* Son Aktivite */}
        <div className="rounded-2xl p-5 cursor-pointer group"
          style={card}
          onClick={() => setActiveTab('ziyaretler')}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLElement).style.boxShadow = isDark ? '0 12px 32px rgba(0,0,0,0.35)' : '0 12px 28px rgba(15,23,42,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))' }}>
                <i className="ri-pulse-fill text-sm" style={{ color: '#F59E0B' }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                Son Aktivite
              </span>
            </div>
          </div>
          <p className="text-base font-black leading-snug mb-1" style={{ color: '#F59E0B' }}>
            {sonZiyaret ? timeAgo(sonZiyaret.giris_saati) : '—'}
          </p>
          {sonZiyaret && (
            <p className="text-[11px] font-semibold truncate" style={{ color: textSecondary }}>
              {getFirmaAd(sonZiyaret.firma_id)}
            </p>
          )}
          {!sonZiyaret && (
            <p className="text-[11px] font-medium" style={{ color: textSecondary }}>Henüz ziyaret yok</p>
          )}
        </div>
      </div>

      {/* ── ANA GRID: Firmalar + Uzmanlar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Firmalar Kartı */}
        <div className="rounded-2xl" style={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.06))' }}>
                <i className="ri-building-2-fill text-sm" style={{ color: '#10B981' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Müşteri Firmalar</h3>
                <p className="text-[10px]" style={{ color: textSecondary }}>{altFirmalar.length} firma kayıtlı</p>
              </div>
            </div>
            <button onClick={() => setActiveTab('firmalar')}
              className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ color: '#10B981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.08)'; }}>
              Tümünü Gör <i className="ri-arrow-right-s-line" />
            </button>
          </div>

          {altFirmalar.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 px-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)' }}>
                <i className="ri-building-2-line text-xl" style={{ color: '#10B981' }} />
              </div>
              <p className="text-xs text-center" style={{ color: textSecondary }}>Henüz firma eklenmedi</p>
              <button onClick={onFirmaEkle}
                className="whitespace-nowrap flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                <i className="ri-add-line" />Firma Ekle
              </button>
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {altFirmalar.slice(0, 5).map(f => {
                const lastVisitDate = firmaLastVisit[f.id];
                const days = getDaysDiff(lastVisitDate);
                const isAktif = aktifZiyaretler.some(z => z.firma_id === f.id);
                const rowBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.02)';
                const rowHover = isDark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.04)';
                return (
                  <div key={f.id}
                    onClick={() => onFirmaClick({ id: f.id, name: f.name })}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                    style={{ background: rowBg, transition: 'all 0.18s ease' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = rowHover;
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = rowBg;
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                    }}>
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: isAktif ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))' : 'rgba(16,185,129,0.1)' }}>
                        <i className="ri-building-2-line text-sm" style={{ color: isAktif ? '#22C55E' : '#059669' }} />
                      </div>
                      {isAktif && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
                          style={{ background: '#22C55E', borderColor: isDark ? '#1e2d3d' : '#ffffff' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: textPrimary }}>{f.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                        {isAktif
                          ? <span style={{ color: '#22C55E', fontWeight: 600 }}>Aktif ziyaret devam ediyor</span>
                          : (f.uzmanAd ?? 'Uzman atanmadı')}
                        {' · '}{f.personelSayisi} personel
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <VisitStatusBadge days={days} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Uzmanlar Kartı */}
        <div className="rounded-2xl" style={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.06))' }}>
                <i className="ri-user-star-fill text-sm" style={{ color: '#8B5CF6' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Gezici Uzmanlar</h3>
                <p className="text-[10px]" style={{ color: textSecondary }}>
                  {aktifUzmanIds.size > 0 ? `${aktifUzmanIds.size} uzman şu an sahada` : `${uzmanlar.length} uzman kayıtlı`}
                </p>
              </div>
            </div>
            <button onClick={() => setActiveTab('uzmanlar')}
              className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ color: '#8B5CF6', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)'; }}>
              Tümünü Gör <i className="ri-arrow-right-s-line" />
            </button>
          </div>

          {uzmanlar.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 px-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <i className="ri-user-star-line text-xl" style={{ color: '#8B5CF6' }} />
              </div>
              <p className="text-xs text-center" style={{ color: textSecondary }}>Henüz uzman eklenmedi</p>
              <button onClick={onUzmanEkle}
                className="whitespace-nowrap flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
                <i className="ri-user-add-line" />Uzman Ekle
              </button>
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {uzmanlar.slice(0, 5).map(u => {
                const isSahada = aktifUzmanIds.has(u.user_id);
                const lastVisitDate = uzmanLastVisit[u.user_id];
                const days = getDaysDiff(lastVisitDate);
                const rowBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.02)';
                const rowHover = isDark ? 'rgba(139,92,246,0.07)' : 'rgba(139,92,246,0.04)';
                const initial = (u.display_name ?? u.email ?? '?').charAt(0).toUpperCase();
                return (
                  <div key={u.user_id}
                    onClick={() => onUzmanClick(u)}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                    style={{ background: rowBg, transition: 'all 0.18s ease' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = rowHover;
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = rowBg;
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                    }}>
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white"
                        style={{
                          background: isSahada
                            ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                            : u.is_active
                              ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)'
                              : 'linear-gradient(135deg, #64748b, #475569)',
                        }}>
                        {initial}
                      </div>
                      {isSahada && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
                          style={{ background: '#22C55E', borderColor: isDark ? '#1e2d3d' : '#ffffff' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold" style={{ color: textPrimary }}>{u.display_name ?? u.email}</p>
                      </div>
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: textSecondary }}>
                        {u.active_firm_name ?? 'Firma atanmadı'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {isSahada ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                          Sahada
                        </span>
                      ) : (
                        <VisitStatusBadge days={days} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── BUGÜN SAHA AKIŞI — Premium Timeline ── */}
      {son5.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.06))' }}>
                <i className="ri-route-fill text-sm" style={{ color: '#06B6D4' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Bugün Saha Nasıl?</h3>
                <p className="text-[10px]" style={{ color: textSecondary }}>En güncel {son5.length} ziyaret</p>
              </div>
            </div>
            <button onClick={() => setActiveTab('ziyaretler')}
              className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ color: '#06B6D4', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(6,182,212,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(6,182,212,0.08)'; }}>
              Tümünü Gör <i className="ri-arrow-right-s-line" />
            </button>
          </div>

          <div className="p-5">
            <div className="relative">
              {/* Dikey timeline çizgisi */}
              <div className="absolute left-[18px] top-5 bottom-5 w-px"
                style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)' }} />

              <div className="space-y-3">
                {son5.map((z, idx) => {
                  const isAktif = !z.cikis_saati;
                  const uzmanAd = getUzmanAd(z.uzman_id);
                  const firmaAd = getFirmaAd(z.firma_id);
                  const girisSaat = new Date(z.giris_saati).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                  const sure = formatDuration(z.giris_saati, z.cikis_saati);
                  const initial = uzmanAd.charAt(0).toUpperCase();
                  const itemBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.02)';
                  const itemHover = isAktif
                    ? (isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)')
                    : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)');

                  return (
                    <div key={z.id}
                      className="flex items-start gap-3"
                      style={{ animation: `fadeSlideIn 0.3s ease ${idx * 0.06}s both` }}>

                      {/* Timeline dot */}
                      <div className="flex-shrink-0 w-9 flex justify-center pt-3 z-10">
                        {isAktif ? (
                          <div className="w-3.5 h-3.5 rounded-full animate-pulse"
                            style={{ background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />
                        ) : (
                          <div className="w-3 h-3 rounded-full"
                            style={{ background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)', border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}` }} />
                        )}
                      </div>

                      {/* İçerik kartı */}
                      <div className="flex-1 rounded-xl p-3.5 transition-all cursor-pointer"
                        style={{
                          background: itemBg,
                          border: isAktif
                            ? '1px solid rgba(34,197,94,0.2)'
                            : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}`,
                          boxShadow: isAktif ? 'inset 0 0 20px rgba(34,197,94,0.04)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = itemHover;
                          (e.currentTarget as HTMLElement).style.transform = 'translateX(2px) translateY(-1px)';
                          (e.currentTarget as HTMLElement).style.boxShadow = isAktif
                            ? '0 4px 16px rgba(34,197,94,0.12)'
                            : (isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(15,23,42,0.08)');
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = itemBg;
                          (e.currentTarget as HTMLElement).style.transform = 'none';
                          (e.currentTarget as HTMLElement).style.boxShadow = isAktif ? 'inset 0 0 20px rgba(34,197,94,0.04)' : 'none';
                        }}>

                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                            style={{
                              background: isAktif
                                ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                                : 'linear-gradient(135deg, #64748b, #475569)',
                            }}>
                            {initial}
                          </div>

                          {/* Ana bilgi */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold" style={{ color: textPrimary }}>{uzmanAd}</span>
                              <i className="ri-arrow-right-s-line text-[11px]" style={{ color: textSecondary }} />
                              <span className="text-xs font-semibold truncate" style={{ color: isAktif ? '#22C55E' : textSecondary }}>{firmaAd}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px]" style={{ color: textSecondary }}>
                                <i className="ri-login-box-line mr-0.5" />{girisSaat}
                              </span>
                              <span className="text-[10px] font-semibold"
                                style={{ color: isAktif ? '#22C55E' : textSecondary }}>
                                · {sure}
                              </span>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {z.ziyaret_tipi === 'qr' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                                QR
                              </span>
                            )}
                            {isAktif ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                                style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                                Aktif
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
                                Tamamlandı
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boş durum — ziyaret yoksa */}
      {!loading && son5.length === 0 && altFirmalar.length > 0 && (
        <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center" style={card}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.12)' }}>
            <i className="ri-route-line text-2xl" style={{ color: '#06B6D4' }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Henüz ziyaret kaydı yok</p>
            <p className="text-xs" style={{ color: textSecondary }}>
              Uzmanlar QR kod okutarak veya manuel olarak ziyaret başlattığında burada görünecek.
            </p>
          </div>
          <button onClick={() => setActiveTab('ziyaretler')}
            className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06B6D4' }}>
            <i className="ri-map-pin-line" />Ziyaretler Sayfasına Git
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
