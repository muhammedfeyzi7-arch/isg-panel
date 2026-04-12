import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface PersonelOption {
  id: string;
  adSoyad: string;
  gorev: string;
  firmaId: string;
}

interface MuayeneFormData {
  personelId: string;
  firmaId: string;
  muayeneTarihi: string;
  sonrakiTarih: string;
  sonuc: string;
  hastane: string;
  doktor: string;
  notlar: string;
}

interface HekimMuayeneModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  atanmisFirmaIds: string[];
  isDark: boolean;
  editData?: {
    id: string;
    personelId: string;
    firmaId: string;
    muayeneTarihi: string;
    sonrakiTarih: string;
    sonuc: string;
    hastane: string;
    doktor: string;
    notlar: string;
  } | null;
  preselectedPersonelId?: string | null;
}

const SONUC_OPTIONS = ['Çalışabilir', 'Kısıtlı Çalışabilir', 'Çalışamaz'];

const emptyForm: MuayeneFormData = {
  personelId: '',
  firmaId: '',
  muayeneTarihi: '',
  sonrakiTarih: '',
  sonuc: 'Çalışabilir',
  hastane: '',
  doktor: '',
  notlar: '',
};

export default function HekimMuayeneModal({
  open,
  onClose,
  onSaved,
  atanmisFirmaIds,
  isDark,
  editData,
  preselectedPersonelId,
}: HekimMuayeneModalProps) {
  const [form, setForm] = useState<MuayeneFormData>(emptyForm);
  const [personelOptions, setPersonelOptions] = useState<PersonelOption[]>([]);
  const [firmaAdMap, setFirmaAdMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<MuayeneFormData>>({});

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const modalBg = isDark ? '#1e293b' : '#ffffff';
  const labelColor = isDark ? '#94a3b8' : '#64748b';

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
      setForm({
        personelId: editData.personelId,
        firmaId: editData.firmaId,
        muayeneTarihi: editData.muayeneTarihi,
        sonrakiTarih: editData.sonrakiTarih,
        sonuc: editData.sonuc || 'Çalışabilir',
        hastane: editData.hastane || '',
        doktor: editData.doktor || '',
        notlar: editData.notlar || '',
      });
    } else if (preselectedPersonelId) {
      const p = personelOptions.find(x => x.id === preselectedPersonelId);
      setForm({ ...emptyForm, personelId: preselectedPersonelId, firmaId: p?.firmaId ?? '' });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [open, editData, preselectedPersonelId, personelOptions]);

  const handlePersonelChange = (personelId: string) => {
    const p = personelOptions.find(x => x.id === personelId);
    setForm(prev => ({ ...prev, personelId, firmaId: p?.firmaId ?? prev.firmaId }));
  };

  const validate = () => {
    const e: Partial<MuayeneFormData> = {};
    if (!form.personelId) e.personelId = 'Personel seçimi zorunludur';
    if (!form.muayeneTarihi) e.muayeneTarihi = 'Muayene tarihi zorunludur';
    if (!form.sonrakiTarih) e.sonrakiTarih = 'Sonraki muayene tarihi zorunludur';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        data: {
          personelId: form.personelId,
          muayeneTarihi: form.muayeneTarihi,
          sonrakiTarih: form.sonrakiTarih,
          sonuc: form.sonuc,
          hastane: form.hastane,
          doktor: form.doktor,
          notlar: form.notlar,
        },
        organization_id: form.firmaId,
      };
      if (editData) {
        await supabase.from('muayeneler').update(payload).eq('id', editData.id);
      } else {
        await supabase.from('muayeneler').insert(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[HekimMuayeneModal] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const filteredPersonel = form.firmaId
    ? personelOptions.filter(p => p.firmaId === form.firmaId)
    : personelOptions;

  const sonucColors: Record<string, { color: string; bg: string }> = {
    'Çalışabilir':        { color: ACCENT,     bg: `rgba(14,165,233,0.1)` },
    'Kısıtlı Çalışabilir': { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    'Çalışamaz':           { color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  };

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: modalBg,
          border: `1px solid ${borderColor}`,
          boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.6)' : '0 24px 80px rgba(15,23,42,0.15)',
          maxHeight: 'calc(100vh - 40px)',
        }}
      >
        {/* Top accent bar */}
        <div className="h-[3px] flex-shrink-0" style={{ background: `linear-gradient(90deg, ${ACCENT_DARK}, ${ACCENT}, #38BDF8)` }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `rgba(14,165,233,0.12)`, border: `1px solid rgba(14,165,233,0.25)` }}>
              <i className="ri-stethoscope-line text-sm" style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>
                {editData ? 'Muayene Düzenle' : 'Yeni Muayene Kaydı'}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                {editData ? 'Mevcut kaydı güncelle' : 'Personele yeni muayene ekle'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.color = textSecondary; }}>
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Firma */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Firma</label>
            <select
              value={form.firmaId}
              onChange={e => setForm(prev => ({ ...prev, firmaId: e.target.value, personelId: '' }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: inputBg, border: `1.5px solid ${borderColor}`, color: textPrimary }}
              onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
            >
              <option value="">Tüm Firmalar</option>
              {Object.entries(firmaAdMap).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {/* Personel */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
              Personel <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={form.personelId}
              onChange={e => handlePersonelChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: inputBg, border: `1.5px solid ${errors.personelId ? '#EF4444' : borderColor}`, color: textPrimary }}
              onFocus={e => { e.currentTarget.style.borderColor = errors.personelId ? '#EF4444' : ACCENT; }}
              onBlur={e => { e.currentTarget.style.borderColor = errors.personelId ? '#EF4444' : borderColor; }}
            >
              <option value="">Personel Seçin</option>
              {filteredPersonel.map(p => (
                <option key={p.id} value={p.id}>{p.adSoyad}{p.gorev ? ` — ${p.gorev}` : ''}</option>
              ))}
            </select>
            {errors.personelId && <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>{errors.personelId}</p>}
          </div>

          {/* Tarihler */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
                Muayene Tarihi <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date" value={form.muayeneTarihi}
                onChange={e => setForm(prev => ({ ...prev, muayeneTarihi: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: inputBg, border: `1.5px solid ${errors.muayeneTarihi ? '#EF4444' : borderColor}`, color: textPrimary }}
                onFocus={e => { e.currentTarget.style.borderColor = errors.muayeneTarihi ? '#EF4444' : ACCENT; }}
                onBlur={e => { e.currentTarget.style.borderColor = errors.muayeneTarihi ? '#EF4444' : borderColor; }}
              />
              {errors.muayeneTarihi && <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>{errors.muayeneTarihi}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
                Sonraki Muayene <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date" value={form.sonrakiTarih}
                onChange={e => setForm(prev => ({ ...prev, sonrakiTarih: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: inputBg, border: `1.5px solid ${errors.sonrakiTarih ? '#EF4444' : borderColor}`, color: textPrimary }}
                onFocus={e => { e.currentTarget.style.borderColor = errors.sonrakiTarih ? '#EF4444' : ACCENT; }}
                onBlur={e => { e.currentTarget.style.borderColor = errors.sonrakiTarih ? '#EF4444' : borderColor; }}
              />
              {errors.sonrakiTarih && <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>{errors.sonrakiTarih}</p>}
            </div>
          </div>

          {/* Sonuç */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Muayene Sonucu</label>
            <div className="flex gap-2">
              {SONUC_OPTIONS.map(opt => {
                const cfg = sonucColors[opt];
                const isActive = form.sonuc === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setForm(prev => ({ ...prev, sonuc: opt }))}
                    className="flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap"
                    style={{
                      background: isActive ? cfg.bg : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
                      color: isActive ? cfg.color : textSecondary,
                      border: `1.5px solid ${isActive ? cfg.color + '55' : borderColor}`,
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hastane & Doktor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Hastane / Klinik</label>
              <input
                type="text" value={form.hastane}
                onChange={e => setForm(prev => ({ ...prev, hastane: e.target.value }))}
                placeholder="Hastane adı..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: inputBg, border: `1.5px solid ${borderColor}`, color: textPrimary }}
                onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Hekim Adı</label>
              <input
                type="text" value={form.doktor}
                onChange={e => setForm(prev => ({ ...prev, doktor: e.target.value }))}
                placeholder="Dr. Ad Soyad..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: inputBg, border: `1.5px solid ${borderColor}`, color: textPrimary }}
                onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
              />
            </div>
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Notlar</label>
            <textarea
              value={form.notlar}
              onChange={e => setForm(prev => ({ ...prev, notlar: e.target.value }))}
              placeholder="Muayene notları, kısıtlamalar, öneriler..."
              rows={3} maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all resize-none"
              style={{ background: inputBg, border: `1.5px solid ${borderColor}`, color: textPrimary }}
              onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
            />
            <p className="text-[10px] text-right mt-1" style={{ color: textSecondary }}>{form.notlar.length}/500</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 flex-shrink-0"
          style={{ borderTop: `1px solid ${borderColor}` }}>
          <button
            onClick={onClose}
            className="whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }}
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all text-white"
            style={{ background: saving ? `rgba(14,165,233,0.5)` : `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})`, opacity: saving ? 0.7 : 1 }}
          >
            {saving
              ? <><i className="ri-loader-4-line animate-spin text-sm" />Kaydediliyor...</>
              : <><i className={editData ? 'ri-save-line' : 'ri-add-line'} />{editData ? 'Güncelle' : 'Kaydet'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
