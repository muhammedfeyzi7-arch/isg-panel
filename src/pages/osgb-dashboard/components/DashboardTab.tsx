import { useState, useEffect, memo } from 'react';
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
  giris_saati: string;
  cikis_saati: string | null;
  qr_ile_giris?: boolean;
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
      style={{ background: 'rgba(14,165,233,0.12)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#0EA5E9' }} />
      Bugün
    </span>
  );
  if (days <= 2) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0EA5E9' }} />
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

function DashboardTabInner({
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
      ? 'linear-gradient(145deg, rgba(26,31,55,0.97) 0%, rgba(15,19,32,0.99) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.97) 100%)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
    borderRadius: '20px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  };

  useEffect(() => {
    if (!orgId) return;

    // İlk yüklemede tüm listeyi bir kez çek
    const initialFetch = async () => {
      setLoading(true);
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data } = await supabase
          .from('osgb_ziyaretler')
          .select('id, uzman_user_id, firma_org_id, firma_ad, giris_saati, cikis_saati, qr_ile_giris')
          .eq('osgb_org_id', orgId)
          .gte('giris_saati', thirtyDaysAgo.toISOString())
          .order('giris_saati', { ascending: false });
        setZiyaretler(data ?? []);
      } catch (err) {
        console.error('[DashboardTab] ziyaret fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    initialFetch();

    // Realtime subscription — full fetch YOK, sadece gelen kaydı state'e işle
    const channel = supabase
      .channel(`dashboard_ziyaret_rt_${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'osgb_ziyaretler',
          filter: `osgb_org_id=eq.${orgId}`,
        },
        (payload) => {
          const yeni = payload.new as Ziyaret;
          // 30 gün filtresi — eski kayıt ise ekleme
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (new Date(yeni.giris_saati) < thirtyDaysAgo) return;

          setZiyaretler(prev => {
            // Duplicate kontrolü
            if (prev.some(z => z.id === yeni.id)) return prev;
            // giris_saati desc sırasına ekle
            const updated = [yeni, ...prev];
            updated.sort((a, b) =>
              new Date(b.giris_saati).getTime() - new Date(a.giris_saati).getTime()
            );
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'osgb_ziyaretler',
          filter: `osgb_org_id=eq.${orgId}`,
        },
        (payload) => {
          const guncellendi = payload.new as Ziyaret;
          setZiyaretler(prev =>
            prev.map(z => z.id === guncellendi.id ? { ...z, ...guncellendi } : z)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'osgb_ziyaretler',
          filter: `osgb_org_id=eq.${orgId}`,
        },
        (payload) => {
          const silindi = payload.old as { id: string };
          setZiyaretler(prev => prev.filter(z => z.id !== silindi.id));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
    if (!firmaLastVisit[z.firma_org_id] || z.giris_saati > firmaLastVisit[z.firma_org_id]) {
      firmaLastVisit[z.firma_org_id] = z.giris_saati;
    }
  });

  const uzmanLastVisit: Record<string, string> = {};
  ziyaretler.forEach(z => {
    if (!uzmanLastVisit[z.uzman_user_id] || z.giris_saati > uzmanLastVisit[z.uzman_user_id]) {
      uzmanLastVisit[z.uzman_user_id] = z.giris_saati;
    }
  });

  const aktifUzmanIds = new Set(aktifZiyaretler.map(z => z.uzman_user_id));
  const son5 = ziyaretler.slice(0, 5);

  const getUzmanAd = (uid: string) => {
    const u = uzmanlar.find(x => x.user_id === uid);
    return u?.display_name ?? u?.email ?? 'Bilinmeyen';
  };

  const getFirmaAd = (fid: string, firmaAd?: string | null) => {
    const f = altFirmalar.find(x => x.id === fid);
    return f?.name ?? firmaAd ?? 'Bilinmeyen Firma';
  };

  void bugunZiyaretler;

  void textMuted;

  return (
    <div className="space-y-5 page-enter">

      {/* ── KPI KARTLARI (PREMIUM) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Müşteri Firma - Coral/Orange */}
        <div
          className="rounded-2xl p-5 cursor-pointer relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
            boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
          }}
          onClick={() => setActiveTab('firmalar')}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 36px rgba(249,115,22,0.45)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(249,115,22,0.35)'; }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 opacity-20" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.6), transparent 70%)', borderRadius: '50%', transform: 'translate(20%, -20%)' }} />
          <div className="absolute bottom-0 left-0 w-20 h-20 opacity-10" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)', borderRadius: '50%', transform: 'translate(-30%, 30%)' }} />
          <div className="relative flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <i className="ri-building-2-fill text-lg text-white" />
            </div>
            <i className="ri-arrow-right-up-line text-white opacity-60 text-lg" />
          </div>
          <p className="relative text-[34px] font-black leading-none text-white mb-1">{altFirmalar.length}</p>
          <p className="relative text-[12px] font-semibold text-white opacity-80">Müşteri Firma</p>
          <p className="relative text-[10px] mt-1 text-white opacity-60">
            {altFirmalar.filter(f => f.uzmanAd).length} firmaya uzman atanmış
          </p>
        </div>

        {/* Aktif Ziyaret - Teal/Cyan */}
        <div
          className="rounded-2xl p-5 cursor-pointer relative overflow-hidden"
          style={{
            background: aktifZiyaretler.length > 0
              ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
              : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            boxShadow: aktifZiyaretler.length > 0
              ? '0 8px 24px rgba(6,182,212,0.4)'
              : '0 8px 24px rgba(14,165,233,0.35)',
          }}
          onClick={() => setActiveTab('ziyaretler')}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 opacity-20" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.6), transparent 70%)', borderRadius: '50%', transform: 'translate(20%, -20%)' }} />
          <div className="absolute bottom-0 left-0 w-20 h-20 opacity-10" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)', borderRadius: '50%', transform: 'translate(-30%, 30%)' }} />
          <div className="relative flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <i className="ri-map-pin-user-fill text-lg text-white" />
            </div>
            {aktifZiyaretler.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full animate-pulse bg-white opacity-80" />
                <span className="text-[10px] font-bold text-white opacity-80">CANLI</span>
              </div>
            ) : <i className="ri-arrow-right-up-line text-white opacity-60 text-lg" />}
          </div>
          <p className="relative text-[34px] font-black leading-none text-white mb-1">{aktifZiyaretler.length}</p>
          <p className="relative text-[12px] font-semibold text-white opacity-80">Aktif Ziyaret</p>
          <p className="relative text-[10px] mt-1 text-white opacity-60">
            {aktifZiyaretler.length === 0 ? 'Sahada kimse yok' : `${aktifZiyaretler.length} personel şu an sahada`}
          </p>
        </div>

        {/* Bugünkü Ziyaret - Indigo/Purple */}
        <div
          className="rounded-2xl p-5 cursor-pointer relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}
          onClick={() => setActiveTab('ziyaretler')}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 36px rgba(99,102,241,0.5)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(99,102,241,0.4)'; }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 opacity-20" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.6), transparent 70%)', borderRadius: '50%', transform: 'translate(20%, -20%)' }} />
          <div className="absolute bottom-0 left-0 w-20 h-20 opacity-10" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)', borderRadius: '50%', transform: 'translate(-30%, 30%)' }} />
          <div className="relative flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <i className="ri-calendar-check-fill text-lg text-white" />
            </div>
            <i className="ri-arrow-right-up-line text-white opacity-60 text-lg" />
          </div>
          <p className="relative text-[34px] font-black leading-none text-white mb-1">{bugunZiyaretler.length}</p>
          <p className="relative text-[12px] font-semibold text-white opacity-80">Bugünkü Ziyaret</p>
          <p className="relative text-[10px] mt-1 text-white opacity-60">Bu hafta {buHaftaZiyaretler.length} ziyaret</p>
        </div>

        {/* Son Aktivite - Emerald/Green */}
        <div
          className="rounded-2xl p-5 cursor-pointer relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: '0 8px 24px rgba(16,185,129,0.35)',
          }}
          onClick={() => setActiveTab('ziyaretler')}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 36px rgba(16,185,129,0.45)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(16,185,129,0.35)'; }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 opacity-20" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.6), transparent 70%)', borderRadius: '50%', transform: 'translate(20%, -20%)' }} />
          <div className="absolute bottom-0 left-0 w-20 h-20 opacity-10" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)', borderRadius: '50%', transform: 'translate(-30%, 30%)' }} />
          <div className="relative flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <i className="ri-pulse-fill text-lg text-white" />
            </div>
            <i className="ri-arrow-right-up-line text-white opacity-60 text-lg" />
          </div>
          <p className="relative text-base font-black leading-snug text-white mb-1">
            {sonZiyaret ? timeAgo(sonZiyaret.giris_saati) : '—'}
          </p>
          <p className="relative text-[12px] font-semibold text-white opacity-80">Son Aktivite</p>
          {sonZiyaret && <p className="relative text-[10px] mt-1 text-white opacity-60 truncate">{getFirmaAd(sonZiyaret.firma_org_id, sonZiyaret.firma_ad)}</p>}
          {!sonZiyaret && <p className="relative text-[10px] mt-1 text-white opacity-60">Henüz ziyaret yok</p>}
        </div>
      </div>

      {/* ── ANA GRID: Firmalar + Uzmanlar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Firmalar Kartı */}
        <div className="rounded-2xl" style={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.06))' }}>
                <i className="ri-building-2-fill text-sm" style={{ color: '#0EA5E9' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Müşteri Firmalar</h3>
                <p className="text-[10px]" style={{ color: textSecondary }}>{altFirmalar.length} firma kayıtlı</p>
              </div>
            </div>
            <button onClick={() => setActiveTab('firmalar')}
              className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ color: '#0EA5E9', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.08)'; }}>
              Tümünü Gör <i className="ri-arrow-right-s-line" />
            </button>
          </div>

          {altFirmalar.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 px-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.12)' }}>
                <i className="ri-building-2-line text-xl" style={{ color: '#0EA5E9' }} />
              </div>
              <p className="text-xs text-center" style={{ color: textSecondary }}>Henüz firma eklenmedi</p>
              <button onClick={onFirmaEkle}
                className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                <i className="ri-add-line" />Firma Ekle
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[2fr_1fr_80px] items-center px-4 py-2"
                style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)'}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)' }}>
                {['FİRMA', 'PERSONEL', 'ZİYARET'].map(h => (
                  <div key={h}><span className="text-[9px] font-bold tracking-wider" style={{ color: textSecondary }}>{h}</span></div>
                ))}
              </div>
              <div>
                {altFirmalar.slice(0, 5).map((f, idx) => {
                  const lastVisitDate = firmaLastVisit[f.id];
                  const days = getDaysDiff(lastVisitDate);
                  const isAktif = aktifZiyaretler.some(z => z.firma_org_id === f.id);
                  const rowBg = 'transparent';
                  const rowHover = isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.03)';
                  return (
                    <div key={f.id}
                      onClick={() => onFirmaClick({ id: f.id, name: f.name })}
                      className="grid grid-cols-[2fr_1fr_80px] items-center px-4 py-2.5 cursor-pointer transition-all"
                      style={{ background: rowBg, borderBottom: idx < Math.min(altFirmalar.length, 5) - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)'}` : 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = rowHover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: isAktif ? 'rgba(34,197,94,0.12)' : 'rgba(14,165,233,0.1)' }}>
                            <i className="ri-building-2-line text-[10px]" style={{ color: isAktif ? '#22C55E' : '#0284C7' }} />
                          </div>
                          {isAktif && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border animate-pulse"
                              style={{ background: '#22C55E', borderColor: isDark ? '#1e2d3d' : '#ffffff' }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{f.name}</p>
                          {isAktif && <span className="text-[9px] font-bold" style={{ color: '#22C55E' }}>● Aktif</span>}
                          {!isAktif && <span className="text-[9px]" style={{ color: textSecondary }}>{f.uzmanAd ?? 'Personel atanmadı'}</span>}
                        </div>
                      </div>
                      <div><span className="text-xs" style={{ color: textSecondary }}>{f.personelSayisi}</span></div>
                      <div><VisitStatusBadge days={days} /></div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Uzmanlar Kartı */}
        <div className="rounded-2xl" style={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.06))' }}>
                <i className="ri-user-star-fill text-sm" style={{ color: '#0EA5E9' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Personeller</h3>
                <p className="text-[10px]" style={{ color: textSecondary }}>
                  {aktifUzmanIds.size > 0 ? `${aktifUzmanIds.size} personel şu an sahada` : `${uzmanlar.length} personel kayıtlı`}
                </p>
              </div>
            </div>
            <button onClick={() => setActiveTab('uzmanlar')}
              className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ color: '#0EA5E9', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.08)'; }}>
              Tümünü Gör <i className="ri-arrow-right-s-line" />
            </button>
          </div>

          {uzmanlar.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 px-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.12)' }}>
                <i className="ri-user-star-line text-xl" style={{ color: '#0EA5E9' }} />
              </div>
              <p className="text-xs text-center" style={{ color: textSecondary }}>Henüz personel eklenmedi</p>
              <button onClick={onUzmanEkle}
                className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                <i className="ri-user-add-line" />Personel Ekle
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[2fr_1.2fr_1fr] items-center px-4 py-2"
                style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)' }}>
                {['PERSONEL', 'FİRMA', 'DURUM'].map(h => (
                  <div key={h}><span className="text-[9px] font-bold tracking-wider" style={{ color: textSecondary }}>{h}</span></div>
                ))}
              </div>
              <div>
                {uzmanlar.slice(0, 5).map((u, idx) => {
                  const isSahada = aktifUzmanIds.has(u.user_id);
                  const lastVisitDate = uzmanLastVisit[u.user_id] ?? null;
                  const days = getDaysDiff(lastVisitDate);
                  const rowBg = 'transparent';
                  const rowHover = isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.03)';
                  const initial = (u.display_name ?? u.email ?? '?').charAt(0).toUpperCase();
                  return (
                    <div key={u.user_id}
                      onClick={() => onUzmanClick(u)}
                      className="grid grid-cols-[2fr_1.2fr_1fr] items-center px-4 py-2.5 cursor-pointer transition-all"
                      style={{ background: rowBg, borderBottom: idx < Math.min(uzmanlar.length, 5) - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)'}` : 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = rowHover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                            style={{ background: isSahada ? 'linear-gradient(135deg, #22C55E, #16A34A)' : u.is_active ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                            {initial}
                          </div>
                          {isSahada && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border animate-pulse"
                              style={{ background: '#22C55E', borderColor: isDark ? '#1e2d3d' : '#ffffff' }} />
                          )}
                        </div>
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{u.display_name ?? u.email}</p>
                      </div>
                      <div><p className="text-[10px] truncate" style={{ color: textSecondary }}>{u.active_firm_name ?? '—'}</p></div>
                      <div>
                        {isSahada ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
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
            </>
          )}
        </div>
      </div>

      {/* ── BUGÜN SAHA AKIŞI ── */}
      {son5.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.06))' }}>
                <i className="ri-route-fill text-sm" style={{ color: '#0EA5E9' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Bugün Saha Nasıl?</h3>
                <p className="text-[10px]" style={{ color: textSecondary }}>En güncel {son5.length} ziyaret</p>
              </div>
            </div>
            <button onClick={() => setActiveTab('ziyaretler')}
              className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ color: '#0EA5E9', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.08)'; }}>
              Tümünü Gör <i className="ri-arrow-right-s-line" />
            </button>
          </div>

          <div className="p-5">
            <div className="relative">
              <div className="absolute left-[18px] top-5 bottom-5 w-px"
                style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)' }} />
              <div className="space-y-3">
                {son5.map((z, idx) => {
                  const isAktif = !z.cikis_saati;
                  const uzmanAd = getUzmanAd(z.uzman_user_id);
                  const firmaAd = getFirmaAd(z.firma_org_id, z.firma_ad);
                  const girisSaat = new Date(z.giris_saati).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                  const sure = formatDuration(z.giris_saati, z.cikis_saati);
                  const initial = uzmanAd.charAt(0).toUpperCase();
                  const itemBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.02)';
                  const itemHover = isAktif ? (isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)') : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)');

                  return (
                    <div key={z.id} className="flex items-start gap-3"
                      style={{ animation: `fadeSlideIn 0.3s ease ${idx * 0.06}s both` }}>
                      <div className="flex-shrink-0 w-9 flex justify-center pt-3 z-10">
                        {isAktif ? (
                          <div className="w-3.5 h-3.5 rounded-full animate-pulse"
                            style={{ background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />
                        ) : (
                          <div className="w-3 h-3 rounded-full"
                            style={{ background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)', border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}` }} />
                        )}
                      </div>
                      <div className="flex-1 rounded-xl p-3.5 transition-all cursor-pointer"
                        style={{
                          background: itemBg,
                          border: isAktif ? '1px solid rgba(34,197,94,0.2)' : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}`,
                          boxShadow: isAktif ? 'inset 0 0 20px rgba(34,197,94,0.04)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = itemHover;
                          (e.currentTarget as HTMLElement).style.transform = 'translateX(2px) translateY(-1px)';
                          (e.currentTarget as HTMLElement).style.boxShadow = isAktif ? '0 4px 16px rgba(34,197,94,0.12)' : (isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(15,23,42,0.08)');
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = itemBg;
                          (e.currentTarget as HTMLElement).style.transform = 'none';
                          (e.currentTarget as HTMLElement).style.boxShadow = isAktif ? 'inset 0 0 20px rgba(34,197,94,0.04)' : 'none';
                        }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                            style={{ background: isAktif ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold" style={{ color: textPrimary }}>{uzmanAd}</span>
                              <i className="ri-arrow-right-s-line text-[11px]" style={{ color: textSecondary }} />
                              <span className="text-xs font-semibold truncate" style={{ color: isAktif ? '#22C55E' : textSecondary }}>{firmaAd}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px]" style={{ color: textSecondary }}><i className="ri-login-box-line mr-0.5" />{girisSaat}</span>
                              <span className="text-[10px] font-semibold" style={{ color: isAktif ? '#22C55E' : textSecondary }}>· {sure}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {z.qr_ile_giris && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>QR</span>
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

      {/* Boş durum */}
      {!loading && son5.length === 0 && altFirmalar.length > 0 && (
        <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center" style={card}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.12)' }}>
            <i className="ri-route-line text-2xl" style={{ color: '#0EA5E9' }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Henüz ziyaret kaydı yok</p>
            <p className="text-xs" style={{ color: textSecondary }}>
              Uzmanlar QR kod okutarak veya manuel olarak ziyaret başlattığında burada görünecek.
            </p>
          </div>
          <button onClick={() => setActiveTab('ziyaretler')}
            className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
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

export default memo(DashboardTabInner);
