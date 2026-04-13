import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import HekimMuayeneModal from './HekimMuayeneModal';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface MuayeneRow {
  id: string;
  personelAd: string;
  personelId: string;
  firmaAd: string;
  firmaId: string;
  muayeneTarihi: string;
  sonrakiTarih: string;
  sonuc: string;
  hastane: string;
  doktor: string;
  notlar: string;
  // EK-2 alanları
  ek2: boolean;
  kronikHastaliklar: string;
  ilacKullanim: string;
  ameliyatGecmisi: string;
  tansiyon: string;
  nabiz: string;
  gorme: string;
  isitme: string;
  aciklama: string;
}

interface HekimSaglikTabProps {
  atanmisFirmaIds: string[];
  isDark: boolean;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  hekimOrgId?: string;
}

type FilterKey = 'tumu' | 'uygun' | 'kisitli' | 'uygun_degil';

// EK-2 sonuç değerlerini görünen etikete çevir
const sonucLabel = (sonuc: string) => {
  if (sonuc === 'uygun') return 'Çalışabilir';
  if (sonuc === 'kisitli') return 'Kısıtlı Çalışabilir';
  if (sonuc === 'uygun_degil') return 'Çalışamaz';
  // Eski değerler için geriye dönük uyumluluk
  return sonuc;
};

export default function HekimSaglikTab({ atanmisFirmaIds, isDark, addToast, hekimOrgId }: HekimSaglikTabProps) {
  const [muayeneler, setMuayeneler] = useState<MuayeneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('tumu');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<null | {
    id: string; personelId: string; firmaId: string;
    muayeneTarihi: string; sonrakiTarih: string;
    sonuc: string; hastane: string; doktor: string; notlar: string;
    kronikHastaliklar?: string; ilacKullanim?: string; ameliyatGecmisi?: string;
    tansiyon?: string; nabiz?: string; gorme?: string; isitme?: string; aciklama?: string;
  }>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const tableBg = isDark ? 'rgba(20,30,50,0.98)' : '#ffffff';
  const tableHeadBg = isDark ? 'rgba(15,23,42,0.8)' : '#f8fafc';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  const loadMuayeneler = useCallback(async () => {
    if (atanmisFirmaIds.length === 0) { setMuayeneler([]); setLoading(false); return; }
    setLoading(true);
    try {
      const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
      if (safeIds.length === 0) { setMuayeneler([]); setLoading(false); return; }

      const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', safeIds);
      const firmaAdMap: Record<string, string> = {};
      (orgs ?? []).forEach(o => { firmaAdMap[o.id] = o.name; });

      const allMuayeneler: MuayeneRow[] = [];
      await Promise.all(safeIds.map(async (firmaId) => {
        const { data: personelRows } = await supabase.from('personeller').select('id, data').eq('organization_id', firmaId).is('deleted_at', null);
        const personelAdMap: Record<string, string> = {};
        (personelRows ?? []).forEach(r => {
          const d = r.data as Record<string, unknown>;
          personelAdMap[r.id] = (d.adSoyad as string) ?? 'Bilinmiyor';
        });
        const { data: mRows, error } = await supabase
          .from('muayeneler').select('id, data')
          .eq('organization_id', firmaId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[HekimSaglikTab] muayeneler load error:', error);
        }

        (mRows ?? []).forEach(m => {
          const d = m.data as Record<string, unknown>;
          allMuayeneler.push({
            id: m.id,
            personelId: (d.personelId as string) ?? '',
            personelAd: personelAdMap[(d.personelId as string) ?? ''] ?? 'Bilinmiyor',
            firmaAd: firmaAdMap[firmaId] ?? firmaId,
            firmaId,
            muayeneTarihi: (d.muayeneTarihi as string) ?? '',
            sonrakiTarih: (d.sonrakiTarih as string) ?? '',
            sonuc: (d.sonuc as string) ?? '',
            hastane: (d.hastane as string) ?? '',
            doktor: (d.doktor as string) ?? '',
            notlar: (d.notlar as string) ?? '',
            ek2: !!(d.ek2),
            kronikHastaliklar: (d.kronikHastaliklar as string) ?? '',
            ilacKullanim: (d.ilacKullanim as string) ?? '',
            ameliyatGecmisi: (d.ameliyatGecmisi as string) ?? '',
            tansiyon: (d.tansiyon as string) ?? '',
            nabiz: (d.nabiz as string) ?? '',
            gorme: (d.gorme as string) ?? '',
            isitme: (d.isitme as string) ?? '',
            aciklama: (d.aciklama as string) ?? '',
          });
        });
      }));
      allMuayeneler.sort((a, b) => new Date(b.muayeneTarihi).getTime() - new Date(a.muayeneTarihi).getTime());
      setMuayeneler(allMuayeneler);
    } catch (err) { console.error('[HekimSaglikTab] load error:', err); }
    finally { setLoading(false); }
  }, [atanmisFirmaIds]);

  useEffect(() => { loadMuayeneler(); }, [loadMuayeneler]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('muayeneler').update({ deleted_at: new Date().toISOString() }).eq('id', deleteId);
    setDeleteId(null);
    setDeleteConfirm(false);
    loadMuayeneler();
  };

  // Filtreleme — eski ve yeni sonuç değerlerini destekle
  const filtered = muayeneler.filter(m => {
    const matchSearch = m.personelAd.toLowerCase().includes(search.toLowerCase())
      || m.firmaAd.toLowerCase().includes(search.toLowerCase())
      || m.hastane.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    if (filter !== 'tumu') {
      matchFilter = m.sonuc === filter
        || (filter === 'uygun' && m.sonuc === 'Çalışabilir')
        || (filter === 'kisitli' && m.sonuc === 'Kısıtlı Çalışabilir')
        || (filter === 'uygun_degil' && m.sonuc === 'Çalışamaz');
    }
    return matchSearch && matchFilter;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDaysUntil = (dateStr: string): number | null => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const getSonucStyle = (sonuc: string) => {
    if (sonuc === 'uygun' || sonuc === 'Çalışabilir')
      return { bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.25)' };
    if (sonuc === 'kisitli' || sonuc === 'Kısıtlı Çalışabilir')
      return { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' };
    return { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.25)' };
  };

  const totalMuayene = muayeneler.length;
  const calisabilir = muayeneler.filter(m => m.sonuc === 'uygun' || m.sonuc === 'Çalışabilir').length;
  const kisitli = muayeneler.filter(m => m.sonuc === 'kisitli' || m.sonuc === 'Kısıtlı Çalışabilir').length;
  const yaklasiyor = muayeneler.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d !== null && d >= 0 && d <= 30; }).length;

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'tumu',        label: 'Tümü' },
    { key: 'uygun',       label: 'Çalışabilir' },
    { key: 'kisitli',     label: 'Kısıtlı' },
    { key: 'uygun_degil', label: 'Çalışamaz' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>EK-2 Sağlık Takibi</h2>
          <p className="text-xs mt-0.5" style={{ color: textSecondary }}>Periyodik muayene kayıtları — İş Sağlığı ve Güvenliği</p>
        </div>
        <button
          onClick={() => { setEditData(null); setShowModal(true); }}
          className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer text-white transition-all"
          style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          <i className="ri-add-line" />
          EK-2 Muayene Ekle
        </button>
      </div>

      {/* KPI */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Toplam',         value: totalMuayene, color: ACCENT,    bg: 'rgba(14,165,233,0.08)', icon: 'ri-stethoscope-line' },
            { label: 'Çalışabilir',    value: calisabilir,  color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: 'ri-checkbox-circle-line' },
            { label: 'Kısıtlı',        value: kisitli,      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: 'ri-alert-line' },
            { label: 'Yaklaşan (30g)', value: yaklasiyor,   color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  icon: 'ri-calendar-event-line' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: kpi.bg, border: `1px solid ${kpi.color}22` }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: `${kpi.color}18` }}>
                <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xl font-extrabold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: textSecondary }}>{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtre + Arama */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textSecondary }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Personel, firma ara..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', border: `1.5px solid ${borderColor}`, color: textPrimary }}
            onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
            onBlur={e => { e.currentTarget.style.borderColor = borderColor; }} />
        </div>
        <div className="flex items-center gap-1">
          {filterOptions.map(opt => (
            <button key={opt.key} onClick={() => setFilter(opt.key)}
              className="whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
              style={{
                background: filter === opt.key ? 'rgba(14,165,233,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
                color: filter === opt.key ? ACCENT : textSecondary,
                border: `1px solid ${filter === opt.key ? 'rgba(14,165,233,0.3)' : borderColor}`,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          {filtered.length} kayıt
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl p-10 flex items-center justify-center gap-2"
          style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <i className="ri-loader-4-line animate-spin text-lg" style={{ color: ACCENT }} />
          <span className="text-sm" style={{ color: textSecondary }}>Yükleniyor...</span>
        </div>
      )}

      {/* Boş state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl p-12 flex flex-col items-center gap-4 text-center"
          style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-heart-pulse-line text-2xl" style={{ color: ACCENT }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Kayıt bulunamadı</p>
            <p className="text-xs" style={{ color: textSecondary }}>{search ? 'Farklı bir arama deneyin' : 'Henüz EK-2 muayene kaydı yok.'}</p>
          </div>
        </div>
      )}

      {/* Tablo */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <div className="overflow-x-auto">
            <div className="grid gap-0 min-w-[700px]"
              style={{ gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr 1fr 100px', background: tableHeadBg, borderBottom: `1px solid ${borderColor}` }}>
              {['PERSONEL', 'FİRMA', 'MUAYENE TARİHİ', 'SONRAKİ TARİH', 'SONUÇ', 'İŞLEM'].map(h => (
                <div key={h} className="px-4 py-2.5">
                  <span className="text-[10px] font-bold tracking-wider" style={{ color: textSecondary }}>{h}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 p-2 min-w-[700px]">
              {filtered.map((m) => {
                const sonucStyle = getSonucStyle(m.sonuc);
                const daysUntil = getDaysUntil(m.sonrakiTarih);
                const isYaklasiyor = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;
                const isGecmis = daysUntil !== null && daysUntil < 0;
                const isExpanded = expandedId === m.id;

                return (
                  <div key={m.id} className="rounded-xl overflow-hidden transition-all duration-200"
                    style={{
                      border: isExpanded ? 'rgba(14,165,233,0.3) 1px solid' : `1px solid ${borderColor}`,
                      background: isExpanded
                        ? (isDark ? 'rgba(14,165,233,0.07)' : 'rgba(14,165,233,0.04)')
                        : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)'),
                    }}>
                    <div
                      className="grid grid-cols-[2fr_1.2fr_1.2fr_1.2fr_1fr_100px] items-center cursor-pointer transition-all duration-200"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.04)'; }}
                      onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    >
                      {/* Personel */}
                      <div className="px-4 py-3 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}>
                          {m.personelAd.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold truncate block" style={{ color: textPrimary }}>{m.personelAd}</span>
                          {m.ek2 && (
                            <span className="text-[9px] font-bold" style={{ color: ACCENT }}>EK-2</span>
                          )}
                        </div>
                      </div>

                      {/* Firma */}
                      <div className="px-4 py-3">
                        <span className="text-xs truncate" style={{ color: ACCENT, fontWeight: 600 }}>{m.firmaAd}</span>
                      </div>

                      {/* Muayene Tarihi */}
                      <div className="px-4 py-3">
                        <span className="text-xs" style={{ color: textSecondary }}>{formatDate(m.muayeneTarihi)}</span>
                      </div>

                      {/* Sonraki Tarih */}
                      <div className="px-4 py-3">
                        {m.sonrakiTarih ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={isGecmis
                              ? { background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }
                              : isYaklasiyor
                              ? { background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }
                              : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }
                            }>
                            {isGecmis ? <><i className="ri-error-warning-line text-[9px]" /> Geçti</> : formatDate(m.sonrakiTarih)}
                          </span>
                        ) : <span className="text-xs" style={{ color: textSecondary }}>—</span>}
                      </div>

                      {/* Sonuç */}
                      <div className="px-4 py-3">
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: sonucStyle.bg, color: sonucStyle.color, border: `1px solid ${sonucStyle.border}` }}>
                          {sonucLabel(m.sonuc) || '—'}
                        </span>
                      </div>

                      {/* İşlem */}
                      <div className="px-4 py-3 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setExpandedId(isExpanded ? null : m.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                          style={{ background: isExpanded ? 'rgba(14,165,233,0.1)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'), border: `1px solid ${isExpanded ? 'rgba(14,165,233,0.3)' : borderColor}` }}>
                          <i className={`${isExpanded ? 'ri-arrow-up-s-line' : 'ri-eye-line'} text-xs`} style={{ color: isExpanded ? ACCENT : textSecondary }} />
                        </button>
                        <button
                          onClick={() => {
                            setEditData({
                              id: m.id, personelId: m.personelId, firmaId: m.firmaId,
                              muayeneTarihi: m.muayeneTarihi, sonrakiTarih: m.sonrakiTarih,
                              sonuc: m.sonuc, hastane: m.hastane, doktor: m.doktor, notlar: m.notlar,
                              kronikHastaliklar: m.kronikHastaliklar, ilacKullanim: m.ilacKullanim,
                              ameliyatGecmisi: m.ameliyatGecmisi, tansiyon: m.tansiyon,
                              nabiz: m.nabiz, gorme: m.gorme, isitme: m.isitme, aciklama: m.aciklama,
                            });
                            setShowModal(true);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.3)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = borderColor; }}>
                          <i className="ri-edit-line text-xs" style={{ color: textSecondary }} />
                        </button>
                        <button
                          onClick={() => { setDeleteId(m.id); setDeleteConfirm(true); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = borderColor; }}>
                          <i className="ri-delete-bin-line text-xs" style={{ color: textSecondary }} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-5 py-4 space-y-3"
                        style={{ background: isDark ? 'rgba(14,165,233,0.04)' : 'rgba(14,165,233,0.02)', borderTop: '1px solid rgba(14,165,233,0.12)' }}>

                        {/* Sağlık beyanı */}
                        {(m.kronikHastaliklar || m.ilacKullanim || m.ameliyatGecmisi) && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: ACCENT }}>Sağlık Beyanı</p>
                            <div className="flex flex-wrap gap-4">
                              {[
                                { label: 'Kronik Hastalıklar', value: m.kronikHastaliklar, icon: 'ri-heart-pulse-line' },
                                { label: 'İlaç Kullanımı', value: m.ilacKullanim, icon: 'ri-capsule-line' },
                                { label: 'Ameliyat Geçmişi', value: m.ameliyatGecmisi, icon: 'ri-surgical-mask-line' },
                              ].filter(f => f.value).map(f => (
                                <div key={f.label} className="flex items-start gap-2">
                                  <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                                    style={{ background: 'rgba(14,165,233,0.1)' }}>
                                    <i className={`${f.icon} text-[10px]`} style={{ color: ACCENT }} />
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-semibold" style={{ color: textSecondary }}>{f.label}</p>
                                    <p className="text-xs font-medium max-w-[200px]" style={{ color: textPrimary }}>{f.value}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bulgular */}
                        {(m.tansiyon || m.nabiz || m.gorme || m.isitme) && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: textSecondary }}>Bulgular</p>
                            <div className="flex flex-wrap gap-3">
                              {[
                                { label: 'Tansiyon', value: m.tansiyon },
                                { label: 'Nabız', value: m.nabiz },
                                { label: 'Görme', value: m.gorme },
                                { label: 'İşitme', value: m.isitme },
                              ].filter(f => f.value).map(f => (
                                <div key={f.label} className="px-3 py-1.5 rounded-lg"
                                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}>
                                  <p className="text-[9px] font-semibold" style={{ color: textSecondary }}>{f.label}</p>
                                  <p className="text-xs font-bold" style={{ color: textPrimary }}>{f.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hekim + Notlar */}
                        <div className="flex flex-wrap gap-4">
                          {[
                            { label: 'Hastane', value: m.hastane, icon: 'ri-hospital-line' },
                            { label: 'Doktor', value: m.doktor, icon: 'ri-user-heart-line' },
                            { label: 'Karar Notu', value: m.aciklama || m.notlar, icon: 'ri-sticky-note-line' },
                          ].filter(f => f.value).map(f => (
                            <div key={f.label} className="flex items-center gap-2">
                              <div className="w-6 h-6 flex items-center justify-center rounded-lg"
                                style={{ background: 'rgba(14,165,233,0.1)' }}>
                                <i className={`${f.icon} text-[10px]`} style={{ color: ACCENT }} />
                              </div>
                              <div>
                                <p className="text-[9px] font-semibold" style={{ color: textSecondary }}>{f.label}</p>
                                <p className="text-xs font-medium" style={{ color: textPrimary }}>{f.value}</p>
                              </div>
                            </div>
                          ))}
                          {!m.hastane && !m.doktor && !m.aciklama && !m.notlar && !m.kronikHastaliklar && !m.tansiyon && (
                            <p className="text-xs" style={{ color: textSecondary }}>Ek bilgi bulunmuyor.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Muayene Modal */}
      <HekimMuayeneModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditData(null); }}
        onSaved={loadMuayeneler}
        atanmisFirmaIds={atanmisFirmaIds}
        isDark={isDark}
        hekimOrgId={hekimOrgId}
        editData={editData}
        addToast={addToast}
      />

      {/* Silme Onay */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 9999 }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${borderColor}` }}>
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #EF4444, #F43F5E)' }} />
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Muayene kaydını sil?</p>
              <p className="text-xs mb-5" style={{ color: textSecondary }}>Bu kayıt çöp kutusuna taşınacak. Geri alınabilir.</p>
              <div className="flex gap-2">
                <button onClick={() => { setDeleteConfirm(false); setDeleteId(null); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }}>
                  İptal
                </button>
                <button onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer text-white whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
