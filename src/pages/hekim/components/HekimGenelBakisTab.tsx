import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface OverallStats {
  toplamPersonel: number;
  toplamMuayene: number;
  toplamKaza: number;
  toplamIsGunuKaybi: number;
  acikKaza: number;
  agirKaza: number;
  sonMuayeneGunu: number | null;
  periyodikUyum: number;
}

interface FirmaRow {
  id: string;
  name: string;
  personelSayisi: number;
  muayeneSayisi: number;
  kazaSayisi: number;
}

interface HekimGenelBakisTabProps {
  orgId: string;
  atanmisFirmaIds: string[];
  isDark: boolean;
}

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

export default function HekimGenelBakisTab({ orgId, atanmisFirmaIds, isDark }: HekimGenelBakisTabProps) {
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [firmalar, setFirmalar] = useState<FirmaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  const card: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
    border: `1px solid ${borderColor}`,
    borderRadius: '20px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  };

  useEffect(() => {
    if (!orgId || atanmisFirmaIds.length === 0) {
      setStats(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setLoading(false); return; }

        const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', safeIds);

        const [muayeneAll, kazaAll] = await Promise.all([
          supabase.from('muayeneler').select('organization_id, data').in('organization_id', safeIds).is('deleted_at', null),
          supabase.from('is_kazalari').select('organization_id, durum, yaralanma_siddeti, is_gunu_kaybi').in('organization_id', safeIds).is('deleted_at', null),
        ]);

        const allMuayeneler = muayeneAll.data ?? [];
        const allKazalar = kazaAll.data ?? [];

        const totalMuayene = allMuayeneler.length;
        const totalKaza = allKazalar.length;
        const totalIsGunuKaybi = allKazalar.reduce((s, k) => s + (k.is_gunu_kaybi ?? 0), 0);
        const acikKaza = allKazalar.filter(k => k.durum === 'Açık').length;
        const agirKaza = allKazalar.filter(k => k.yaralanma_siddeti === 'Ağır' || k.yaralanma_siddeti === 'Çok Ağır').length;

        let sonMuayeneGunu: number | null = null;
        const muayeneTarihler = allMuayeneler
          .map(m => (m.data as Record<string, unknown>)?.muayeneTarihi as string | undefined)
          .filter((t): t is string => !!t)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        if (muayeneTarihler.length > 0) {
          sonMuayeneGunu = Math.floor((Date.now() - new Date(muayeneTarihler[0]).getTime()) / (1000 * 60 * 60 * 24));
        }

        const { count: toplamPersonelCount } = await supabase
          .from('personeller').select('id', { count: 'exact', head: true })
          .in('organization_id', safeIds);

        const toplamPersonel = toplamPersonelCount ?? 0;
        const muayeneliPersonelIds = new Set(
          allMuayeneler.map(m => (m.data as Record<string, unknown>)?.personelId as string).filter(Boolean)
        );
        const periyodikUyum = toplamPersonel > 0 ? Math.round((muayeneliPersonelIds.size / toplamPersonel) * 100) : 0;

        setStats({
          toplamPersonel,
          toplamMuayene: totalMuayene,
          toplamKaza: totalKaza,
          toplamIsGunuKaybi: totalIsGunuKaybi,
          acikKaza,
          agirKaza,
          sonMuayeneGunu,
          periyodikUyum,
        });

        const firmaRows: FirmaRow[] = await Promise.all(
          (orgs ?? []).map(async (org) => {
            const { count: personelCount } = await supabase
              .from('personeller').select('id', { count: 'exact', head: true })
              .eq('organization_id', org.id).is('deleted_at', null);
            const orgMuayeneler = allMuayeneler.filter(m => m.organization_id === org.id);
            const orgKazalar = allKazalar.filter(k => k.organization_id === org.id);
            return {
              id: org.id,
              name: org.name,
              personelSayisi: personelCount ?? 0,
              muayeneSayisi: orgMuayeneler.length,
              kazaSayisi: orgKazalar.length,
            };
          })
        );
        setFirmalar(firmaRows);
      } catch (err) {
        console.error('[HekimGenelBakisTab] load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orgId, atanmisFirmaIds]);

  if (loading) {
    return (
      <div className="rounded-2xl p-12 flex flex-col items-center gap-3"
        style={card}>
        <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: ACCENT }} />
        <p className="text-sm" style={{ color: textSecondary }}>Yükleniyor...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-2xl p-12 flex flex-col items-center gap-3"
        style={card}>
        <i className="ri-information-line text-2xl" style={{ color: textSecondary }} />
        <p className="text-sm" style={{ color: textSecondary }}>Veri bulunamadı</p>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Toplam Personel',
      value: stats.toplamPersonel,
      icon: 'ri-group-3-fill',
      color: ACCENT,
      gradFrom: 'rgba(14,165,233,0.22)',
      gradTo: 'rgba(14,165,233,0.07)',
      sub: `${atanmisFirmaIds.length} firmada`,
      trend: null,
      trendColor: ACCENT,
    },
    {
      label: 'Toplam Muayene',
      value: stats.toplamMuayene,
      icon: 'ri-stethoscope-fill',
      color: '#10B981',
      gradFrom: 'rgba(16,185,129,0.22)',
      gradTo: 'rgba(16,185,129,0.07)',
      sub: stats.sonMuayeneGunu !== null ? `Son: ${stats.sonMuayeneGunu}g önce` : 'Henüz yok',
      trend: null,
      trendColor: '#10B981',
    },
    {
      label: 'İş Kazası',
      value: stats.toplamKaza,
      icon: 'ri-alert-fill',
      color: '#EF4444',
      gradFrom: 'rgba(239,68,68,0.22)',
      gradTo: 'rgba(239,68,68,0.07)',
      sub: `${stats.agirKaza} ağır/çok ağır`,
      trend: stats.acikKaza > 0 ? `${stats.acikKaza} açık vaka` : null,
      trendColor: '#EF4444',
    },
    {
      label: 'İş Günü Kaybı',
      value: stats.toplamIsGunuKaybi,
      icon: 'ri-calendar-close-fill',
      color: '#F59E0B',
      gradFrom: 'rgba(245,158,11,0.22)',
      gradTo: 'rgba(245,158,11,0.07)',
      sub: 'Toplam gün',
      trend: null,
      trendColor: '#F59E0B',
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── KPI Kartlar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(kpi => (
          <div
            key={kpi.label}
            className="rounded-2xl p-5 group"
            style={card}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.boxShadow = isDark
                ? '0 12px 32px rgba(0,0,0,0.35)'
                : '0 12px 28px rgba(15,23,42,0.1)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${kpi.gradFrom}, ${kpi.gradTo})` }}
                >
                  <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                  {kpi.label}
                </span>
              </div>
              {kpi.trend && (
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    background: `${kpi.trendColor}18`,
                    color: kpi.trendColor,
                    border: `1px solid ${kpi.trendColor}30`,
                  }}
                >
                  {kpi.trend}
                </span>
              )}
            </div>
            <p
              className="text-[32px] font-black leading-none mb-2"
              style={{ color: textPrimary, letterSpacing: '-0.03em', fontFamily: "'Inter', sans-serif" }}
            >
              {kpi.value}
            </p>
            <p className="text-[11px] font-medium" style={{ color: textSecondary }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── İkinci Satır: Uyum + Risk + Firmalar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Periyodik Muayene Uyum */}
        <div className="rounded-2xl p-5" style={card}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.07))' }}>
                <i className="ri-heart-pulse-fill text-sm" style={{ color: '#10B981' }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                Periyodik Uyum
              </span>
            </div>
            <span
              className="text-lg font-black"
              style={{
                color: stats.periyodikUyum >= 80 ? '#10B981' : stats.periyodikUyum >= 50 ? '#F59E0B' : '#EF4444',
              }}
            >
              %{stats.periyodikUyum}
            </span>
          </div>
          <div
            className="h-2.5 rounded-full overflow-hidden mb-3"
            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${stats.periyodikUyum}%`,
                background: stats.periyodikUyum >= 80
                  ? 'linear-gradient(90deg, #059669, #10B981)'
                  : stats.periyodikUyum >= 50
                  ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                  : 'linear-gradient(90deg, #DC2626, #EF4444)',
              }}
            />
          </div>
          <p className="text-[11px] font-medium" style={{ color: textSecondary }}>
            {stats.toplamPersonel} personelden {stats.toplamMuayene} muayene kaydı
          </p>
        </div>

        {/* Kaza Risk Durumu */}
        <div className="rounded-2xl p-5" style={card}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(239,68,68,0.07))' }}>
              <i className="ri-error-warning-fill text-sm" style={{ color: '#EF4444' }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
              Kaza Risk Durumu
            </span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Açık Vakalar', value: stats.acikKaza, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
              { label: 'Ağır / Çok Ağır', value: stats.agirKaza, color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
              { label: 'Toplam Kayıp (gün)', value: stats.toplamIsGunuKaybi, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
            ].map(item => (
              <div
                key={item.label}
                className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: item.bg }}
              >
                <span className="text-[11px] font-medium" style={{ color: textSecondary }}>{item.label}</span>
                <span className="text-[13px] font-black" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Firma Özeti */}
        <div className="rounded-2xl p-5" style={card}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, rgba(14,165,233,0.22), rgba(14,165,233,0.07))` }}>
              <i className="ri-building-3-fill text-sm" style={{ color: ACCENT }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
              Firma Özeti
            </span>
          </div>
          <div className="space-y-2.5">
            {firmalar.slice(0, 3).map(f => (
              <div key={f.id} className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
                >
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold truncate" style={{ color: textPrimary }}>{f.name}</span>
                    <span className="text-[10px] font-bold flex-shrink-0 ml-2" style={{ color: textSecondary }}>
                      {f.personelSayisi} kişi
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <span className="text-[10px] font-medium" style={{ color: '#10B981' }}>
                      <i className="ri-stethoscope-line mr-0.5" />{f.muayeneSayisi}
                    </span>
                    {f.kazaSayisi > 0 && (
                      <span className="text-[10px] font-medium" style={{ color: '#EF4444' }}>
                        <i className="ri-alert-line mr-0.5" />{f.kazaSayisi} kaza
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {firmalar.length > 3 && (
              <p className="text-[10px] font-semibold text-center pt-1" style={{ color: textSecondary }}>
                +{firmalar.length - 3} firma daha
              </p>
            )}
            {firmalar.length === 0 && (
              <p className="text-[11px] text-center py-2" style={{ color: textSecondary }}>Firma bulunamadı</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Özet Bandı ── */}
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-5 flex-wrap"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(14,165,233,0.08) 0%, rgba(2,132,199,0.05) 100%)'
            : 'linear-gradient(145deg, rgba(14,165,233,0.06) 0%, rgba(2,132,199,0.03) 100%)',
          border: `1px solid rgba(14,165,233,0.18)`,
          borderRadius: '20px',
        }}
      >
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.22), rgba(14,165,233,0.07))' }}>
            <i className="ri-file-chart-fill text-sm" style={{ color: ACCENT }} />
          </div>
          <span className="text-xs font-bold" style={{ color: ACCENT }}>Genel Bakış Özeti</span>
        </div>
        <div className="flex items-center gap-6 flex-wrap flex-1">
          {[
            { label: 'Aktif Firma', val: atanmisFirmaIds.length },
            { label: 'Toplam Personel', val: stats.toplamPersonel },
            { label: 'Muayene Kaydı', val: stats.toplamMuayene },
            { label: 'Kaza Kaydı', val: stats.toplamKaza },
            { label: 'Kayıp Gün', val: stats.toplamIsGunuKaybi },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-xl font-black leading-none" style={{ color: textPrimary, letterSpacing: '-0.03em' }}>
                {item.val}
              </p>
              <p className="text-[9px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: textSecondary }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
          <span className="text-[10px] font-semibold" style={{ color: '#10B981' }}>Canlı Veri</span>
        </div>
      </div>
    </div>
  );
}
