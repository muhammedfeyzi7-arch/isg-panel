import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { buildFirmaRapor, downloadFirmaRapor } from '../utils/firmaRaporExcel';
import ZiyaretlerTab from './ZiyaretlerTab';

interface FirmaKarti {
  id: string;
  name: string;
  tehlikeSinifi: string | null;
  durum: string | null;
  personelSayisi: number;
  ekipmanSayisi: number;
  acikUygunsuzluk: number;
  sonZiyaret: string | null;
  uzmanAd: string | null;
  egitimSayisi: number;
}

const TEHLIKE_RENK: Record<string, { color: string; bg: string; border: string }> = {
  'Az Tehlikeli':  { color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.25)' },
  'Tehlikeli':     { color: '#D97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.25)' },
  'Çok Tehlikeli': { color: '#DC2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.25)' },
};

function getTehlikeRenk(sinif?: string | null) {
  return TEHLIKE_RENK[sinif ?? ''] ?? { color: '#64748B', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' };
}

// ── LISTE SATIRI ──────────────────────────────────────────────────────────────
function FirmaListRow({ firma, isDark, onExcelIndir, exporting }: {
  firma: FirmaKarti;
  isDark: boolean;
  onExcelIndir: (firmaId: string, firmaAdi: string) => void;
  exporting: string | null;
}) {
  const tehlike = getTehlikeRenk(firma.tehlikeSinifi);
  const isExporting = exporting === firma.id;
  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  return (
    <div
      className="grid items-center px-4 py-3 rounded-xl transition-all"
      style={{
        gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1.4fr 160px',
        background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${tehlike.color}`,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.03)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.02)' : '#fff'; }}
    >
      {/* Firma adı */}
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${tehlike.color}CC, ${tehlike.color}77)` }}>
          {firma.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold truncate" style={{ color: textPrimary }}>{firma.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {firma.tehlikeSinifi && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: tehlike.bg, color: tehlike.color, border: `1px solid ${tehlike.border}` }}>
                {firma.tehlikeSinifi}
              </span>
            )}
            {firma.uzmanAd && (
              <span className="text-[9px] truncate max-w-[110px]" style={{ color: textMuted }}>
                <i className="ri-user-star-line mr-0.5" style={{ color: '#0EA5E9' }} />
                {firma.uzmanAd}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Personel */}
      <div className="flex items-center gap-1.5">
        <i className="ri-group-line text-xs" style={{ color: '#0EA5E9' }} />
        <span className="text-xs font-bold" style={{ color: textPrimary }}>{firma.personelSayisi}</span>
        <span className="text-[10px]" style={{ color: textMuted }}>personel</span>
      </div>

      {/* Ekipman */}
      <div className="flex items-center gap-1.5">
        <i className="ri-tools-line text-xs" style={{ color: '#F59E0B' }} />
        <span className="text-xs font-bold" style={{ color: textPrimary }}>{firma.ekipmanSayisi}</span>
        <span className="text-[10px]" style={{ color: textMuted }}>ekipman</span>
      </div>

      {/* Açık uyg. */}
      <div className="flex items-center gap-1.5">
        <i className="ri-alert-line text-xs" style={{ color: firma.acikUygunsuzluk > 0 ? '#EF4444' : '#10B981' }} />
        <span className="text-xs font-bold" style={{ color: firma.acikUygunsuzluk > 0 ? '#EF4444' : '#10B981' }}>{firma.acikUygunsuzluk}</span>
        <span className="text-[10px]" style={{ color: textMuted }}>açık</span>
      </div>

      {/* Son ziyaret */}
      <div>
        {firma.sonZiyaret ? (
          <span className="text-[10px] font-medium" style={{ color: textMuted }}>
            {new Date(firma.sonZiyaret).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        ) : (
          <span className="text-[10px]" style={{ color: textMuted }}>—</span>
        )}
      </div>

      {/* Durum */}
      <div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{
            background: firma.durum === 'Aktif' ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
            color: firma.durum === 'Aktif' ? '#10B981' : '#64748B',
            border: `1px solid ${firma.durum === 'Aktif' ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.2)'}`,
          }}>
          {firma.durum ?? 'Bilinmiyor'}
        </span>
      </div>

      {/* Excel İndir */}
      <div className="flex justify-end">
        <button
          onClick={() => onExcelIndir(firma.id, firma.name)}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer whitespace-nowrap transition-all"
          style={{
            background: isExporting ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg, #059669, #10B981)',
            border: '1px solid rgba(16,185,129,0.3)',
            opacity: isExporting ? 0.8 : 1,
            color: '#ffffff',
          }}
          onMouseEnter={e => { if (!isExporting) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
        >
          {isExporting ? (
            <><i className="ri-loader-4-line animate-spin text-xs" style={{ color: '#fff' }} />Hazırlanıyor...</>
          ) : (
            <><i className="ri-file-excel-2-line text-xs" style={{ color: '#fff' }} />Excel İndir</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── TOPLU ZIP ────────────────────────────────────────────────────────────────
async function topluZipIndir(
  firmalar: FirmaKarti[],
  onProgress: (current: number, total: number) => void
) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const now = new Date();
  const klasor = zip.folder(
    `OSGB-Tum-Firmalar-${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`
  );
  if (!klasor) return;
  for (let i = 0; i < firmalar.length; i++) {
    onProgress(i + 1, firmalar.length);
    const f = firmalar[i];
    try {
      const blob = await buildFirmaRapor(f.id, f.name);
      const safe = f.name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').trim().replace(/\s+/g, '-').toUpperCase();
      klasor.file(`${safe}-RAPOR.xlsx`, blob);
    } catch { /* firma raporu alınamazsa geç */ }
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OSGB-Tum-Firmalar-${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}.zip`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

interface OsgbRaporlarPageProps {
  isDark: boolean;
}

type ActiveTab = 'firmalar' | 'ziyaretler';

export default function OsgbRaporlarPage({ isDark }: OsgbRaporlarPageProps) {
  const { org } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>('firmalar');
  const [firmalar, setFirmalar] = useState<FirmaKarti[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [topluExporting, setTopluExporting] = useState(false);
  const [topluProgress, setTopluProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTehlike, setFilterTehlike] = useState<string>('');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterDropdownOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const fetchFirmalar = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      // 1) Firmalar
      const { data: firmData } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('parent_org_id', org.id)
        .eq('org_type', 'firma')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!firmData?.length) { setFirmalar([]); return; }

      // 2) app_data (tehlikeSinifi, durum) — tüm firmalar için tek sorguda
      const firmaIds = firmData.map(f => f.id);
      const { data: appDataAll } = await supabase
        .from('app_data')
        .select('organization_id, data')
        .in('organization_id', firmaIds);

      const appDataMap: Record<string, Record<string, unknown>> = {};
      (appDataAll ?? []).forEach(r => { appDataMap[r.organization_id] = (r.data ?? {}) as Record<string, unknown>; });

      // 3) Uzman atamaları
      const { data: uzmanData } = await supabase
        .from('user_organizations')
        .select('display_name, active_firm_id, active_firm_ids')
        .eq('organization_id', org.id)
        .eq('osgb_role', 'gezici_uzman');

      // 4) Sayımlar — her firma için paralel sorgular (batched)
      const enriched: FirmaKarti[] = await Promise.all(
        firmData.map(async f => {
          const [
            { count: personelSayisi },
            { count: ekipmanSayisi },
            { count: acikUyg },
            { count: egitimSayisi },
            { data: sonZiyaretData },
          ] = await Promise.all([
            supabase.from('personeller')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', f.id)
              .is('deleted_at', null),
            supabase.from('ekipmanlar')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', f.id)
              .is('deleted_at', null),
            supabase.from('uygunsuzluklar')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', f.id)
              .is('deleted_at', null)
              .not('data->>durum', 'in', '("Kapandı","Kapatıldı")'),
            supabase.from('egitimler')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', f.id)
              .is('deleted_at', null),
            supabase.from('osgb_ziyaretler')
              .select('giris_saati')
              .eq('firma_org_id', f.id)
              .order('giris_saati', { ascending: false })
              .limit(1),
          ]);

          const meta = appDataMap[f.id] ?? {};
          const atanan = (uzmanData ?? []).find(u =>
            u.active_firm_id === f.id ||
            (Array.isArray(u.active_firm_ids) && (u.active_firm_ids as string[]).includes(f.id))
          );

          return {
            id: f.id,
            name: f.name,
            tehlikeSinifi: (meta.tehlikeSinifi as string) ?? null,
            durum: (meta.durum as string) ?? 'Aktif',
            personelSayisi: personelSayisi ?? 0,
            ekipmanSayisi: ekipmanSayisi ?? 0,
            acikUygunsuzluk: acikUyg ?? 0,
            egitimSayisi: egitimSayisi ?? 0,
            sonZiyaret: sonZiyaretData?.[0]?.giris_saati ?? null,
            uzmanAd: atanan?.display_name ?? null,
          };
        })
      );

      setFirmalar(enriched);
    } finally {
      setLoading(false);
    }
  }, [org?.id]);

  useEffect(() => { void fetchFirmalar(); }, [fetchFirmalar]);

  const handleExcelIndir = async (firmaId: string, firmaAdi: string) => {
    setExporting(firmaId);
    try {
      const blob = await buildFirmaRapor(firmaId, firmaAdi);
      downloadFirmaRapor(blob, firmaAdi);
    } finally {
      setExporting(null);
    }
  };

  const handleTopluIndir = async () => {
    if (topluExporting || filteredFirmalar.length === 0) return;
    setTopluExporting(true);
    setTopluProgress({ current: 0, total: filteredFirmalar.length });
    try {
      await topluZipIndir(filteredFirmalar, (c, t) => setTopluProgress({ current: c, total: t }));
    } finally {
      setTopluExporting(false);
      setTopluProgress(null);
    }
  };

  const filteredFirmalar = firmalar.filter(f => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || f.name.toLowerCase().includes(q) || (f.uzmanAd ?? '').toLowerCase().includes(q);
    const matchT = !filterTehlike || f.tehlikeSinifi === filterTehlike;
    return matchQ && matchT;
  });

  const totalPersonel = firmalar.reduce((s, f) => s + f.personelSayisi, 0);
  const totalAcikUyg = firmalar.reduce((s, f) => s + f.acikUygunsuzluk, 0);
  const activeFilterCount = [filterTehlike].filter(Boolean).length;

  const textMuted = 'var(--text-muted)';
  const textPrimary = 'var(--text-primary)';

  const tabs: { id: ActiveTab; icon: string; label: string }[] = [
    { id: 'firmalar', icon: 'ri-building-2-line', label: 'Firma Raporları' },
    { id: 'ziyaretler', icon: 'ri-map-pin-user-line', label: 'Saha Ziyaretleri' },
  ];

  return (
    <div className="space-y-5">
      {/* Sayfa Başlığı */}
      <div className="rounded-2xl px-5 py-4"
        style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)', borderTop: '3px solid #10B981' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <i className="ri-file-chart-line text-lg" style={{ color: '#10B981' }} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold" style={{ color: textPrimary, letterSpacing: '-0.01em' }}>Raporlar</h1>
              <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
                Firma bazlı kapsamlı Excel raporları ve saha ziyaret takibi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: 'Firma', value: firmalar.length, color: '#10B981', icon: 'ri-building-2-line' },
              { label: 'Personel', value: totalPersonel, color: '#0EA5E9', icon: 'ri-group-line' },
              { label: 'Açık Uyg.', value: totalAcikUyg, color: totalAcikUyg > 0 ? '#EF4444' : '#10B981', icon: 'ri-alert-line' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                style={{ background: `${stat.color}0A`, border: `1px solid ${stat.color}22` }}>
                <i className={`${stat.icon} text-sm`} style={{ color: stat.color }} />
                <div>
                  <p className="text-base font-black leading-none" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[9px] font-semibold" style={{ color: textMuted }}>{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigator */}
      <div className="flex items-center gap-1 p-1 rounded-xl"
        style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-semibold transition-all whitespace-nowrap cursor-pointer"
            style={activeTab === tab.id ? {
              background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)',
            } : { color: textMuted, border: '1px solid transparent' }}>
            <i className={`${tab.icon} text-xs`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── FİRMALAR TAB ── */}
      {activeTab === 'firmalar' && (
        <div className="space-y-3">
          {/* Araçlar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1" style={{ minWidth: 220, maxWidth: 360 }}>
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: textMuted }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Firma veya uzman ara..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary, fontSize: '13px' }} />
            </div>

            {/* Filtre */}
            <div className="relative" ref={filterRef}>
              <button onClick={() => setFilterDropdownOpen(v => !v)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{
                  background: activeFilterCount > 0 ? 'rgba(16,185,129,0.1)' : 'var(--bg-input)',
                  border: `1px solid ${activeFilterCount > 0 ? 'rgba(16,185,129,0.3)' : 'var(--border-input)'}`,
                  color: activeFilterCount > 0 ? '#10B981' : 'var(--text-secondary)',
                }}>
                <i className="ri-filter-3-line text-xs" />
                Filtrele
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: '#10B981' }}>{activeFilterCount}</span>
                )}
              </button>
              {filterDropdownOpen && (
                <div className="absolute left-0 top-11 z-50 w-56 p-4 rounded-2xl"
                  style={{
                    background: 'var(--modal-bg)', border: '1px solid var(--modal-border)',
                    boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 16px 40px rgba(15,23,42,0.12)',
                  }}>
                  <p className="text-xs font-bold mb-3" style={{ color: textPrimary }}>Tehlike Sınıfı</p>
                  <div className="space-y-1">
                    {['', 'Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'].map(opt => (
                      <button key={opt} onClick={() => { setFilterTehlike(opt); setFilterDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer text-left"
                        style={{
                          background: filterTehlike === opt ? (opt ? `${getTehlikeRenk(opt).bg}` : 'rgba(16,185,129,0.08)') : 'transparent',
                          color: filterTehlike === opt ? (opt ? getTehlikeRenk(opt).color : '#10B981') : 'var(--text-secondary)',
                        }}>
                        {filterTehlike === opt && <i className="ri-check-line text-[10px]" />}
                        {opt || 'Tümü'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}>
              {filteredFirmalar.length} firma
            </span>

            {/* Yenile */}
            <button onClick={() => void fetchFirmalar()}
              className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
              title="Yenile">
              <i className="ri-refresh-line text-sm" />
            </button>

            {/* Toplu ZIP */}
            <button onClick={() => void handleTopluIndir()}
              disabled={topluExporting || filteredFirmalar.length === 0}
              className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap transition-all"
              style={{
                background: topluExporting ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg, #059669, #10B981)',
                color: 'white', border: '1px solid rgba(16,185,129,0.3)',
                opacity: filteredFirmalar.length === 0 ? 0.5 : 1,
              }}>
              {topluExporting
                ? topluProgress
                  ? <><i className="ri-loader-4-line animate-spin text-xs" />{topluProgress.current}/{topluProgress.total} hazırlanıyor...</>
                  : <><i className="ri-loader-4-line animate-spin text-xs" />Hazırlanıyor...</>
                : <><i className="ri-folder-zip-line text-sm" />Tüm Firmaları ZIP İndir</>
              }
            </button>
          </div>

          {/* Liste */}
          {loading ? (
            <div className="rounded-2xl p-12 flex flex-col items-center gap-3"
              style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
              <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
              <p className="text-sm" style={{ color: textMuted }}>Firmalar yükleniyor...</p>
            </div>
          ) : filteredFirmalar.length === 0 ? (
            <div className="rounded-2xl p-14 flex flex-col items-center gap-4"
              style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-16 h-16 flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.15)' }}>
                <i className="ri-building-2-line text-2xl" style={{ color: '#10B981' }} />
              </div>
              <p className="text-sm font-bold" style={{ color: textPrimary }}>
                {firmalar.length === 0 ? 'Henüz firma eklenmemiş' : 'Arama kriterine uygun firma bulunamadı'}
              </p>
              {(searchQuery || filterTehlike) && (
                <button onClick={() => { setSearchQuery(''); setFilterTehlike(''); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                  <i className="ri-close-line" />Filtreleri Temizle
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
              {/* Tablo başlık satırı */}
              <div className="hidden lg:grid px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1.4fr 160px',
                  borderBottom: '1px solid var(--border-subtle)',
                  color: textMuted,
                  background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,252,0.8)',
                }}>
                <div>Firma</div>
                <div>Personel</div>
                <div>Ekipman</div>
                <div>Açık Uyg.</div>
                <div>Son Ziyaret</div>
                <div>Durum</div>
                <div className="text-right">Rapor</div>
              </div>

              {/* Satırlar */}
              <div className="p-2 space-y-1">
                {filteredFirmalar.map(firma => (
                  <FirmaListRow
                    key={firma.id}
                    firma={firma}
                    isDark={isDark}
                    onExcelIndir={(id, ad) => void handleExcelIndir(id, ad)}
                    exporting={exporting}
                  />
                ))}
              </div>

              {/* Alt bilgi */}
              <div className="flex items-start gap-3 px-4 py-3 mx-2 mb-2 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
                <p className="text-[11px] leading-relaxed" style={{ color: textMuted }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Kapsamlı Excel Raporu</strong> içeriği:
                  Personel listesi, evrak durumu, eğitimler, sağlık takibi, uygunsuzluklar, ekipmanlar, tutanaklar ve iş izinleri — hepsi ayrı sheet&#39;ler halinde.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ZİYARETLER TAB ── */}
      {activeTab === 'ziyaretler' && (
        <ZiyaretlerTab isDark={isDark} />
      )}
    </div>
  );
}
