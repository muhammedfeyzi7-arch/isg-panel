import { useState, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import Human3DModel from './Human3DModel';

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

const VUCUT_BOLGELERI: { id: string; label: string }[] = [
  { id: 'bas', label: 'Baş' },
  { id: 'boyun', label: 'Boyun' },
  { id: 'sag_omuz', label: 'Sağ Omuz' },
  { id: 'sol_omuz', label: 'Sol Omuz' },
  { id: 'gogus', label: 'Göğüs' },
  { id: 'sirt', label: 'Sırt' },
  { id: 'sag_kol', label: 'Sağ Kol' },
  { id: 'sol_kol', label: 'Sol Kol' },
  { id: 'sag_el', label: 'Sağ El' },
  { id: 'sol_el', label: 'Sol El' },
  { id: 'karin', label: 'Karın/Bel' },
  { id: 'sag_kalca', label: 'Sağ Kalça' },
  { id: 'sol_kalca', label: 'Sol Kalça' },
  { id: 'sag_bacak', label: 'Sağ Bacak' },
  { id: 'sol_bacak', label: 'Sol Bacak' },
  { id: 'sag_ayak', label: 'Sağ Ayak' },
  { id: 'sol_ayak', label: 'Sol Ayak' },
];

const SIDDET_OPTIONS = [
  { label: 'Hafif', color: '#22d3ee', bg: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.4)' },
  { label: 'Orta', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)' },
  { label: 'Ağır', color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)' },
  { label: 'Çok Ağır', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' },
];

const BOLGE_RISK_MAP: Record<string, { color: string; label: string; note: string }> = {
  bas:       { color: '#ef4444', label: 'Kritik', note: 'Kafa travması, beyin sarsıntısı riski yüksek' },
  boyun:     { color: '#ef4444', label: 'Kritik', note: 'Omurga hasarı — immobilizasyon gerekebilir' },
  gogus:     { color: '#f97316', label: 'Yüksek', note: 'Pnömotoraks, kot kırığı olasılığını değerlendir' },
  sirt:      { color: '#f97316', label: 'Yüksek', note: 'Vertebra hasarı olasılığını değerlendir' },
  karin:     { color: '#f97316', label: 'Yüksek', note: 'İç organ hasarı, lomber vertebra değerlendir' },
  sag_omuz:  { color: '#fbbf24', label: 'Orta', note: 'Rotator cuff, klavikula kırığı değerlendir' },
  sol_omuz:  { color: '#fbbf24', label: 'Orta', note: 'Rotator cuff, klavikula kırığı değerlendir' },
  sag_kol:   { color: '#22d3ee', label: 'Düşük', note: 'Biseps/humerus kırığı, sinir hasarı' },
  sol_kol:   { color: '#22d3ee', label: 'Düşük', note: 'Biseps/humerus kırığı, sinir hasarı' },
  sag_el:    { color: '#22d3ee', label: 'Düşük', note: 'Parmak kırıkları, tendon hasarı' },
  sol_el:    { color: '#22d3ee', label: 'Düşük', note: 'Parmak kırıkları, tendon hasarı' },
  sag_kalca: { color: '#22d3ee', label: 'Düşük', note: 'Kalça eklemi, femur boynu kırığı' },
  sol_kalca: { color: '#22d3ee', label: 'Düşük', note: 'Kalça eklemi, femur boynu kırığı' },
  sag_bacak: { color: '#22d3ee', label: 'Düşük', note: 'Tibia/fibula kırığı, menisküs hasarı' },
  sol_bacak: { color: '#22d3ee', label: 'Düşük', note: 'Tibia/fibula kırığı, menisküs hasarı' },
  sag_ayak:  { color: '#22d3ee', label: 'Düşük', note: 'Metatars kırığı, ayak bileği burkulmasi' },
  sol_ayak:  { color: '#22d3ee', label: 'Düşük', note: 'Metatars kırığı, ayak bileği burkulmasi' },
};

const emptyForm: IsKazasiFormData = {
  personelId: '', firmaId: '', kazaTarihi: '', kazaSaati: '',
  kazaYeri: '', kazaTuru: '', kazaAciklamasi: '',
  yaraliVucutBolgeleri: [], yaralanmaTuru: '', yaralanmaSiddeti: 'Hafif',
  isGunuKaybi: 0, hastaneyeKaldirildi: false, hastaneAdi: '',
  tanikBilgileri: '', onlemler: '', durum: 'Açık',
};

const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f1f5f9',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const LABEL_STYLE: React.CSSProperties = {
  color: 'rgba(148,163,184,0.8)',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: 5,
};

export default function HekimIsKazasiModal({
  open, onClose, onSaved, atanmisFirmaIds, isDark, editData, preselectedPersonelId,
}: HekimIsKazasiModalProps) {
  const [form, setForm] = useState<IsKazasiFormData>(emptyForm);
  const [personelOptions, setPersonelOptions] = useState<PersonelOption[]>([]);
  const [firmaAdMap, setFirmaAdMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'kaza' | 'yaralanma' | 'onceki'>('kaza');
  const [pastKazalar, setPastKazalar] = useState<{
    id: string; kaza_tarihi: string; kaza_yeri: string;
    yarali_vucut_bolgeleri: string[]; yaralanma_siddeti: string; durum: string;
  }[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

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
    setActiveTab('kaza');
    setPastKazalar([]);
  }, [open, editData, preselectedPersonelId, personelOptions]);

  useEffect(() => {
    if (!form.personelId) { setPastKazalar([]); return; }
    const fetchPast = async () => {
      setLoadingPast(true);
      try {
        const { data } = await supabase
          .from('is_kazalari')
          .select('id, kaza_tarihi, kaza_yeri, yarali_vucut_bolgeleri, yaralanma_siddeti, durum')
          .eq('personel_id', form.personelId)
          .order('kaza_tarihi', { ascending: false })
          .limit(5);
        const filtered = (data ?? []).filter(k => k.id !== editData?.id);
        setPastKazalar(filtered);
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
    if (!form.personelId) e.personelId = 'Personel zorunludur';
    if (!form.kazaTarihi) e.kazaTarihi = 'Tarih zorunludur';
    if (!form.kazaAciklamasi) e.kazaAciklamasi = 'Açıklama zorunludur';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        organization_id: form.firmaId,
        personel_id: form.personelId,
        kaza_tarihi: form.kazaTarihi,
        kaza_saati: form.kazaSaati || null,
        kaza_yeri: form.kazaYeri,
        kaza_turu: form.kazaTuru,
        kaza_aciklamasi: form.kazaAciklamasi,
        yarali_vucut_bolgeleri: form.yaraliVucutBolgeleri,
        yaralanma_turu: form.yaralanmaTuru,
        yaralanma_siddeti: form.yaralanmaSiddeti,
        is_gunu_kaybi: form.isGunuKaybi,
        hastaneye_kaldirildi: form.hastaneyeKaldirildi,
        hastane_adi: form.hastaneAdi,
        tanik_bilgileri: form.tanikBilgileri,
        onlemler: form.onlemler,
        durum: form.durum,
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

  const secilenPersonel = personelOptions.find(p => p.id === form.personelId);
  const lastSelected = form.yaraliVucutBolgeleri[form.yaraliVucutBolgeleri.length - 1];
  const lastRisk = lastSelected ? BOLGE_RISK_MAP[lastSelected] : null;
  const lastBolgeLabel = lastSelected ? VUCUT_BOLGELERI.find(b => b.id === lastSelected)?.label : null;

  const siddetCfg = SIDDET_OPTIONS.find(s => s.label === form.yaralanmaSiddeti) ?? SIDDET_OPTIONS[0];

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)', padding: '10px', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxWidth: 1340,
          height: 'calc(100vh - 20px)',
          background: '#080e1a',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 50px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(239,68,68,0.15)',
        }}
      >
        {/* Top gradient bar */}
        <div className="h-[2px] flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #ef4444 0%, #f97316 30%, #fbbf24 60%, #22d3ee 100%)' }} />

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(148,163,184,0.6)' }}>
                İş Kazası Kayıt Sistemi
              </span>
            </div>
            <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <p className="text-sm font-bold" style={{ color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              {editData ? 'Kaydı Düzenle' : 'Yeni Kaza Kaydı'}
            </p>
            {secilenPersonel && (
              <>
                <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff' }}>
                    {secilenPersonel.adSoyad.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>{secilenPersonel.adSoyad}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {form.yaraliVucutBolgeleri.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <i className="ri-body-scan-line text-[11px]" style={{ color: '#ef4444' }} />
                <span className="text-[11px] font-bold" style={{ color: '#ef4444' }}>
                  {form.yaraliVucutBolgeleri.length} bölge işaretlendi
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {/* ══ 3 KOLON ══ */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ═══ SOL: 3D MODEL ═══ */}
          <div className="flex flex-col" style={{ flex: '0 0 480px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#060c18' }}>
            {/* Model header */}
            <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <i className="ri-body-scan-line text-xs" style={{ color: '#ef4444' }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  3D Vücut Modeli
                </span>
              </div>
              <div className="flex items-center gap-3 text-[9px]" style={{ color: 'rgba(100,116,139,0.6)' }}>
                <span><i className="ri-drag-move-line mr-1" />Döndür</span>
                <span><i className="ri-zoom-in-line mr-1" />Zoom</span>
                <span><i className="ri-cursor-line mr-1" />Tıkla: seç</span>
              </div>
            </div>

            {/* 3D Model */}
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <Suspense fallback={
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border border-red-500 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
                  <span className="text-[11px]" style={{ color: '#475569' }}>Model yükleniyor...</span>
                </div>
              }>
                <Human3DModel
                  selected={form.yaraliVucutBolgeleri}
                  onToggle={toggleBolge}
                  isDark={true}
                />
              </Suspense>
            </div>

            {/* Seçili bölge klinik notu */}
            {lastRisk && lastBolgeLabel && (
              <div className="flex-shrink-0 px-4 py-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${lastRisk.color}18`, border: `1px solid ${lastRisk.color}30` }}>
                    <i className="ri-stethoscope-line text-xs" style={{ color: lastRisk.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: '#f1f5f9' }}>{lastBolgeLabel}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${lastRisk.color}18`, color: lastRisk.color, border: `1px solid ${lastRisk.color}30` }}>
                        {lastRisk.label} Risk
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: '#475569' }}>{lastRisk.note}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Renk kılavuzu */}
            <div className="px-4 py-2.5 flex items-center gap-4 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              {[
                { color: 'rgba(239,68,68,0.45)', label: 'Normal', dash: true },
                { color: '#ef4444', label: 'Seçili', dash: false },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: item.color, boxShadow: !item.dash ? '0 0 6px rgba(239,68,68,0.5)' : 'none' }} />
                  <span className="text-[9px] font-medium" style={{ color: '#334155' }}>{item.label}</span>
                </div>
              ))}
              <span className="ml-auto text-[9px]" style={{ color: '#1e293b' }}>Bölgeye tıkla → işaretle</span>
            </div>
          </div>

          {/* ═══ ORTA: İstatistik + Form ═══ */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* İstatistik şeridi */}
            <div className="flex-shrink-0 grid grid-cols-4 divide-x"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', divideColor: 'rgba(255,255,255,0.06)' }}>
              {[
                {
                  icon: 'ri-body-scan-line',
                  value: form.yaraliVucutBolgeleri.length || '—',
                  label: 'Yaralı Bölge',
                  color: '#ef4444',
                  bg: 'rgba(239,68,68,0.08)',
                },
                {
                  icon: 'ri-calendar-event-line',
                  value: form.kazaTarihi ? new Date(form.kazaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—',
                  label: 'Kaza Tarihi',
                  color: '#fbbf24',
                  bg: 'rgba(251,191,36,0.08)',
                },
                {
                  icon: 'ri-alert-fill',
                  value: form.yaralanmaSiddeti || '—',
                  label: 'Şiddet',
                  color: siddetCfg.color,
                  bg: siddetCfg.bg.replace('0.15', '0.08'),
                },
                {
                  icon: 'ri-calendar-close-line',
                  value: form.isGunuKaybi > 0 ? `${form.isGunuKaybi}g` : '—',
                  label: 'İş Günü Kaybı',
                  color: '#22d3ee',
                  bg: 'rgba(34,211,238,0.08)',
                },
              ].map(stat => (
                <div key={stat.label} className="flex items-center gap-3 px-4 py-3" style={{ background: stat.bg }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}25` }}>
                    <i className={`${stat.icon} text-sm`} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[9px] mt-0.5 font-semibold" style={{ color: 'rgba(148,163,184,0.5)' }}>{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
              {([
                { id: 'kaza', label: 'Kaza Bilgisi', icon: 'ri-alert-line', color: '#ef4444' },
                { id: 'yaralanma', label: 'Yaralanma', icon: 'ri-first-aid-kit-line', color: '#f97316' },
                { id: 'onceki', label: 'Geçmiş', icon: 'ri-history-line', color: '#fbbf24' },
              ] as { id: 'kaza' | 'yaralanma' | 'onceki'; label: string; icon: string; color: string }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: activeTab === tab.id ? `${tab.color}15` : 'transparent',
                    color: activeTab === tab.id ? tab.color : '#475569',
                    border: activeTab === tab.id ? `1px solid ${tab.color}30` : '1px solid transparent',
                  }}
                >
                  <i className={`${tab.icon} text-[11px]`} />
                  {tab.label}
                  {tab.id === 'onceki' && pastKazalar.length > 0 && (
                    <span className="w-4 h-4 rounded-full text-[8px] font-extrabold flex items-center justify-center"
                      style={{ background: '#fbbf2425', color: '#fbbf24' }}>
                      {pastKazalar.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Form içerik alanı */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

              {/* ── TAB: KAZA BİLGİSİ ── */}
              {activeTab === 'kaza' && (
                <>
                  {/* Kazazede */}
                  <div className="rounded-xl p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                      <i className="ri-user-line" />Kazazede
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={LABEL_STYLE}>Firma</label>
                        <select
                          value={form.firmaId}
                          onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))}
                          style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        >
                          <option value="">Tüm Firmalar</option>
                          {Object.entries(firmaAdMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Personel <span style={{ color: '#ef4444' }}>*</span></label>
                        <select
                          value={form.personelId}
                          onChange={e => {
                            const p = personelOptions.find(x => x.id === e.target.value);
                            setForm(prev => ({ ...prev, personelId: e.target.value, firmaId: p?.firmaId ?? prev.firmaId }));
                          }}
                          style={{ ...INPUT_STYLE, borderColor: errors.personelId ? '#ef4444' : 'rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = errors.personelId ? '#ef4444' : 'rgba(255,255,255,0.1)'; }}
                        >
                          <option value="">Personel Seçin</option>
                          {filteredPersonel.map(p => <option key={p.id} value={p.id}>{p.adSoyad}{p.gorev ? ` — ${p.gorev}` : ''}</option>)}
                        </select>
                        {errors.personelId && <p className="text-[9px] mt-1" style={{ color: '#ef4444' }}>{errors.personelId}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Kaza detayları */}
                  <div className="rounded-xl p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
                      <i className="ri-calendar-event-line" />Olay Detayları
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={LABEL_STYLE}>Tarih <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                          type="date" value={form.kazaTarihi}
                          onChange={e => setForm(p => ({ ...p, kazaTarihi: e.target.value }))}
                          style={{ ...INPUT_STYLE, borderColor: errors.kazaTarihi ? '#ef4444' : 'rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = errors.kazaTarihi ? '#ef4444' : 'rgba(255,255,255,0.1)'; }}
                        />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Saat</label>
                        <input
                          type="time" value={form.kazaSaati}
                          onChange={e => setForm(p => ({ ...p, kazaSaati: e.target.value }))}
                          style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Kaza Yeri</label>
                        <input
                          type="text" value={form.kazaYeri} placeholder="Üretim bandı, depo..."
                          onChange={e => setForm(p => ({ ...p, kazaYeri: e.target.value }))}
                          style={INPUT_STYLE}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Kaza Türü</label>
                        <select
                          value={form.kazaTuru}
                          onChange={e => setForm(p => ({ ...p, kazaTuru: e.target.value }))}
                          style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        >
                          <option value="">Seçin</option>
                          {KAZA_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>Açıklama <span style={{ color: '#ef4444' }}>*</span></label>
                      <textarea
                        value={form.kazaAciklamasi} rows={3} maxLength={500}
                        placeholder="Kazanın nasıl gerçekleştiğini ayrıntılı açıklayın..."
                        onChange={e => setForm(p => ({ ...p, kazaAciklamasi: e.target.value }))}
                        style={{ ...INPUT_STYLE, resize: 'none', borderColor: errors.kazaAciklamasi ? '#ef4444' : 'rgba(255,255,255,0.1)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = errors.kazaAciklamasi ? '#ef4444' : 'rgba(255,255,255,0.1)'; }}
                      />
                      <div className="flex justify-between mt-1">
                        {errors.kazaAciklamasi
                          ? <p className="text-[9px]" style={{ color: '#ef4444' }}>{errors.kazaAciklamasi}</p>
                          : <span />}
                        <p className="text-[9px]" style={{ color: '#334155' }}>{form.kazaAciklamasi.length}/500</p>
                      </div>
                    </div>
                  </div>

                  {/* Tanık & Önlemler */}
                  <div className="rounded-xl p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5" style={{ color: '#22d3ee' }}>
                      <i className="ri-shield-check-line" />Tanık & Önlemler
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={LABEL_STYLE}>Tanık Bilgileri</label>
                        <input
                          type="text" value={form.tanikBilgileri} placeholder="Tanıkların adı..."
                          onChange={e => setForm(p => ({ ...p, tanikBilgileri: e.target.value }))}
                          style={INPUT_STYLE}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Durum</label>
                        <div className="flex gap-1.5">
                          {['Açık', 'Soruşturuluyor', 'Kapatıldı'].map(d => {
                            const colors: Record<string, string> = { 'Açık': '#ef4444', 'Soruşturuluyor': '#fbbf24', 'Kapatıldı': '#10b981' };
                            const c = colors[d];
                            return (
                              <button
                                key={d}
                                onClick={() => setForm(p => ({ ...p, durum: d }))}
                                className="flex-1 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap"
                                style={{
                                  background: form.durum === d ? `${c}15` : 'rgba(255,255,255,0.04)',
                                  color: form.durum === d ? c : '#475569',
                                  border: `1px solid ${form.durum === d ? `${c}35` : 'rgba(255,255,255,0.06)'}`,
                                }}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>Alınan Önlemler</label>
                      <textarea
                        value={form.onlemler} rows={2} maxLength={500}
                        placeholder="Alınan veya alınacak tedbirler..."
                        onChange={e => setForm(p => ({ ...p, onlemler: e.target.value }))}
                        style={{ ...INPUT_STYLE, resize: 'none' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ── TAB: YARALANMA ── */}
              {activeTab === 'yaralanma' && (
                <>
                  {/* Seçili bölgeler görsel özet */}
                  <div className="rounded-xl p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                        <i className="ri-body-scan-line" />Yaralı Bölgeler
                        <span className="text-[9px] normal-case tracking-normal font-normal ml-1" style={{ color: '#475569' }}>
                          (3D modelden seçin)
                        </span>
                      </p>
                      {form.yaraliVucutBolgeleri.length > 0 && (
                        <button
                          onClick={() => setForm(p => ({ ...p, yaraliVucutBolgeleri: [] }))}
                          className="text-[9px] font-semibold cursor-pointer"
                          style={{ color: '#ef4444' }}
                        >
                          Temizle
                        </button>
                      )}
                    </div>
                    {form.yaraliVucutBolgeleri.length === 0 ? (
                      <div className="flex flex-col items-center py-5 text-center">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px dashed rgba(239,68,68,0.2)' }}>
                          <i className="ri-cursor-line text-lg" style={{ color: 'rgba(239,68,68,0.4)' }} />
                        </div>
                        <p className="text-[11px] font-semibold" style={{ color: '#475569' }}>Henüz bölge seçilmedi</p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#1e293b' }}>Sol taraftaki 3D modele tıklayın</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {form.yaraliVucutBolgeleri.map(id => {
                          const info = VUCUT_BOLGELERI.find(b => b.id === id);
                          const risk = BOLGE_RISK_MAP[id];
                          return (
                            <button
                              key={id}
                              onClick={() => toggleBolge(id)}
                              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-left"
                              style={{
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.2)',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: risk?.color ?? '#ef4444', boxShadow: `0 0 4px ${risk?.color ?? '#ef4444'}` }} />
                              <span className="text-[10px] font-semibold leading-tight" style={{ color: '#f1f5f9' }}>
                                {info?.label ?? id}
                              </span>
                              <i className="ri-close-line text-[9px] ml-auto" style={{ color: 'rgba(239,68,68,0.5)' }} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Yaralanma tür & şiddet */}
                  <div className="rounded-xl p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5" style={{ color: '#f97316' }}>
                      <i className="ri-first-aid-kit-line" />Yaralanma Bilgisi
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={LABEL_STYLE}>Yaralanma Türü</label>
                        <select
                          value={form.yaralanmaTuru}
                          onChange={e => setForm(p => ({ ...p, yaralanmaTuru: e.target.value }))}
                          style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        >
                          <option value="">Seçin</option>
                          {YARALANMA_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>İş Günü Kaybı</label>
                        <input
                          type="number" min={0} value={form.isGunuKaybi}
                          onChange={e => setForm(p => ({ ...p, isGunuKaybi: parseInt(e.target.value) || 0 }))}
                          style={INPUT_STYLE}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        />
                      </div>
                    </div>

                    {/* Şiddet seçici */}
                    <div>
                      <label style={LABEL_STYLE}>Yaralanma Şiddeti</label>
                      <div className="grid grid-cols-4 gap-2">
                        {SIDDET_OPTIONS.map(opt => {
                          const active = form.yaralanmaSiddeti === opt.label;
                          return (
                            <button
                              key={opt.label}
                              onClick={() => setForm(p => ({ ...p, yaralanmaSiddeti: opt.label }))}
                              className="py-2.5 rounded-xl text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap flex flex-col items-center gap-1"
                              style={{
                                background: active ? opt.bg : 'rgba(255,255,255,0.04)',
                                color: active ? opt.color : '#334155',
                                border: `1.5px solid ${active ? opt.border : 'rgba(255,255,255,0.06)'}`,
                                boxShadow: active ? `0 0 16px ${opt.color}25` : 'none',
                              }}
                            >
                              <div className="w-2 h-2 rounded-full"
                                style={{ background: active ? opt.color : '#1e293b', boxShadow: active ? `0 0 6px ${opt.color}` : 'none' }} />
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hastane */}
                    <div>
                      <button
                        onClick={() => setForm(p => ({ ...p, hastaneyeKaldirildi: !p.hastaneyeKaldirildi }))}
                        className="flex items-center gap-2.5 cursor-pointer mb-2 transition-all"
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0"
                          style={{
                            background: form.hastaneyeKaldirildi ? '#ef4444' : 'transparent',
                            border: `2px solid ${form.hastaneyeKaldirildi ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                          }}
                        >
                          {form.hastaneyeKaldirildi && <i className="ri-check-line text-white text-[9px]" />}
                        </div>
                        <span className="text-xs font-semibold" style={{ color: form.hastaneyeKaldirildi ? '#f1f5f9' : '#475569' }}>
                          Hastaneye kaldırıldı
                        </span>
                      </button>
                      {form.hastaneyeKaldirildi && (
                        <input
                          type="text" value={form.hastaneAdi} placeholder="Hastane / klinik adı..."
                          onChange={e => setForm(p => ({ ...p, hastaneAdi: e.target.value }))}
                          style={INPUT_STYLE}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── TAB: GEÇMİŞ ── */}
              {activeTab === 'onceki' && (
                <div className="space-y-3">
                  {!form.personelId && (
                    <div className="rounded-xl p-10 flex flex-col items-center gap-3 text-center"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <i className="ri-user-search-line text-2xl" style={{ color: '#1e293b' }} />
                      </div>
                      <p className="text-xs font-semibold" style={{ color: '#475569' }}>Önce personel seçin</p>
                      <p className="text-[10px]" style={{ color: '#1e293b' }}>Kaza bilgisi sekmesinden personel seçin</p>
                    </div>
                  )}

                  {form.personelId && loadingPast && (
                    <div className="flex items-center justify-center py-10 gap-2">
                      <div className="w-5 h-5 border border-yellow-400 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
                      <span className="text-xs" style={{ color: '#475569' }}>Yükleniyor...</span>
                    </div>
                  )}

                  {form.personelId && !loadingPast && pastKazalar.length === 0 && (
                    <div className="rounded-xl p-10 flex flex-col items-center gap-3 text-center"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#10b981' }} />
                      </div>
                      <p className="text-xs font-semibold" style={{ color: '#475569' }}>Geçmişte kaza yok</p>
                      <p className="text-[10px]" style={{ color: '#1e293b' }}>Bu personel için kayıtlı kaza geçmişi bulunmuyor</p>
                    </div>
                  )}

                  {form.personelId && !loadingPast && pastKazalar.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#fbbf24' }}>
                          <i className="ri-history-line mr-1" />Kayıtlı Kaza Geçmişi
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                          {pastKazalar.length} kayıt
                        </span>
                      </div>
                      {pastKazalar.map(kaza => {
                        const siddetOpt = SIDDET_OPTIONS.find(s => s.label === kaza.yaralanma_siddeti) ?? SIDDET_OPTIONS[0];
                        const durumColors: Record<string, string> = { 'Açık': '#ef4444', 'Soruşturuluyor': '#fbbf24', 'Kapatıldı': '#10b981' };
                        const dc = durumColors[kaza.durum] ?? '#ef4444';
                        return (
                          <div
                            key={kaza.id}
                            className="rounded-xl p-3.5 space-y-2"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold" style={{ color: '#f1f5f9' }}>
                                <i className="ri-calendar-line mr-1.5" style={{ color: '#475569' }} />
                                {kaza.kaza_tarihi ? new Date(kaza.kaza_tarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: siddetOpt.bg, color: siddetOpt.color, border: `1px solid ${siddetOpt.border}` }}>
                                  {kaza.yaralanma_siddeti}
                                </span>
                                <span className="flex items-center gap-1 text-[9px] font-bold"
                                  style={{ color: dc }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: dc }} />
                                  {kaza.durum}
                                </span>
                              </div>
                            </div>
                            {kaza.kaza_yeri && (
                              <p className="text-[10px] flex items-center gap-1" style={{ color: '#475569' }}>
                                <i className="ri-map-pin-line flex-shrink-0" />
                                {kaza.kaza_yeri}
                              </p>
                            )}
                            {(kaza.yarali_vucut_bolgeleri?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(kaza.yarali_vucut_bolgeleri ?? []).slice(0, 4).map(id => (
                                  <span key={id} className="text-[9px] px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    {VUCUT_BOLGELERI.find(b => b.id === id)?.label ?? id}
                                  </span>
                                ))}
                                {(kaza.yarali_vucut_bolgeleri?.length ?? 0) > 4 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'rgba(255,255,255,0.06)', color: '#475569' }}>
                                    +{(kaza.yarali_vucut_bolgeleri?.length ?? 0) - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: '#334155' }}>
                <i className="ri-information-line" />
                <span>* zorunlu alanlar</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#475569', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.35)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#475569'; }}
                >
                  <i className="ri-close-line" />İptal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="whitespace-nowrap flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold cursor-pointer text-white transition-all"
                  style={{
                    background: saving ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
                    opacity: saving ? 0.7 : 1,
                    boxShadow: saving ? 'none' : '0 0 20px rgba(239,68,68,0.3)',
                  }}
                  onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(239,68,68,0.5)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = saving ? 'none' : '0 0 20px rgba(239,68,68,0.3)'; }}
                >
                  {saving
                    ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</>
                    : <><i className={editData ? 'ri-save-3-line' : 'ri-add-circle-line'} />{editData ? 'Güncelle' : 'Kaydet'}</>
                  }
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
