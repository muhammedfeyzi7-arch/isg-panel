import { useState, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import Human3DModel from './Human3DModel';

const ACCENT = '#0EA5E9';
const HOVER_COLOR = '#F97316';

interface PersonelOption {
  id: string;
  adSoyad: string;
  gorev: string;
  firmaId: string;
}

interface IsKazasiFormData {
  personelId: string;
  firmaId: string;
  kazaTarihi: string;
  kazaSaati: string;
  kazaYeri: string;
  kazaTuru: string;
  kazaAciklamasi: string;
  yaraliVucutBolgeleri: string[];
  yaralanmaTuru: string;
  yaralanmaSiddeti: string;
  isGunuKaybi: number;
  hastaneyeKaldirildi: boolean;
  hastaneAdi: string;
  tanikBilgileri: string;
  onlemler: string;
  durum: string;
}

interface PastKaza {
  id: string;
  kaza_tarihi: string;
  kaza_yeri: string;
  yarali_vucut_bolgeleri: string[];
  yaralanma_turu: string;
  yaralanma_siddeti: string;
  durum: string;
}

interface HekimIsKazasiModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  atanmisFirmaIds: string[];
  isDark: boolean;
  editData?: (IsKazasiFormData & { id: string }) | null;
  preselectedPersonelId?: string | null;
}

const KAZA_TURLERI = ['Düşme', 'Çarpma/Temas', 'Elektrik Çarpması', 'Yanma/Haşlanma', 'Kesik/Yara', 'Kimyasal Temas', 'Kas-İskelet Zorlanması', 'Trafik Kazası', 'Diğer'];
const YARALANMA_TURLERI = ['Kırık', 'Burkulma/Gerilme', 'Kesik/Yara', 'Yanık', 'Ezilme', 'Zehirlenme', 'Çıkık', 'Diğer'];
const SIDDET_OPTIONS = ['Hafif', 'Orta', 'Ağır', 'Çok Ağır'];

const VUCUT_BOLGELERI: { id: string; label: string; icon: string; anatomyNote: string }[] = [
  { id: 'bas',       label: 'Baş',        icon: 'ri-user-line',         anatomyNote: 'Kafa travması, beyin sarsıntısı riski yüksek' },
  { id: 'boyun',     label: 'Boyun',      icon: 'ri-user-3-line',       anatomyNote: 'Omurga hasarı — immobilizasyon gerekebilir' },
  { id: 'sag_omuz',  label: 'Sağ Omuz',  icon: 'ri-body-scan-line',    anatomyNote: 'Rotator cuff, klavikula kırığı değerlendir' },
  { id: 'sol_omuz',  label: 'Sol Omuz',  icon: 'ri-body-scan-line',    anatomyNote: 'Rotator cuff, klavikula kırığı değerlendir' },
  { id: 'gogus',     label: 'Göğüs',     icon: 'ri-heart-pulse-line',  anatomyNote: 'Pnömotoraks, kot kırığı olasılığını göz önünde bulundur' },
  { id: 'sirt',      label: 'Sırt',      icon: 'ri-shield-line',       anatomyNote: 'Vertebra hasarı olasılığını değerlendir' },
  { id: 'sag_kol',   label: 'Sağ Kol',   icon: 'ri-body-scan-line',    anatomyNote: 'Biseps/humerus kırığı, sinir hasarı' },
  { id: 'sol_kol',   label: 'Sol Kol',   icon: 'ri-body-scan-line',    anatomyNote: 'Biseps/humerus kırığı, sinir hasarı' },
  { id: 'sag_el',    label: 'Sağ El',    icon: 'ri-hand-coin-line',    anatomyNote: 'Parmak kırıkları, tendon hasarı' },
  { id: 'sol_el',    label: 'Sol El',    icon: 'ri-hand-coin-line',    anatomyNote: 'Parmak kırıkları, tendon hasarı' },
  { id: 'karin',     label: 'Karın/Bel', icon: 'ri-first-aid-kit-line', anatomyNote: 'İç organ hasarı, lomber vertebra değerlendir' },
  { id: 'sag_kalca', label: 'Sağ Kalça', icon: 'ri-walk-line',         anatomyNote: 'Kalça eklemi, femur boynu kırığı' },
  { id: 'sol_kalca', label: 'Sol Kalça', icon: 'ri-walk-line',         anatomyNote: 'Kalça eklemi, femur boynu kırığı' },
  { id: 'sag_bacak', label: 'Sağ Bacak', icon: 'ri-walk-line',         anatomyNote: 'Tibia/fibula kırığı, menisküs hasarı' },
  { id: 'sol_bacak', label: 'Sol Bacak', icon: 'ri-walk-line',         anatomyNote: 'Tibia/fibula kırığı, menisküs hasarı' },
  { id: 'sag_ayak',  label: 'Sağ Ayak',  icon: 'ri-footprint-line',    anatomyNote: 'Metatars kırığı, ayak bileği burkulmasi' },
  { id: 'sol_ayak',  label: 'Sol Ayak',  icon: 'ri-footprint-line',    anatomyNote: 'Metatars kırığı, ayak bileği burkulmasi' },
];

const BOLGE_RISK: Record<string, { color: string; label: string }> = {
  bas:       { color: '#EF4444', label: 'Kritik' },
  boyun:     { color: '#EF4444', label: 'Kritik' },
  gogus:     { color: '#F59E0B', label: 'Yüksek' },
  sirt:      { color: '#F59E0B', label: 'Yüksek' },
  sag_omuz:  { color: '#F59E0B', label: 'Orta' },
  sol_omuz:  { color: '#F59E0B', label: 'Orta' },
  sag_kol:   { color: ACCENT,   label: 'Düşük' },
  sol_kol:   { color: ACCENT,   label: 'Düşük' },
  karin:     { color: '#F59E0B', label: 'Yüksek' },
  sag_kalca: { color: ACCENT,   label: 'Düşük' },
  sol_kalca: { color: ACCENT,   label: 'Düşük' },
  sag_bacak: { color: ACCENT,   label: 'Düşük' },
  sol_bacak: { color: ACCENT,   label: 'Düşük' },
  sag_el:    { color: ACCENT,   label: 'Düşük' },
  sol_el:    { color: ACCENT,   label: 'Düşük' },
  sag_ayak:  { color: ACCENT,   label: 'Düşük' },
  sol_ayak:  { color: ACCENT,   label: 'Düşük' },
};

const SIDDET_COLORS: Record<string, { color: string; bg: string }> = {
  'Hafif':    { color: ACCENT,    bg: 'rgba(14,165,233,0.12)' },
  'Orta':     { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  'Ağır':     { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  'Çok Ağır': { color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
};

const emptyForm: IsKazasiFormData = {
  personelId: '', firmaId: '', kazaTarihi: '', kazaSaati: '',
  kazaYeri: '', kazaTuru: '', kazaAciklamasi: '',
  yaraliVucutBolgeleri: [], yaralanmaTuru: '', yaralanmaSiddeti: 'Hafif',
  isGunuKaybi: 0, hastaneyeKaldirildi: false, hastaneAdi: '',
  tanikBilgileri: '', onlemler: '', durum: 'Açık',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

export default function HekimIsKazasiModal({
  open, onClose, onSaved, atanmisFirmaIds, isDark, editData, preselectedPersonelId,
}: HekimIsKazasiModalProps) {
  const [form, setForm] = useState<IsKazasiFormData>(emptyForm);
  const [personelOptions, setPersonelOptions] = useState<PersonelOption[]>([]);
  const [firmaAdMap, setFirmaAdMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Geçmiş kazalar
  const [pastKazalar, setPastKazalar] = useState<PastKaza[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  const bg        = isDark ? '#0f172a' : '#f8fafc';
  const panelBg   = isDark ? '#1a2540' : '#ffffff';
  const centerBg  = isDark ? '#0c1628' : '#eef2f7';
  const textP     = isDark ? '#f1f5f9' : '#0f172a';
  const textS     = isDark ? '#94a3b8' : '#64748b';
  const border    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.10)';
  const inputBg   = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';
  const labelC    = isDark ? '#64748b' : '#94a3b8';
  const sectionBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(14,165,233,0.03)';

  // Firma & personel yükle
  useEffect(() => {
    if (!open || atanmisFirmaIds.length === 0) return;
    const load = async () => {
      const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
      const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', safeIds);
      const adMap: Record<string, string> = {};
      (orgs ?? []).forEach(o => { adMap[o.id] = o.name; });
      setFirmaAdMap(adMap);
      const allPersonel: PersonelOption[] = [];
      await Promise.all(safeIds.map(async (firmaId) => {
        const { data: rows } = await supabase.from('personeller').select('id, data').eq('organization_id', firmaId).is('deleted_at', null);
        (rows ?? []).forEach(r => {
          const d = r.data as Record<string, unknown>;
          allPersonel.push({ id: r.id, adSoyad: (d.adSoyad as string) ?? '', gorev: (d.gorev as string) ?? '', firmaId });
        });
      }));
      setPersonelOptions(allPersonel);
    };
    load();
  }, [open, atanmisFirmaIds]);

  // Form reset
  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({ ...editData });
    } else if (preselectedPersonelId) {
      const p = personelOptions.find(x => x.id === preselectedPersonelId);
      setForm({ ...emptyForm, personelId: preselectedPersonelId, firmaId: p?.firmaId ?? '' });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
    setPastKazalar([]);
  }, [open, editData, preselectedPersonelId, personelOptions]);

  // Personel seçilince geçmiş kazaları çek
  useEffect(() => {
    if (!form.personelId) { setPastKazalar([]); return; }
    const fetchPast = async () => {
      setLoadingPast(true);
      try {
        const { data } = await supabase
          .from('is_kazalari')
          .select('id, kaza_tarihi, kaza_yeri, yarali_vucut_bolgeleri, yaralanma_turu, yaralanma_siddeti, durum')
          .eq('personel_id', form.personelId)
          .order('kaza_tarihi', { ascending: false })
          .limit(10);
        // Düzenleme modundaysa mevcut kaydı hariç tut
        const filtered = (data ?? []).filter(k => k.id !== editData?.id);
        setPastKazalar(filtered as PastKaza[]);
      } catch {
        setPastKazalar([]);
      } finally {
        setLoadingPast(false);
      }
    };
    fetchPast();
  }, [form.personelId, editData?.id]);

  const toggleBolge = (id: string) => {
    setForm(prev => ({
      ...prev,
      yaraliVucutBolgeleri: prev.yaraliVucutBolgeleri.includes(id)
        ? prev.yaraliVucutBolgeleri.filter(b => b !== id)
        : [...prev.yaraliVucutBolgeleri, id],
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.personelId)     e.personelId     = 'Personel zorunludur';
    if (!form.kazaTarihi)     e.kazaTarihi     = 'Tarih zorunludur';
    if (!form.kazaAciklamasi) e.kazaAciklamasi = 'Açıklama zorunludur';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        organization_id:        form.firmaId,
        personel_id:            form.personelId,
        kaza_tarihi:            form.kazaTarihi,
        kaza_saati:             form.kazaSaati || null,
        kaza_yeri:              form.kazaYeri,
        kaza_turu:              form.kazaTuru,
        kaza_aciklamasi:        form.kazaAciklamasi,
        yarali_vucut_bolgeleri: form.yaraliVucutBolgeleri,
        yaralanma_turu:         form.yaralanmaTuru,
        yaralanma_siddeti:      form.yaralanmaSiddeti,
        is_gunu_kaybi:          form.isGunuKaybi,
        hastaneye_kaldirildi:   form.hastaneyeKaldirildi,
        hastane_adi:            form.hastaneAdi,
        tanik_bilgileri:        form.tanikBilgileri,
        onlemler:               form.onlemler,
        durum:                  form.durum,
      };
      if (editData?.id) {
        await supabase.from('is_kazalari').update(payload).eq('id', editData.id);
      } else {
        await supabase.from('is_kazalari').insert(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[HekimIsKazasiModal] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const filteredPersonel = form.firmaId
    ? personelOptions.filter(p => p.firmaId === form.firmaId)
    : personelOptions;

  const inputStyle: React.CSSProperties = {
    background: inputBg,
    border: `1.5px solid ${border}`,
    color: textP,
    borderRadius: 8,
    padding: '7px 11px',
    fontSize: 12,
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    color: labelC,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    display: 'block',
    marginBottom: 4,
  };

  // Son seçili bölge bilgisi
  const lastSelected = form.yaraliVucutBolgeleri[form.yaraliVucutBolgeleri.length - 1];
  const lastBolgeInfo = VUCUT_BOLGELERI.find(b => b.id === lastSelected);
  const lastRisk = lastSelected ? BOLGE_RISK[lastSelected] : null;

  // Seçili personel adı
  const secilenPersonel = personelOptions.find(p => p.id === form.personelId);

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', padding: '12px', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxWidth: 1280,
          height: 'calc(100vh - 24px)',
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 40px 100px rgba(0,0,0,0.85)' : '0 40px 100px rgba(15,23,42,0.22)',
        }}
      >
        {/* Gradient top bar */}
        <div className="h-[3px] flex-shrink-0"
          style={{ background: `linear-gradient(90deg, #EF4444 0%, #F59E0B 35%, ${ACCENT} 70%, #10b981 100%)` }} />

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${border}`, background: panelBg }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <i className="ri-alert-line text-sm" style={{ color: '#EF4444' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: textP, letterSpacing: '-0.02em' }}>
                {editData ? 'İş Kazası Düzenle' : 'Yeni İş Kazası Kaydı'}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: textS }}>
                3D model üzerinden yaralı bölgeyi seçin · Sol sürükle: döndür · Scroll: zoom
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {form.yaraliVucutBolgeleri.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                <i className="ri-map-pin-2-line" />
                {form.yaraliVucutBolgeleri.length} bölge seçili
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: textS }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'; (e.currentTarget as HTMLElement).style.color = textS; }}
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {/* ════════ 3 KOLON ════════ */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ═══ SOL PANEL — Bölge Bilgisi + Geçmiş Kazalar ═══ */}
          <div
            className="flex-shrink-0 flex flex-col overflow-hidden"
            style={{ width: 252, borderRight: `1px solid ${border}`, background: panelBg }}
          >
            {/* Panel başlık */}
            <div className="px-4 pt-4 pb-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-5 h-5 flex items-center justify-center rounded-md"
                  style={{ background: 'rgba(14,165,233,0.12)', border: `1px solid rgba(14,165,233,0.2)` }}>
                  <i className="ri-stethoscope-line text-[10px]" style={{ color: ACCENT }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                  Klinik Asistan
                </span>
              </div>
              <p className="text-[9px]" style={{ color: textS }}>
                {form.personelId
                  ? `${secilenPersonel?.adSoyad ?? 'Personel'} için kayıtlar`
                  : 'Personel seçildiğinde geçmiş görünür'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* ─── Seçili bölge klinik notu ─── */}
              {lastBolgeInfo && (
                <div className="p-3 m-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: '#EF4444' }}>
                      <i className={`${lastBolgeInfo.icon} text-white text-[10px]`} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold leading-tight" style={{ color: textP }}>{lastBolgeInfo.label}</p>
                      {lastRisk && (
                        <span className="text-[9px] font-semibold" style={{ color: lastRisk.color }}>● {lastRisk.label} Risk</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] leading-relaxed" style={{ color: textS }}>
                    {lastBolgeInfo.anatomyNote}
                  </p>
                </div>
              )}

              {/* ─── Seçili bölgeler özeti ─── */}
              {form.yaraliVucutBolgeleri.length > 0 && (
                <div className="px-3 pb-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: textS }}>
                    Seçili ({form.yaraliVucutBolgeleri.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {form.yaraliVucutBolgeleri.map(id => {
                      const info = VUCUT_BOLGELERI.find(b => b.id === id);
                      return (
                        <button
                          key={id}
                          onClick={() => toggleBolge(id)}
                          className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer whitespace-nowrap transition-all"
                          style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.22)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.20)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)'; }}
                        >
                          {info?.label ?? id}<i className="ri-close-line text-[8px] ml-0.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── AYRAÇ ─── */}
              {form.personelId && (
                <div className="mx-3 my-2" style={{ borderTop: `1px solid ${border}` }} />
              )}

              {/* ─── GEÇMİŞ KAZALAR ─── */}
              {form.personelId && (
                <div className="px-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#F59E0B' }}>
                      <i className="ri-history-line mr-1" />Geçmiş Kazalar
                    </p>
                    {loadingPast && (
                      <i className="ri-loader-4-line animate-spin text-[10px]" style={{ color: textS }} />
                    )}
                    {!loadingPast && pastKazalar.length > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.22)' }}>
                        {pastKazalar.length}
                      </span>
                    )}
                  </div>

                  {loadingPast && (
                    <div className="space-y-2">
                      {[1, 2].map(i => (
                        <div key={i} className="h-16 rounded-xl animate-pulse"
                          style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }} />
                      ))}
                    </div>
                  )}

                  {!loadingPast && pastKazalar.length === 0 && (
                    <div className="flex flex-col items-center py-4 text-center">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)', border: `1px dashed ${border}` }}>
                        <i className="ri-checkbox-circle-line text-lg" style={{ color: isDark ? '#334155' : '#cbd5e1' }} />
                      </div>
                      <p className="text-[9px] font-semibold" style={{ color: textS }}>Geçmiş kaza yok</p>
                      <p className="text-[9px] mt-0.5" style={{ color: isDark ? '#334155' : '#cbd5e1' }}>
                        Bu personel için kayıt bulunamadı
                      </p>
                    </div>
                  )}

                  {!loadingPast && pastKazalar.length > 0 && (
                    <div className="space-y-2">
                      {pastKazalar.map(kaza => {
                        const siddetCfg = SIDDET_COLORS[kaza.yaralanma_siddeti] ?? SIDDET_COLORS['Hafif'];
                        const bolgeler = (kaza.yarali_vucut_bolgeleri ?? [])
                          .map(id => VUCUT_BOLGELERI.find(b => b.id === id)?.label ?? id)
                          .slice(0, 3);
                        const durumColor = kaza.durum === 'Kapatıldı'
                          ? '#10b981'
                          : kaza.durum === 'Soruşturuluyor'
                          ? '#F59E0B'
                          : '#EF4444';

                        return (
                          <div
                            key={kaza.id}
                            className="p-2.5 rounded-xl transition-all"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                              border: `1px solid ${border}`,
                            }}
                          >
                            {/* Tarih + şiddet */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-bold" style={{ color: textP }}>
                                <i className="ri-calendar-line mr-1" style={{ color: textS }} />
                                {formatDate(kaza.kaza_tarihi)}
                              </span>
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: siddetCfg.bg, color: siddetCfg.color }}>
                                {kaza.yaralanma_siddeti}
                              </span>
                            </div>

                            {/* Tür + durum */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px]" style={{ color: textS }}>
                                {kaza.yaralanma_turu || 'Bilinmiyor'}
                              </span>
                              <span className="text-[8px] font-semibold flex items-center gap-0.5"
                                style={{ color: durumColor }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: durumColor, display: 'inline-block' }} />
                                {kaza.durum}
                              </span>
                            </div>

                            {/* Bölgeler */}
                            {bolgeler.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {bolgeler.map(b => (
                                  <span key={b} className="text-[8px] px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    {b}
                                  </span>
                                ))}
                                {(kaza.yarali_vucut_bolgeleri?.length ?? 0) > 3 && (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded-full"
                                    style={{ background: border, color: textS }}>
                                    +{(kaza.yarali_vucut_bolgeleri?.length ?? 0) - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Yer */}
                            {kaza.kaza_yeri && (
                              <p className="text-[8px] mt-1.5 flex items-center gap-1 truncate" style={{ color: textS }}>
                                <i className="ri-map-pin-line flex-shrink-0" />
                                {kaza.kaza_yeri}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Personel seçilmemişse boş durum */}
              {!form.personelId && (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center py-8">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)', border: `1px dashed ${border}` }}>
                    <i className="ri-user-search-line text-xl" style={{ color: isDark ? '#334155' : '#cbd5e1' }} />
                  </div>
                  <p className="text-[10px] font-semibold" style={{ color: textS }}>Personel Seçin</p>
                  <p className="text-[9px] mt-1 leading-relaxed" style={{ color: isDark ? '#334155' : '#cbd5e1' }}>
                    Sağdaki formdan personel seçtiğinizde geçmiş kazalar burada görünür
                  </p>
                </div>
              )}
            </div>

            {/* Renk kılavuzu — alt */}
            <div className="p-3 flex-shrink-0" style={{ borderTop: `1px solid ${border}` }}>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: textS }}>3D Renk</p>
              <div className="flex items-center gap-3">
                {[
                  { color: '#b07a58', label: 'Normal' },
                  { color: HOVER_COLOR, label: 'Hover' },
                  { color: '#EF4444', label: 'Seçili' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-[9px]" style={{ color: textS }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ ORTA PANEL — 3D Model ═══ */}
          <div
            className="flex-shrink-0 flex flex-col relative"
            style={{ flex: '0 0 420px', background: centerBg, borderRight: `1px solid ${border}` }}
          >
            <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
              style={{ borderBottom: `1px solid ${border}` }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#EF4444' }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textS }}>
                  İnteraktif 3D Model
                </span>
              </div>
              <div className="flex items-center gap-3 text-[9px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                <span className="flex items-center gap-1"><i className="ri-drag-move-line text-[10px]" />Döndür</span>
                <span className="flex items-center gap-1"><i className="ri-zoom-in-line text-[10px]" />Zoom</span>
                <span className="flex items-center gap-1"><i className="ri-cursor-line text-[10px]" />Tıkla</span>
              </div>
            </div>

            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <Suspense fallback={
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(14,165,233,0.12)', border: `1px solid rgba(14,165,233,0.2)` }}>
                    <i className="ri-loader-4-line animate-spin text-base" style={{ color: ACCENT }} />
                  </div>
                  <p className="text-[10px]" style={{ color: textS }}>Model yükleniyor...</p>
                </div>
              }>
                <Human3DModel
                  selected={form.yaraliVucutBolgeleri}
                  onToggle={toggleBolge}
                  isDark={isDark}
                />
              </Suspense>
            </div>

            <div className="px-4 py-2 flex-shrink-0 flex items-center justify-center gap-4"
              style={{ borderTop: `1px solid ${border}` }}>
              <span className="text-[9px] font-medium" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                <i className="ri-mouse-line mr-1" />Sol tık + sürükle → döndür
              </span>
              <span style={{ color: isDark ? '#334155' : '#cbd5e1' }}>·</span>
              <span className="text-[9px] font-medium" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                <i className="ri-zoom-in-line mr-1" />Scroll → zoom
              </span>
            </div>
          </div>

          {/* ═══ SAĞ PANEL — Form ═══ */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: panelBg }}>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">

              {/* Kazazede */}
              <div className="p-3.5 rounded-xl space-y-2.5" style={{ background: sectionBg, border: `1px solid ${border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#EF4444' }}>
                  <i className="ri-user-line" />Kazazede
                </p>
                <div>
                  <label style={labelStyle}>Firma</label>
                  <select
                    value={form.firmaId}
                    onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                    onBlur={e => { e.currentTarget.style.borderColor = border; }}
                  >
                    <option value="">Tüm Firmalar</option>
                    {Object.entries(firmaAdMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Personel <span style={{ color: '#EF4444' }}>*</span></label>
                  <select
                    value={form.personelId}
                    onChange={e => {
                      const p = personelOptions.find(x => x.id === e.target.value);
                      setForm(prev => ({ ...prev, personelId: e.target.value, firmaId: p?.firmaId ?? prev.firmaId }));
                    }}
                    style={{ ...inputStyle, borderColor: errors.personelId ? '#EF4444' : border }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#EF4444'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.personelId ? '#EF4444' : border; }}
                  >
                    <option value="">Personel Seçin</option>
                    {filteredPersonel.map(p => <option key={p.id} value={p.id}>{p.adSoyad}{p.gorev ? ` — ${p.gorev}` : ''}</option>)}
                  </select>
                  {errors.personelId && <p className="text-[9px] mt-1" style={{ color: '#EF4444' }}>{errors.personelId}</p>}
                </div>
              </div>

              {/* Kaza Detayları */}
              <div className="p-3.5 rounded-xl space-y-2.5" style={{ background: sectionBg, border: `1px solid ${border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#F59E0B' }}>
                  <i className="ri-calendar-event-line" />Kaza Detayları
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label style={labelStyle}>Tarih <span style={{ color: '#EF4444' }}>*</span></label>
                    <input
                      type="date" value={form.kazaTarihi}
                      onChange={e => setForm(p => ({ ...p, kazaTarihi: e.target.value }))}
                      style={{ ...inputStyle, borderColor: errors.kazaTarihi ? '#EF4444' : border }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#EF4444'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = errors.kazaTarihi ? '#EF4444' : border; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Saat</label>
                    <input
                      type="time" value={form.kazaSaati}
                      onChange={e => setForm(p => ({ ...p, kazaSaati: e.target.value }))}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#F59E0B'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = border; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Kaza Yeri</label>
                    <input
                      type="text" value={form.kazaYeri} placeholder="Üretim, depo..."
                      onChange={e => setForm(p => ({ ...p, kazaYeri: e.target.value }))}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#F59E0B'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = border; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Kaza Türü</label>
                    <select
                      value={form.kazaTuru}
                      onChange={e => setForm(p => ({ ...p, kazaTuru: e.target.value }))}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#F59E0B'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = border; }}
                    >
                      <option value="">Seçin</option>
                      {KAZA_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Kaza Açıklaması <span style={{ color: '#EF4444' }}>*</span></label>
                  <textarea
                    value={form.kazaAciklamasi} rows={2} maxLength={500}
                    placeholder="Kazanın nasıl gerçekleştiğini açıklayın..."
                    onChange={e => setForm(p => ({ ...p, kazaAciklamasi: e.target.value }))}
                    style={{ ...inputStyle, resize: 'none', borderColor: errors.kazaAciklamasi ? '#EF4444' : border }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#EF4444'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.kazaAciklamasi ? '#EF4444' : border; }}
                  />
                  <div className="flex justify-between mt-0.5">
                    {errors.kazaAciklamasi
                      ? <p className="text-[9px]" style={{ color: '#EF4444' }}>{errors.kazaAciklamasi}</p>
                      : <span />
                    }
                    <p className="text-[9px]" style={{ color: textS }}>{form.kazaAciklamasi.length}/500</p>
                  </div>
                </div>
              </div>

              {/* Yaralanma */}
              <div className="p-3.5 rounded-xl space-y-2.5" style={{ background: sectionBg, border: `1px solid ${border}` }}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#F59E0B' }}>
                    <i className="ri-first-aid-kit-line" />Yaralanma
                  </p>
                  {/* Seçili bölge otomatik göster */}
                  {form.yaraliVucutBolgeleri.length > 0 && (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {form.yaraliVucutBolgeleri.map(id => VUCUT_BOLGELERI.find(b => b.id === id)?.label ?? id).join(', ')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label style={labelStyle}>Yaralanma Türü</label>
                    <select
                      value={form.yaralanmaTuru}
                      onChange={e => setForm(p => ({ ...p, yaralanmaTuru: e.target.value }))}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#F59E0B'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = border; }}
                    >
                      <option value="">Seçin</option>
                      {YARALANMA_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>İş Günü Kaybı</label>
                    <input
                      type="number" min={0} value={form.isGunuKaybi}
                      onChange={e => setForm(p => ({ ...p, isGunuKaybi: parseInt(e.target.value) || 0 }))}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#F59E0B'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = border; }}
                    />
                  </div>
                </div>

                {/* Şiddet butonları */}
                <div>
                  <label style={labelStyle}>Şiddet</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SIDDET_OPTIONS.map(opt => {
                      const cfg = SIDDET_COLORS[opt];
                      const active = form.yaralanmaSiddeti === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => setForm(p => ({ ...p, yaralanmaSiddeti: opt }))}
                          className="py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap"
                          style={{
                            background: active ? cfg.bg : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
                            color: active ? cfg.color : textS,
                            border: `1.5px solid ${active ? cfg.color + '55' : border}`,
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hastane */}
                <button
                  onClick={() => setForm(p => ({ ...p, hastaneyeKaldirildi: !p.hastaneyeKaldirildi }))}
                  className="flex items-center gap-2 cursor-pointer transition-all"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0"
                    style={{ background: form.hastaneyeKaldirildi ? ACCENT : 'transparent', border: `2px solid ${form.hastaneyeKaldirildi ? ACCENT : border}` }}
                  >
                    {form.hastaneyeKaldirildi && <i className="ri-check-line text-white text-[9px]" />}
                  </div>
                  <span className="text-[11px] font-semibold" style={{ color: textP }}>Hastaneye kaldırıldı</span>
                </button>
                {form.hastaneyeKaldirildi && (
                  <input
                    type="text" value={form.hastaneAdi} placeholder="Hastane / klinik adı..."
                    onChange={e => setForm(p => ({ ...p, hastaneAdi: e.target.value }))}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                    onBlur={e => { e.currentTarget.style.borderColor = border; }}
                  />
                )}
              </div>

              {/* Tanık & Önlemler */}
              <div className="p-3.5 rounded-xl space-y-2.5" style={{ background: sectionBg, border: `1px solid ${border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: ACCENT }}>
                  <i className="ri-shield-check-line" />Tanık & Önlemler
                </p>
                <div>
                  <label style={labelStyle}>Tanık Bilgileri</label>
                  <input
                    type="text" value={form.tanikBilgileri} placeholder="Tanıkların adı..."
                    onChange={e => setForm(p => ({ ...p, tanikBilgileri: e.target.value }))}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                    onBlur={e => { e.currentTarget.style.borderColor = border; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Alınan Önlemler</label>
                  <textarea
                    value={form.onlemler} rows={2} maxLength={500}
                    placeholder="Alınan/alınacak tedbirler..."
                    onChange={e => setForm(p => ({ ...p, onlemler: e.target.value }))}
                    style={{ ...inputStyle, resize: 'none' }}
                    onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                    onBlur={e => { e.currentTarget.style.borderColor = border; }}
                  />
                </div>

                {/* Durum */}
                <div>
                  <label style={labelStyle}>Durum</label>
                  <div className="flex gap-1.5">
                    {['Açık', 'Soruşturuluyor', 'Kapatıldı'].map(d => (
                      <button
                        key={d}
                        onClick={() => setForm(p => ({ ...p, durum: d }))}
                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap"
                        style={{
                          background: form.durum === d ? 'rgba(14,165,233,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
                          color: form.durum === d ? ACCENT : textS,
                          border: `1.5px solid ${form.durum === d ? 'rgba(14,165,233,0.35)' : border}`,
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Footer */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderTop: `1px solid ${border}`, background: panelBg }}>
              <button
                onClick={onClose}
                className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold cursor-pointer transition-all"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textS, border: `1px solid ${border}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = border; (e.currentTarget as HTMLElement).style.color = textS; }}
              >
                <i className="ri-close-line" />İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="whitespace-nowrap flex items-center gap-1.5 px-5 py-2 rounded-xl text-[12px] font-bold cursor-pointer text-white transition-all"
                style={{
                  background: saving ? 'rgba(239,68,68,0.5)' : 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: saving ? 'none' : '0 4px 14px rgba(239,68,68,0.35)',
                  transform: 'translateY(0)',
                }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                {saving
                  ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</>
                  : <><i className={editData ? 'ri-save-line' : 'ri-add-circle-line'} />{editData ? 'Güncelle' : 'Kaydet'}</>
                }
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
