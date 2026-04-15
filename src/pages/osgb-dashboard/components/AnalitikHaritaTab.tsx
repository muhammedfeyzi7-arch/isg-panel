import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

interface Ziyaret {
  id: string;
  firma_ad: string | null;
  uzman_ad: string | null;
  uzman_email: string | null;
  firma_org_id: string;
  uzman_user_id: string;
  giris_saati: string;
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  sure_dakika: number | null;
  gps_status: 'ok' | 'too_far' | 'no_permission' | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_distance_m: number | null;
  qr_ile_giris: boolean;
}

interface ZiyaretPlani {
  id: string;
  firma_org_id: string;
  hedef_uzman_user_ids: string[] | null;
  gunler: string[] | null;
  notlar: string | null;
  firma_ad?: string;
}

interface Uzman {
  user_id: string;
  display_name: string;
  email: string;
  is_active: boolean;
}

interface AltFirma {
  id: string;
  name: string;
}

type DonemFilter = 'bugun' | 'bu_hafta' | 'bu_ay' | 'son_30';
type AnalitikTab = 'personel_detay' | 'ziyaret_planlama' | 'harita' | 'takvim';

function formatSure(dk: number | null, giris: string, cikis: string | null): string {
  const minutes = dk != null && dk > 0
    ? dk
    : cikis ? Math.round((new Date(cikis).getTime() - new Date(giris).getTime()) / 60000) : null;
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}s ${m}d` : `${m}d`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

const GUN_LABELS: Record<string, string> = {
  'monday': 'Pazartesi', 'tuesday': 'Salı', 'wednesday': 'Çarşamba',
  'thursday': 'Perşembe', 'friday': 'Cuma', 'saturday': 'Cumartesi', 'sunday': 'Pazar',
  'Pazartesi': 'Pazartesi', 'Salı': 'Salı', 'Çarşamba': 'Çarşamba',
  'Perşembe': 'Perşembe', 'Cuma': 'Cuma', 'Cumartesi': 'Cumartesi', 'Pazar': 'Pazar',
};

const TODAY_DAY_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
const TODAY_DAY_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][new Date().getDay()];

interface AnalitikHaritaTabProps {
  isDark: boolean;
}

export default function AnalitikHaritaTab({ isDark }: AnalitikHaritaTabProps) {
  const { org, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<AnalitikTab>('personel_detay');
  const [donem, setDonem] = useState<DonemFilter>('bugun');
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [planlar, setPlanlar] = useState<ZiyaretPlani[]>([]);
  const [uzmanlar, setUzmanlar] = useState<Uzman[]>([]);
  const [firmalar, setFirmalar] = useState<AltFirma[]>([]);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);

  // Plan modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planFirmaId, setPlanFirmaId] = useState('');
  const [planUzmanIds, setPlanUzmanIds] = useState<string[]>([]);
  const [planGunler, setPlanGunler] = useState<string[]>([]);
  const [planNotlar, setPlanNotlar] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
  };

  const getDateRange = useCallback((d: DonemFilter) => {
    const now = new Date();
    if (d === 'bugun') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (d === 'bu_hafta') {
      const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const start = new Date(now); start.setDate(now.getDate() - dow); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (d === 'bu_ay') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(now); start.setDate(now.getDate() - 30);
    return { start, end: now };
  }, []);

  const fetchAll = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const { start, end } = getDateRange(donem);

      const [{ data: zData }, { data: uzmanData }, { data: firmaData }] = await Promise.all([
        supabase
          .from('osgb_ziyaretler')
          .select('id,firma_ad,uzman_ad,uzman_email,firma_org_id,uzman_user_id,giris_saati,cikis_saati,durum,sure_dakika,gps_status,check_in_lat,check_in_lng,check_in_distance_m,qr_ile_giris')
          .eq('osgb_org_id', org.id)
          .gte('giris_saati', start.toISOString())
          .lte('giris_saati', end.toISOString())
          .order('giris_saati', { ascending: false })
          .limit(500),
        supabase
          .from('user_organizations')
          .select('user_id, display_name, email, is_active')
          .eq('organization_id', org.id)
          .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi']),
        supabase
          .from('organizations')
          .select('id, name')
          .eq('parent_org_id', org.id)
          .eq('org_type', 'firma')
          .is('deleted_at', null),
      ]);

      setZiyaretler((zData ?? []) as Ziyaret[]);
      setUzmanlar((uzmanData ?? []).map(u => ({
        user_id: u.user_id,
        display_name: u.display_name ?? u.email ?? '',
        email: u.email ?? '',
        is_active: u.is_active,
      })));
      setFirmalar((firmaData ?? []).map(f => ({ id: f.id, name: f.name })));
    } finally {
      setLoading(false);
    }
  }, [org?.id, donem, getDateRange]);

  const fetchPlanlar = useCallback(async () => {
    if (!org?.id) return;
    const { data } = await supabase
      .from('osgb_ziyaret_planlari')
      .select('*')
      .eq('osgb_org_id', org.id)
      .eq('aktif', true);

    const planList = data ?? [];

    // Firma adlarını ekle
    const firmaIds = [...new Set(planList.map(p => p.firma_org_id))];
    if (firmaIds.length > 0) {
      const { data: firmaData } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', firmaIds);
      const firmaMap: Record<string, string> = {};
      (firmaData ?? []).forEach(f => { firmaMap[f.id] = f.name; });
      setPlanlar(planList.map(p => ({ ...p, firma_ad: firmaMap[p.firma_org_id] ?? '—' })));
    } else {
      setPlanlar([]);
    }
  }, [org?.id]);

  useEffect(() => {
    void fetchAll();
    void fetchPlanlar();
  }, [fetchAll, fetchPlanlar]);

  // Bugün ziyaret planı olan firmalar
  const bugunPlanlar = useMemo(() => {
    return planlar.filter(p => {
      const gunler = p.gunler ?? [];
      return gunler.some(g => {
        if (typeof g !== 'string') return false;
        try {
          return g.toLowerCase() === TODAY_DAY_EN || g === TODAY_DAY_TR;
        } catch {
          return false;
        }
      });
    });
  }, [planlar]);

  // Bugün o plan için gerçek ziyaret yapıldı mı kontrolü
  const todayStr = new Date().toISOString().split('T')[0];
  const bugunZiyaretFirmaIds = useMemo(() => {
    const today = new Date().toDateString();
    return new Set(
      ziyaretler
        .filter(z => new Date(z.giris_saati).toDateString() === today)
        .map(z => z.firma_org_id)
    );
  }, [ziyaretler]);

  // Kişi bazlı istatistikler
  const personelIstatistik = useMemo(() => {
    const map = new Map<string, {
      user_id: string;
      ad: string;
      email: string;
      ziyaretSayisi: number;
      toplamDakika: number;
      ihlalSayisi: number;
      firmaSet: Set<string>;
    }>();

    ziyaretler.forEach(z => {
      const key = z.uzman_user_id;
      if (!map.has(key)) {
        map.set(key, {
          user_id: key,
          ad: z.uzman_ad ?? z.uzman_email ?? '—',
          email: z.uzman_email ?? '',
          ziyaretSayisi: 0,
          toplamDakika: 0,
          ihlalSayisi: 0,
          firmaSet: new Set(),
        });
      }
      const s = map.get(key)!;
      s.ziyaretSayisi++;
      const dk = z.sure_dakika ?? (z.cikis_saati
        ? Math.round((new Date(z.cikis_saati).getTime() - new Date(z.giris_saati).getTime()) / 60000)
        : 0);
      s.toplamDakika += dk;
      if (z.gps_status === 'too_far') s.ihlalSayisi++;
      if (z.firma_org_id) s.firmaSet.add(z.firma_org_id);
    });

    return [...map.values()].sort((a, b) => b.ziyaretSayisi - a.ziyaretSayisi);
  }, [ziyaretler]);

  // GPS ihlalleri
  const ihlaller = useMemo(() =>
    ziyaretler.filter(z => z.gps_status === 'too_far'),
    [ziyaretler]
  );

  const handlePlanKaydet = async () => {
    if (!org?.id || !planFirmaId || planGunler.length === 0) {
      addToast('Firma ve en az bir gün seçin.', 'error');
      return;
    }
    setPlanLoading(true);
    try {
      if (editingPlanId) {
        const { error } = await supabase
          .from('osgb_ziyaret_planlari')
          .update({
            firma_org_id: planFirmaId,
            hedef_uzman_user_ids: planUzmanIds.length > 0 ? planUzmanIds : null,
            gunler: planGunler,
            notlar: planNotlar || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPlanId);
        if (error) throw error;
        addToast('Plan güncellendi!', 'success');
      } else {
        const { error } = await supabase
          .from('osgb_ziyaret_planlari')
          .insert({
            osgb_org_id: org.id,
            firma_org_id: planFirmaId,
            hedef_uzman_user_ids: planUzmanIds.length > 0 ? planUzmanIds : null,
            gunler: planGunler,
            notlar: planNotlar || null,
            aktif: true,
          });
        if (error) throw error;
        addToast('Ziyaret planı oluşturuldu!', 'success');
      }
      setShowPlanModal(false);
      resetPlanForm();
      void fetchPlanlar();
    } catch (err) {
      addToast(`Hata: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setPlanLoading(false);
    }
  };

  const handlePlanSil = async (planId: string) => {
    try {
      const { error } = await supabase
        .from('osgb_ziyaret_planlari')
        .update({ aktif: false })
        .eq('id', planId);
      if (error) throw error;
      addToast('Plan silindi.', 'success');
      void fetchPlanlar();
    } catch (err) {
      addToast(`Hata: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handlePlanEdit = (plan: ZiyaretPlani) => {
    setEditingPlanId(plan.id);
    setPlanFirmaId(plan.firma_org_id);
    setPlanUzmanIds(plan.hedef_uzman_user_ids ?? []);
    setPlanGunler(plan.gunler ?? []);
    setPlanNotlar(plan.notlar ?? '');
    setShowPlanModal(true);
  };

  const resetPlanForm = () => {
    setPlanFirmaId('');
    setPlanUzmanIds([]);
    setPlanGunler([]);
    setPlanNotlar('');
    setEditingPlanId(null);
  };

  const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

  const TABS: { id: AnalitikTab; label: string; icon: string }[] = [
    { id: 'personel_detay', label: 'Personel Detay', icon: 'ri-bar-chart-grouped-line' },
    { id: 'ziyaret_planlama', label: 'Ziyaret Planlama', icon: 'ri-calendar-schedule-line' },
    { id: 'harita', label: 'Harita', icon: 'ri-map-pin-2-line' },
    { id: 'takvim', label: 'Ziyaret Takvimi', icon: 'ri-calendar-check-line' },
  ];

  return (
    <div className="space-y-5 page-enter">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: textPrimary }}>Analiz & Harita</h2>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>Saha analizi, ziyaret planlaması ve konum haritası</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Dönem seçici — sadece personel detay ve harita için */}
          {(activeTab === 'personel_detay' || activeTab === 'harita') && (
            <div className="flex items-center gap-0.5 p-1 rounded-xl"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
              {([
                { id: 'bugun' as DonemFilter, label: 'Bugün' },
                { id: 'bu_hafta' as DonemFilter, label: 'Hafta' },
                { id: 'bu_ay' as DonemFilter, label: 'Ay' },
                { id: 'son_30' as DonemFilter, label: '30 Gün' },
              ]).map(opt => (
                <button key={opt.id} onClick={() => setDonem(opt.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: donem === opt.id ? 'rgba(14,165,233,0.12)' : 'transparent',
                    color: donem === opt.id ? '#0EA5E9' : textMuted,
                    border: donem === opt.id ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => { void fetchAll(); void fetchPlanlar(); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
            style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; }}>
            <i className="ri-refresh-line text-sm" />
          </button>
        </div>
      </div>

      {/* Alt Sekmeler */}
      <div className="flex items-center gap-1 p-1 rounded-2xl overflow-x-auto"
        style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
            style={{
              background: activeTab === tab.id ? 'var(--bg-card-solid)' : 'transparent',
              color: activeTab === tab.id ? '#0EA5E9' : textMuted,
              border: activeTab === tab.id ? '1px solid var(--border-subtle)' : '1px solid transparent',
            }}>
            <i className={`${tab.icon} text-sm`} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl py-16 flex items-center justify-center gap-3" style={cardStyle}>
          <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#0EA5E9' }} />
          <p className="text-sm" style={{ color: textMuted }}>Yükleniyor...</p>
        </div>
      ) : (
        <>
          {/* ── PERSONEL DETAY TAB ── */}
          {activeTab === 'personel_detay' && (
            <div className="space-y-4">
              {/* Özet KPI'lar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Toplam Ziyaret', value: ziyaretler.length, icon: 'ri-map-pin-user-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.2)' },
                  { label: 'Aktif Personel', value: new Set(ziyaretler.map(z => z.uzman_user_id)).size, icon: 'ri-user-star-line', color: '#22C55E', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' },
                  { label: 'GPS İhlali', value: ihlaller.length, icon: 'ri-map-pin-2-line', color: ihlaller.length > 0 ? '#EF4444' : '#22C55E', bg: ihlaller.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: ihlaller.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)' },
                  { label: 'Firma Ziyaret', value: new Set(ziyaretler.map(z => z.firma_org_id)).size, icon: 'ri-building-2-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
                ].map(kpi => (
                  <div key={kpi.label} className="rounded-2xl p-4" style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
                    <div className="w-8 h-8 flex items-center justify-center rounded-xl mb-3"
                      style={{ background: `${kpi.color}20`, border: `1px solid ${kpi.border}` }}>
                      <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
                    </div>
                    <p className="text-2xl font-black leading-none" style={{ color: textPrimary }}>{kpi.value}</p>
                    <p className="text-[10px] mt-1" style={{ color: textMuted }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* Personel Tablo */}
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="px-5 py-3.5 flex items-center justify-between"
                  style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-item)' }}>
                  <p className="text-xs font-bold" style={{ color: textPrimary }}>Personel Ziyaret Detay</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
                      Son 90 günlük ziyaret aktivitesi · Detay için satıra tıklayın
                    </span>
                    {(['Bu Ay', 'Toplam', 'İhlal', 'Süre'] as const).map(t => (
                      <button key={t} className="text-[10px] px-2 py-0.5 rounded-lg cursor-pointer"
                        style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {personelIstatistik.length === 0 ? (
                  <div className="py-12 text-center">
                    <i className="ri-user-star-line text-3xl" style={{ color: textMuted }} />
                    <p className="text-sm mt-3" style={{ color: textMuted }}>Bu dönemde ziyaret kaydı yok</p>
                  </div>
                ) : (
                  <>
                    {/* Başlıklar */}
                    <div className="hidden lg:grid px-5 py-2.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                        borderBottom: '1px solid var(--border-subtle)',
                        color: textMuted,
                        background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,252,0.8)',
                      }}>
                      <div>Personel</div>
                      <div>Ziyaret</div>
                      <div>Toplam Süre</div>
                      <div>Firma Sayısı</div>
                      <div>GPS İhlal</div>
                      <div>Ort. Süre</div>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                      {personelIstatistik.map(p => {
                        const ortSure = p.ziyaretSayisi > 0 ? Math.round(p.toplamDakika / p.ziyaretSayisi) : 0;
                        return (
                          <div key={p.user_id}
                            className="hidden lg:grid px-5 py-3 items-center cursor-pointer transition-all"
                            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-row-hover)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                                {(p.ad ?? '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-semibold" style={{ color: textPrimary }}>{p.ad}</p>
                                <p className="text-[10px]" style={{ color: textMuted }}>{p.email}</p>
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                                style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
                                {p.ziyaretSayisi}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs font-semibold" style={{ color: textPrimary }}>
                                {p.toplamDakika >= 60 ? `${Math.floor(p.toplamDakika / 60)}s ${p.toplamDakika % 60}d` : `${p.toplamDakika}d`}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs" style={{ color: textMuted }}>{p.firmaSet.size}</span>
                            </div>
                            <div>
                              {p.ihlalSayisi > 0 ? (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                                  style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                  {p.ihlalSayisi} ihlal
                                </span>
                              ) : (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                                  style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                                  Temiz
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-xs" style={{ color: textMuted }}>
                                {ortSure >= 60 ? `${Math.floor(ortSure / 60)}s ${ortSure % 60}d` : `${ortSure}d`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* GPS İhlalleri */}
              {ihlaller.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ ...cardStyle, border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="flex items-center gap-3 px-5 py-3.5"
                    style={{ borderBottom: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.04)' }}>
                    <i className="ri-error-warning-line text-sm" style={{ color: '#EF4444' }} />
                    <p className="text-xs font-bold" style={{ color: '#EF4444' }}>GPS Konum İhlalleri — {ihlaller.length} kayıt</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(239,68,68,0.1)' }}>
                    {ihlaller.map(z => (
                      <div key={z.id} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                          {(z.uzman_ad ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold" style={{ color: textPrimary }}>{z.uzman_ad ?? z.uzman_email ?? '—'}</p>
                          <p className="text-[10px]" style={{ color: textMuted }}>{z.firma_ad ?? '—'} · {fmtTime(z.giris_saati)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {z.check_in_distance_m != null && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                              {z.check_in_distance_m >= 1000
                                ? `${(z.check_in_distance_m / 1000).toFixed(1)} km uzakta`
                                : `${z.check_in_distance_m} m uzakta`}
                            </span>
                          )}
                          <p className="text-[9px] mt-1" style={{ color: textMuted }}>
                            {new Date(z.giris_saati).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ZİYARET PLANLAMA TAB ── */}
          {activeTab === 'ziyaret_planlama' && (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-item)' }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: textPrimary }}>Ziyaret Planlama</p>
                    <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
                      Firmalar için haftalık ziyaret programı · Personele otomatik bildirim
                    </p>
                  </div>
                  <button
                    onClick={() => { resetPlanForm(); setShowPlanModal(true); }}
                    className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                    <i className="ri-add-line" />Plan Ekle
                  </button>
                </div>

                {/* Bugünkü planlar */}
                {bugunPlanlar.length > 0 && (
                  <div className="px-5 py-3"
                    style={{ background: 'rgba(34,197,94,0.04)', borderBottom: '1px solid rgba(34,197,94,0.15)' }}>
                    <p className="text-[11px] font-bold flex items-center gap-2 mb-2" style={{ color: '#16A34A' }}>
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                      Bugün {bugunPlanlar.length} firmada ziyaret planlanmış
                    </p>
                    <div className="space-y-1.5">
                      {bugunPlanlar.map(plan => {
                        const tamamlandi = bugunZiyaretFirmaIds.has(plan.firma_org_id);
                        const uzmanAd = plan.hedef_uzman_user_ids?.length
                          ? uzmanlar.find(u => u.user_id === plan.hedef_uzman_user_ids![0])?.display_name ?? '—'
                          : 'Tüm uzmanlar';
                        return (
                          <div key={plan.id} className="flex items-center gap-3">
                            <p className="text-xs font-semibold" style={{ color: textPrimary }}>
                              {plan.firma_ad ?? '—'}
                            </p>
                            <span className="text-[10px]" style={{ color: textMuted }}>— {uzmanAd}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ml-auto ${tamamlandi ? '' : ''}`}
                              style={tamamlandi
                                ? { background: 'rgba(34,197,94,0.15)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.3)' }
                                : { background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                              {tamamlandi ? 'Tamamlandı' : 'Bugün planlandı'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Plan listesi */}
                {planlar.length === 0 ? (
                  <div className="py-12 text-center">
                    <i className="ri-calendar-schedule-line text-3xl" style={{ color: textMuted }} />
                    <p className="text-sm mt-3" style={{ color: textMuted }}>Henüz plan oluşturulmadı</p>
                    <button
                      onClick={() => { resetPlanForm(); setShowPlanModal(true); }}
                      className="whitespace-nowrap mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                      <i className="ri-add-line" />İlk Planı Oluştur
                    </button>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {planlar.map(plan => {
                      const tamamlandi = bugunZiyaretFirmaIds.has(plan.firma_org_id);
                      const bugunde = (plan.gunler ?? []).some(g => {
                        if (typeof g !== 'string') return false;
                        try { return g.toLowerCase() === TODAY_DAY_EN || g === TODAY_DAY_TR; } catch { return false; }
                      });
                      return (
                        <div key={plan.id} className="flex items-start gap-4 px-5 py-4">
                          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                            style={{ background: bugunde ? 'rgba(34,197,94,0.1)' : 'rgba(14,165,233,0.08)', border: `1px solid ${bugunde ? 'rgba(34,197,94,0.25)' : 'rgba(14,165,233,0.15)'}` }}>
                            <i className="ri-calendar-check-line text-sm" style={{ color: bugunde ? '#22C55E' : '#0EA5E9' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold" style={{ color: textPrimary }}>{plan.firma_ad ?? '—'}</p>
                              {bugunde && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={tamamlandi
                                    ? { background: 'rgba(34,197,94,0.15)', color: '#16A34A' }
                                    : { background: 'rgba(14,165,233,0.12)', color: '#0EA5E9' }}>
                                  {tamamlandi ? '✓ Tamamlandı' : 'Bugün planlandı'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {(plan.gunler ?? []).filter(g => typeof g === 'string').map(g => {
                                const isToday = g === TODAY_DAY_TR || (typeof g === 'string' && g.toLowerCase() === TODAY_DAY_EN);
                                return (
                                  <span key={g} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                                    style={{
                                      background: isToday ? 'rgba(34,197,94,0.12)' : 'rgba(14,165,233,0.08)',
                                      color: isToday ? '#16A34A' : '#0284C7',
                                    }}>
                                    {GUN_LABELS[g] ?? g}
                                  </span>
                                );
                              })}
                            </div>
                            {plan.hedef_uzman_user_ids && plan.hedef_uzman_user_ids.length > 0 && (
                              <p className="text-[10px] mt-1" style={{ color: textMuted }}>
                                {plan.hedef_uzman_user_ids
                                  .map(id => uzmanlar.find(u => u.user_id === id)?.display_name ?? id)
                                  .join(', ')}
                              </p>
                            )}
                            {plan.notlar && (
                              <p className="text-[10px] mt-1 italic" style={{ color: textMuted }}>{plan.notlar}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => handlePlanEdit(plan)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; }}>
                              <i className="ri-edit-line text-xs" />
                            </button>
                            <button onClick={() => handlePlanSil(plan.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; }}>
                              <i className="ri-delete-bin-line text-xs" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── HARİTA TAB ── */}
          {activeTab === 'harita' && (
            <div className="space-y-4">
              {/* GPS lokasyonları olan ziyaretler */}
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="px-5 py-3.5 flex items-center justify-between"
                  style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-item)' }}>
                  <p className="text-xs font-bold" style={{ color: textPrimary }}>Saha Konumları</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
                    {ziyaretler.filter(z => z.check_in_lat).length} konumlu ziyaret
                  </span>
                </div>

                {ziyaretler.filter(z => z.check_in_lat && z.check_in_lng).length === 0 ? (
                  <div className="py-14 text-center">
                    <i className="ri-map-pin-2-line text-3xl" style={{ color: textMuted }} />
                    <p className="text-sm mt-3" style={{ color: textMuted }}>Bu dönemde GPS konumlu ziyaret yok</p>
                  </div>
                ) : (
                  <>
                    {/* Google Maps iframe — merkezi bul */}
                    {(() => {
                      const withCoords = ziyaretler.filter(z => z.check_in_lat && z.check_in_lng);
                      const avgLat = withCoords.reduce((s, z) => s + (z.check_in_lat ?? 0), 0) / withCoords.length;
                      const avgLng = withCoords.reduce((s, z) => s + (z.check_in_lng ?? 0), 0) / withCoords.length;
                      return (
                        <div className="p-4">
                          <iframe
                            title="Saha Konumları Haritası"
                            className="w-full rounded-xl"
                            style={{ height: '380px', border: '1px solid var(--border-subtle)' }}
                            src={`https://www.google.com/maps?q=${avgLat},${avgLng}&z=12&output=embed`}
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                      );
                    })()}

                    {/* Konum listesi */}
                    <div className="divide-y px-1" style={{ borderColor: 'var(--border-subtle)' }}>
                      {ziyaretler
                        .filter(z => z.check_in_lat && z.check_in_lng)
                        .slice(0, 10)
                        .map(z => (
                          <div key={z.id} className="flex items-center gap-4 px-4 py-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{
                                background: z.gps_status === 'too_far'
                                  ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                                  : 'linear-gradient(135deg, #22C55E, #16A34A)',
                              }}>
                              <i className="ri-map-pin-fill text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: textPrimary }}>{z.uzman_ad ?? z.uzman_email ?? '—'}</p>
                              <p className="text-[10px]" style={{ color: textMuted }}>{z.firma_ad ?? '—'} · {fmtTime(z.giris_saati)}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {z.check_in_distance_m != null && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg"
                                  style={{
                                    background: z.gps_status === 'too_far' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                    color: z.gps_status === 'too_far' ? '#EF4444' : '#22C55E',
                                  }}>
                                  {z.check_in_distance_m >= 1000
                                    ? `${(z.check_in_distance_m / 1000).toFixed(1)} km`
                                    : `${z.check_in_distance_m} m`}
                                </span>
                              )}
                              <button
                                onClick={() => window.open(`https://www.google.com/maps?q=${z.check_in_lat},${z.check_in_lng}`, '_blank')}
                                className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                                style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; }}>
                                <i className="ri-external-link-line text-xs" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── TAKVİM TAB ── */}
          {activeTab === 'takvim' && (
            <ZiyaretTakvimiMini
              orgId={org?.id ?? ''}
              planlar={planlar}
              isDark={isDark}
              uzmanlar={uzmanlar}
            />
          )}
        </>
      )}

      {/* ── PLAN MODAL — createPortal ile body'ye render edilir ── */}
      {showPlanModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowPlanModal(false); resetPlanForm(); } }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <p className="text-sm font-bold" style={{ color: textPrimary }}>
                  {editingPlanId ? 'Planı Düzenle' : 'Yeni Ziyaret Planı'}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>
                  Firmalar için haftalık ziyaret programı oluştur
                </p>
              </div>
              <button onClick={() => { setShowPlanModal(false); resetPlanForm(); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Firma */}
              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: textMuted }}>
                  Firma <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={planFirmaId}
                  onChange={e => setPlanFirmaId(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl outline-none cursor-pointer"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary }}>
                  <option value="">Firma seçin...</option>
                  {firmalar.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Günler */}
              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: textMuted }}>
                  Ziyaret Günleri <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GUNLER.map(g => {
                    const secili = planGunler.includes(g);
                    return (
                      <button key={g}
                        onClick={() => setPlanGunler(prev => secili ? prev.filter(x => x !== g) : [...prev, g])}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                        style={{
                          background: secili ? 'rgba(14,165,233,0.15)' : 'var(--bg-item)',
                          border: secili ? '1px solid rgba(14,165,233,0.35)' : '1px solid var(--border-subtle)',
                          color: secili ? '#0EA5E9' : textMuted,
                        }}>
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Uzmanlar */}
              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: textMuted }}>
                  Personel (isteğe bağlı — boş bırakılırsa hepsine)
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {uzmanlar.map(u => {
                    const secili = planUzmanIds.includes(u.user_id);
                    return (
                      <button key={u.user_id}
                        onClick={() => setPlanUzmanIds(prev => secili ? prev.filter(x => x !== u.user_id) : [...prev, u.user_id])}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          background: secili ? 'rgba(14,165,233,0.08)' : 'var(--bg-item)',
                          border: secili ? '1px solid rgba(14,165,233,0.25)' : '1px solid var(--border-subtle)',
                        }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={secili
                            ? { background: '#0EA5E9' }
                            : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                          {secili && <i className="ri-check-line text-white text-[10px]" />}
                        </div>
                        <p className="text-xs font-medium" style={{ color: textPrimary }}>{u.display_name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: textMuted }}>Notlar</label>
                <textarea
                  value={planNotlar}
                  onChange={e => setPlanNotlar(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="Ziyaret notu..."
                  className="w-full text-xs px-3 py-2.5 rounded-xl outline-none resize-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => { setShowPlanModal(false); resetPlanForm(); }}
                className="whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}>
                İptal
              </button>
              <button onClick={handlePlanKaydet} disabled={planLoading || !planFirmaId || planGunler.length === 0}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                  opacity: (planLoading || !planFirmaId || planGunler.length === 0) ? 0.6 : 1,
                }}>
                {planLoading ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-check-line" />Kaydet</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {void todayStr}
    </div>
  );
}

// ── Mini Takvim ──────────────────────────────────────────────────────────────
function ZiyaretTakvimiMini({
  orgId,
  planlar,
  isDark,
  uzmanlar,
}: {
  orgId: string;
  planlar: ZiyaretPlani[];
  isDark: boolean;
  uzmanlar: Uzman[];
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [loading, setLoading] = useState(true);
  const [secilenGun, setSecilenGun] = useState<string | null>(null);

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    supabase
      .from('osgb_ziyaretler')
      .select('id,firma_org_id,firma_ad,uzman_ad,uzman_user_id,giris_saati,cikis_saati,durum,sure_dakika,gps_status,check_in_distance_m,qr_ile_giris')
      .eq('osgb_org_id', orgId)
      .gte('giris_saati', start.toISOString())
      .lte('giris_saati', end.toISOString())
      .order('giris_saati', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        setZiyaretler((data ?? []) as Ziyaret[]);
        setLoading(false);
      });
  }, [orgId, currentDate]);

  // Gün bazında ziyaret map
  const gunMap = useMemo(() => {
    const map = new Map<string, Ziyaret[]>();
    ziyaretler.forEach(z => {
      const key = z.giris_saati.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(z);
    });
    return map;
  }, [ziyaretler]);

  // Plan bazında gün seti
  const planGunSet = useMemo(() => {
    const set = new Set<string>();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const TR_TO_DOW: Record<string, number> = {
      'Pazartesi': 1, 'Salı': 2, 'Çarşamba': 3, 'Perşembe': 4,
      'Cuma': 5, 'Cumartesi': 6, 'Pazar': 0,
    };
    const EN_TO_DOW: Record<string, number> = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0,
    };

    planlar.forEach(p => {
      (p.gunler ?? []).forEach(g => {
        if (typeof g !== 'string') return;
        let dow: number | undefined;
        try {
          dow = TR_TO_DOW[g] ?? EN_TO_DOW[g.toLowerCase()];
        } catch {
          return;
        }
        if (dow === undefined) return;
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d);
          if (date.getDay() === dow) {
            set.add(date.toISOString().split('T')[0]);
          }
        }
      });
    });
    return set;
  }, [planlar, currentDate]);

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentDate]);

  const today = new Date().toISOString().split('T')[0];
  const secilenGunZiyaretler = secilenGun ? (gunMap.get(secilenGun) ?? []) : [];

  const DOW_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
  };

  return (
    <div className="space-y-4">
      {/* Navigasyon */}
      <div className="flex items-center justify-between px-1">
        <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}>
          <i className="ri-arrow-left-s-line text-sm" />
        </button>
        <h2 className="text-sm font-bold capitalize" style={{ color: textPrimary }}>
          {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}>
          <i className="ri-arrow-right-s-line text-sm" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap px-1">
        {[
          { color: '#0EA5E9', bg: 'rgba(14,165,233,0.15)', label: 'Ziyaret yapıldı' },
          { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Planlandı' },
          { color: '#22C55E', bg: 'rgba(34,197,94,0.15)', label: 'Plan + Ziyaret (Tamamlandı)' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: item.bg, border: `1px solid ${item.color}40` }} />
            <span className="text-[10px]" style={{ color: textMuted }}>{item.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl py-12 flex items-center justify-center gap-3" style={cardStyle}>
          <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#0EA5E9' }} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          {/* Gün başlıkları */}
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {DOW_LABELS.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider"
                style={{ color: textMuted, borderRight: '1px solid var(--border-subtle)' }}>
                {d}
              </div>
            ))}
          </div>
          {/* Günler */}
          <div className="grid grid-cols-7">
            {monthDays.map((day, idx) => {
              const key = day ? day.toISOString().split('T')[0] : `empty-${idx}`;
              const dayZiyaretler = day ? (gunMap.get(key) ?? []) : [];
              const isPlanned = day ? planGunSet.has(key) : false;
              const hasZiyaret = dayZiyaretler.length > 0;
              const isTdy = day ? key === today : false;
              const isCurMonth = day ? day.getMonth() === currentDate.getMonth() : false;

              let bgColor = 'transparent';
              let borderColor = 'var(--border-subtle)';
              if (isPlanned && hasZiyaret) {
                bgColor = 'rgba(34,197,94,0.08)';
                borderColor = 'rgba(34,197,94,0.2)';
              } else if (hasZiyaret) {
                bgColor = 'rgba(14,165,233,0.05)';
              } else if (isPlanned) {
                bgColor = isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)';
              }

              return (
                <div key={key}
                  onClick={() => { if (day && dayZiyaretler.length > 0) setSecilenGun(key); }}
                  className="min-h-[80px] p-1.5 transition-all"
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    borderRight: borderColor,
                    background: isTdy ? 'rgba(14,165,233,0.06)' : !isCurMonth ? 'var(--bg-item)' : bgColor,
                    cursor: dayZiyaretler.length > 0 ? 'pointer' : 'default',
                    opacity: !day ? 0.3 : 1,
                  }}
                  onMouseEnter={e => { if (dayZiyaretler.length > 0) (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isTdy ? 'rgba(14,165,233,0.06)' : !isCurMonth ? 'var(--bg-item)' : bgColor; }}>
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold ${isTdy ? 'text-white' : ''}`}
                          style={{ background: isTdy ? '#0EA5E9' : 'transparent', color: isTdy ? '#fff' : isCurMonth ? textPrimary : textMuted }}>
                          {day.getDate()}
                        </div>
                        {isPlanned && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: hasZiyaret ? '#22C55E' : '#F59E0B' }} />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayZiyaretler.slice(0, 2).map(z => (
                          <div key={z.id} className="rounded px-1 py-0.5 text-[9px] font-semibold truncate"
                            style={{ background: 'rgba(14,165,233,0.12)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.2)' }}>
                            {(z.uzman_ad ?? z.uzman_email ?? 'Uzman').split(' ')[0]}
                          </div>
                        ))}
                        {dayZiyaretler.length > 2 && (
                          <div className="text-[9px] font-bold px-1"
                            style={{ color: '#0EA5E9' }}>+{dayZiyaretler.length - 2}</div>
                        )}
                        {isPlanned && !hasZiyaret && (
                          <div className="rounded px-1 py-0.5 text-[9px] font-semibold"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706' }}>
                            Planlı
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seçilen gün detay — createPortal ile body'ye render edilir */}
      {secilenGun && secilenGunZiyaretler.length > 0 && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSecilenGun(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <p className="text-sm font-bold" style={{ color: textPrimary }}>
                  {new Date(secilenGun).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-[10px]" style={{ color: textMuted }}>{secilenGunZiyaretler.length} ziyaret</p>
              </div>
              <button onClick={() => setSecilenGun(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {secilenGunZiyaretler.map(z => (
                <div key={z.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                    {(z.uzman_ad ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: textPrimary }}>{z.uzman_ad ?? z.uzman_email ?? '—'}</p>
                    <p className="text-[10px]" style={{ color: textMuted }}>
                      {z.firma_ad ?? '—'} · {fmtTime(z.giris_saati)}{z.cikis_saati ? ` – ${fmtTime(z.cikis_saati)}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={z.durum === 'aktif'
                        ? { background: 'rgba(34,197,94,0.12)', color: '#22C55E' }
                        : { background: 'rgba(148,163,184,0.1)', color: '#94A3B8' }}>
                      {z.durum === 'aktif' ? 'Aktif' : 'Tamamlandı'}
                    </span>
                    {z.gps_status === 'too_far' && (
                      <p className="text-[9px] mt-0.5" style={{ color: '#EF4444' }}>
                        <i className="ri-error-warning-line mr-0.5" />GPS İhlal
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {void formatSure} {void uzmanlar}
    </div>
  );
}
