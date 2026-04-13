import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { generateEK2Docx } from '@/pages/hekim/utils/ek2DocxGenerator';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface PersonelOption {
  id: string;
  adSoyad: string;
  gorev: string;
  firmaId: string;
  firmaAd: string;
}

interface Ek2FormData {
  // Bölüm 1 — Temel
  personelId: string;
  firmaId: string;
  // Bölüm 2 — Sağlık Beyanı
  kronikHastaliklar: string;
  ilacKullanim: string;
  ameliyatGecmisi: string;
  // Bölüm 3 — Bulgular
  tansiyon: string;
  nabiz: string;
  gorme: string;
  isitme: string;
  // Bölüm 4 — Karar
  sonuc: string;
  aciklama: string;
  // Bölüm 5 — Takip
  muayeneTarihi: string;
  sonrakiTarih: string;
  // Hekim bilgisi
  doktor: string;
  hastane: string;
}

interface HekimMuayeneModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  atanmisFirmaIds: string[];
  isDark: boolean;
  hekimOrgId?: string;
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
    // EK-2 alanları
    kronikHastaliklar?: string;
    ilacKullanim?: string;
    ameliyatGecmisi?: string;
    tansiyon?: string;
    nabiz?: string;
    gorme?: string;
    isitme?: string;
    aciklama?: string;
  } | null;
  preselectedPersonelId?: string | null;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const SONUC_OPTIONS = [
  { value: 'uygun',       label: 'Çalışabilir',          color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  { value: 'kisitli',     label: 'Kısıtlı Çalışabilir',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  { value: 'uygun_degil', label: 'Çalışamaz',            color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
];

const emptyForm: Ek2FormData = {
  personelId: '', firmaId: '',
  kronikHastaliklar: '', ilacKullanim: '', ameliyatGecmisi: '',
  tansiyon: '', nabiz: '', gorme: '', isitme: '',
  sonuc: 'uygun', aciklama: '',
  muayeneTarihi: new Date().toISOString().split('T')[0],
  sonrakiTarih: '',
  doktor: '', hastane: '',
};

type TabKey = 'saglik' | 'bulgular' | 'karar';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'saglik',   label: 'Sağlık Beyanı', icon: 'ri-heart-pulse-line' },
  { key: 'bulgular', label: 'Bulgular',       icon: 'ri-stethoscope-line' },
  { key: 'karar',    label: 'Karar & Takip',  icon: 'ri-checkbox-circle-line' },
];

export default function HekimMuayeneModal({
  open, onClose, onSaved, atanmisFirmaIds, isDark, hekimOrgId, editData, preselectedPersonelId, addToast,
}: HekimMuayeneModalProps) {
  const [form, setForm] = useState<Ek2FormData>(emptyForm);
  const [activeTab, setActiveTab] = useState<TabKey>('saglik');
  const [personelOptions, setPersonelOptions] = useState<PersonelOption[]>([]);
  const [firmaAdMap, setFirmaAdMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Ek2FormData, string>>>({});

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const modalBg = isDark ? '#1e293b' : '#ffffff';
  const labelColor = isDark ? '#94a3b8' : '#64748b';
  const sectionBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';

  // Firma ve personel yükle
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
        const { data: rows } = await supabase
          .from('personeller').select('id, data')
          .eq('organization_id', firmaId).is('deleted_at', null);
        (rows ?? []).forEach(r => {
          const d = r.data as Record<string, unknown>;
          allPersonel.push({
            id: r.id,
            adSoyad: (d.adSoyad as string) ?? '',
            gorev: (d.gorev as string) ?? '',
            firmaId,
            firmaAd: adMap[firmaId] ?? firmaId,
          });
        });
      }));
      setPersonelOptions(allPersonel);
    };
    load();
  }, [open, atanmisFirmaIds]);

  // Form doldur (edit veya yeni)
  useEffect(() => {
    if (!open) return;
    setActiveTab('saglik');
    setFieldErrors({});
    if (editData) {
      setForm({
        personelId: editData.personelId ?? '',
        firmaId: editData.firmaId ?? '',
        kronikHastaliklar: editData.kronikHastaliklar ?? '',
        ilacKullanim: editData.ilacKullanim ?? '',
        ameliyatGecmisi: editData.ameliyatGecmisi ?? '',
        tansiyon: editData.tansiyon ?? '',
        nabiz: editData.nabiz ?? '',
        gorme: editData.gorme ?? '',
        isitme: editData.isitme ?? '',
        sonuc: editData.sonuc ?? 'uygun',
        aciklama: editData.aciklama ?? editData.notlar ?? '',
        muayeneTarihi: editData.muayeneTarihi ?? new Date().toISOString().split('T')[0],
        sonrakiTarih: editData.sonrakiTarih ?? '',
        doktor: editData.doktor ?? '',
        hastane: editData.hastane ?? '',
      });
    } else if (preselectedPersonelId) {
      const p = personelOptions.find(x => x.id === preselectedPersonelId);
      setForm({ ...emptyForm, personelId: preselectedPersonelId, firmaId: p?.firmaId ?? '' });
    } else {
      setForm(emptyForm);
    }
  }, [open, editData, preselectedPersonelId, personelOptions]);

  const set = (key: keyof Ek2FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handlePersonelChange = (personelId: string) => {
    const p = personelOptions.find(x => x.id === personelId);
    setForm(prev => ({ ...prev, personelId, firmaId: p?.firmaId ?? prev.firmaId }));
    if (fieldErrors.personelId) setFieldErrors(prev => ({ ...prev, personelId: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof Ek2FormData, string>> = {};
    if (!form.personelId) e.personelId = 'Personel seçimi zorunludur';
    if (!form.muayeneTarihi) e.muayeneTarihi = 'Muayene tarihi zorunludur';
    if (!form.sonuc) e.sonuc = 'Sonuç zorunludur';
    setFieldErrors(e);
    if (Object.keys(e).length > 0) {
      const firstErrTab = e.personelId || e.muayeneTarihi ? 'saglik' : 'karar';
      setActiveTab(firstErrTab);
      addToast?.('Zorunlu alanlar eksik, lütfen kontrol edin.', 'error');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) return;
    setSaving(true);
    try {
      // organization_id: selected firma > hekim's assigned org
      const orgId = form.firmaId || hekimOrgId || atanmisFirmaIds[0];
      if (!orgId) {
        addToast?.('Firma / organizasyon bilgisi bulunamadı.', 'error');
        setSaving(false);
        return;
      }

      const dataPayload = {
        ek2: true,
        personelId: form.personelId,
        muayeneTarihi: form.muayeneTarihi,
        sonrakiTarih: form.sonrakiTarih,
        // Sonuç — EK-2 değer map
        sonuc: form.sonuc,
        aciklama: form.aciklama,
        // Sağlık beyanı
        kronikHastaliklar: form.kronikHastaliklar,
        ilacKullanim: form.ilacKullanim,
        ameliyatGecmisi: form.ameliyatGecmisi,
        // Bulgular
        tansiyon: form.tansiyon,
        nabiz: form.nabiz,
        gorme: form.gorme,
        isitme: form.isitme,
        // Hekim
        doktor: form.doktor,
        hastane: form.hastane,
        // Geriye dönük uyumluluk
        notlar: form.aciklama,
      };

      // user_id zorunlu alan — mevcut oturumdaki kullanıcıyı al
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        addToast?.('Oturum bilgisi alınamadı. Lütfen yeniden giriş yapın.', 'error');
        setSaving(false);
        return;
      }

      const payload = {
        data: dataPayload,
        organization_id: orgId,
        user_id: userId,
      };

      let error: { message?: string } | null = null;

      if (editData?.id) {
        const res = await supabase.from('muayeneler').update(payload).eq('id', editData.id);
        error = res.error;
      } else {
        // id kolonu text tipinde, default yok — manuel UUID üret
        const res = await supabase.from('muayeneler').insert({ ...payload, id: crypto.randomUUID() });
        error = res.error;
      }

      if (error) {
        console.error('[HekimMuayeneModal] Supabase error:', error);
        addToast?.(`Kayıt hatası: ${error.message ?? 'Bilinmeyen hata'}`, 'error');
        return;
      }

      addToast?.(editData ? 'Kayıt güncellendi.' : 'Kayıt oluşturuldu.', 'success');
      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error('[HekimMuayeneModal] unexpected error:', err);
      const msg = err instanceof Error ? err.message : 'Beklenmeyen hata oluştu.';
      addToast?.(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const filteredPersonel = form.firmaId
    ? personelOptions.filter(p => p.firmaId === form.firmaId)
    : personelOptions;

  const selectedPersonel = personelOptions.find(p => p.id === form.personelId);

  const inputStyle = (hasError?: boolean) => ({
    background: inputBg,
    border: `1.5px solid ${hasError ? '#EF4444' : borderColor}`,
    color: textPrimary,
  });

  const inputClass = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all';

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: modalBg,
          border: `1px solid ${borderColor}`,
          maxHeight: 'calc(100vh - 40px)',
        }}
      >
        {/* Accent bar */}
        <div className="h-[3px] flex-shrink-0" style={{ background: `linear-gradient(90deg, ${ACCENT_DARK}, ${ACCENT}, #38BDF8)` }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)' }}>
              <i className="ri-stethoscope-line text-sm" style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>
                {editData ? 'EK-2 Muayene Düzenle' : 'EK-2 Periyodik Muayene Formu'}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                İş Sağlığı ve Güvenliği — Sağlık Gözetimi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Word İndir butonu — sadece edit modunda (kayıtlı veri varsa) */}
            {editData && (
              <button
                onClick={async () => {
                  const selectedP = personelOptions.find(p => p.id === form.personelId);
                  try {
                    await generateEK2Docx({
                      personelAd: selectedP?.adSoyad ?? 'Personel',
                      personelGorev: selectedP?.gorev,
                      firmaAd: selectedP ? (firmaAdMap[selectedP.firmaId] ?? '') : (firmaAdMap[form.firmaId] ?? ''),
                      kronikHastaliklar: form.kronikHastaliklar,
                      ilacKullanim: form.ilacKullanim,
                      ameliyatGecmisi: form.ameliyatGecmisi,
                      tansiyon: form.tansiyon,
                      nabiz: form.nabiz,
                      gorme: form.gorme,
                      isitme: form.isitme,
                      sonuc: form.sonuc,
                      aciklama: form.aciklama,
                      doktor: form.doktor,
                      hastane: form.hastane,
                      muayeneTarihi: form.muayeneTarihi,
                      sonrakiTarih: form.sonrakiTarih,
                    });
                    addToast?.('Word belgesi indiriliyor...', 'success');
                  } catch (err) {
                    addToast?.('Word oluşturulurken hata oluştu.', 'error');
                    console.error('[EK2 Word]', err);
                  }
                }}
                className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.1)'; }}
              >
                <i className="ri-file-word-line text-xs" />
                Word İndir
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.color = textSecondary; }}>
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {/* Personel + Firma seçimi (her zaman görünür) */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0 grid grid-cols-2 gap-3"
          style={{ borderBottom: `1px solid ${borderColor}`, background: sectionBg }}>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
              Firma
            </label>
            <select
              value={form.firmaId}
              onChange={e => setForm(prev => ({ ...prev, firmaId: e.target.value, personelId: '' }))}
              className={inputClass}
              style={inputStyle()}
              onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
            >
              <option value="">Tüm Firmalar</option>
              {Object.entries(firmaAdMap).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
              Personel <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={form.personelId}
              onChange={e => handlePersonelChange(e.target.value)}
              className={inputClass}
              style={inputStyle(!!fieldErrors.personelId)}
              onFocus={e => { e.currentTarget.style.borderColor = fieldErrors.personelId ? '#EF4444' : ACCENT; }}
              onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.personelId ? '#EF4444' : borderColor; }}
            >
              <option value="">Personel Seçin</option>
              {filteredPersonel.map(p => (
                <option key={p.id} value={p.id}>{p.adSoyad}{p.gorev ? ` — ${p.gorev}` : ''}</option>
              ))}
            </select>
            {fieldErrors.personelId && <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>{fieldErrors.personelId}</p>}
          </div>

          {/* Seçilen personel bilgisi */}
          {selectedPersonel && (
            <div className="col-span-2 flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}>
                {selectedPersonel.adSoyad.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: textPrimary }}>{selectedPersonel.adSoyad}</p>
                <p className="text-[10px]" style={{ color: textSecondary }}>{selectedPersonel.gorev || 'Görev belirtilmemiş'} · {selectedPersonel.firmaAd}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 py-2.5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${borderColor}` }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
              style={{
                background: activeTab === tab.key ? 'rgba(14,165,233,0.12)' : 'transparent',
                color: activeTab === tab.key ? ACCENT : textSecondary,
                border: `1px solid ${activeTab === tab.key ? 'rgba(14,165,233,0.3)' : 'transparent'}`,
              }}
            >
              <i className={`${tab.icon} text-xs`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form içeriği — scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* TAB: Sağlık Beyanı */}
          {activeTab === 'saglik' && (
            <>
              <div className="rounded-xl p-4 space-y-3" style={{ background: sectionBg, border: `1px solid ${borderColor}` }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                  <i className="ri-heart-pulse-line mr-1.5" />Kronik Hastalıklar
                </p>
                <textarea
                  value={form.kronikHastaliklar}
                  onChange={set('kronikHastaliklar')}
                  placeholder="Diyabet, hipertansiyon, astım, kalp hastalığı vb."
                  rows={3} maxLength={500}
                  className={`${inputClass} resize-none`}
                  style={inputStyle()}
                  onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                  onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
                />
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: sectionBg, border: `1px solid ${borderColor}` }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                  <i className="ri-capsule-line mr-1.5" />İlaç Kullanımı
                </p>
                <textarea
                  value={form.ilacKullanim}
                  onChange={set('ilacKullanim')}
                  placeholder="Düzenli kullanılan ilaçlar (ad, doz, süre)..."
                  rows={3} maxLength={500}
                  className={`${inputClass} resize-none`}
                  style={inputStyle()}
                  onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                  onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
                />
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: sectionBg, border: `1px solid ${borderColor}` }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                  <i className="ri-surgical-mask-line mr-1.5" />Ameliyat Geçmişi
                </p>
                <textarea
                  value={form.ameliyatGecmisi}
                  onChange={set('ameliyatGecmisi')}
                  placeholder="Geçirilmiş ameliyatlar, tarihler, komplikasyonlar..."
                  rows={3} maxLength={500}
                  className={`${inputClass} resize-none`}
                  style={inputStyle()}
                  onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                  onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
                />
              </div>

              {/* Hekim bilgisi de buraya */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: sectionBg, border: `1px solid ${borderColor}` }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                  <i className="ri-hospital-line mr-1.5" />Hekim Bilgisi
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: labelColor }}>Hastane / Klinik</label>
                    <input type="text" value={form.hastane} onChange={set('hastane')}
                      placeholder="Hastane adı..."
                      className={inputClass} style={inputStyle()}
                      onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                      onBlur={e => { e.currentTarget.style.borderColor = borderColor; }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: labelColor }}>Hekim Adı</label>
                    <input type="text" value={form.doktor} onChange={set('doktor')}
                      placeholder="Dr. Ad Soyad..."
                      className={inputClass} style={inputStyle()}
                      onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                      onBlur={e => { e.currentTarget.style.borderColor = borderColor; }} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB: Bulgular */}
          {activeTab === 'bulgular' && (
            <div className="rounded-xl p-4 space-y-4" style={{ background: sectionBg, border: `1px solid ${borderColor}` }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                <i className="ri-stethoscope-line mr-1.5" />Muayene Bulguları
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'tansiyon' as const, label: 'Tansiyon', placeholder: 'ör. 120/80 mmHg', icon: 'ri-heart-line' },
                  { key: 'nabiz'    as const, label: 'Nabız',    placeholder: 'ör. 72 atım/dk',  icon: 'ri-pulse-line' },
                  { key: 'gorme'    as const, label: 'Görme',    placeholder: 'ör. Sağ: 1.0 Sol: 0.8', icon: 'ri-eye-line' },
                  { key: 'isitme'   as const, label: 'İşitme',   placeholder: 'ör. Normal / Azalmış',  icon: 'ri-sound-module-line' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold mb-1.5" style={{ color: labelColor }}>
                      <i className={`${field.icon} text-[10px]`} style={{ color: ACCENT }} />
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={form[field.key]}
                      onChange={set(field.key)}
                      placeholder={field.placeholder}
                      className={inputClass}
                      style={inputStyle()}
                      onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                      onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-3 mt-2"
                style={{ background: isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.15)' }}>
                <p className="text-[10px]" style={{ color: textSecondary }}>
                  <i className="ri-information-line mr-1" style={{ color: ACCENT }} />
                  Boş bırakılan bulgular &quot;Değerlendirilmedi&quot; olarak rapora yansıyacaktır.
                </p>
              </div>
            </div>
          )}

          {/* TAB: Karar & Takip */}
          {activeTab === 'karar' && (
            <>
              <div className="rounded-xl p-4 space-y-3" style={{ background: sectionBg, border: `1px solid ${borderColor}` }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                  <i className="ri-checkbox-circle-line mr-1.5" />Muayene Kararı
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SONUC_OPTIONS.map(opt => {
                    const isActive = form.sonuc === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { setForm(prev => ({ ...prev, sonuc: opt.value })); setFieldErrors(prev => ({ ...prev, sonuc: undefined })); }}
                        className="py-3 rounded-xl text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap flex flex-col items-center gap-1"
                        style={{
                          background: isActive ? opt.bg : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
                          color: isActive ? opt.color : textSecondary,
                          border: `2px solid ${isActive ? opt.color : borderColor}`,
                        }}
                      >
                        <i className={`text-base ${opt.value === 'uygun' ? 'ri-checkbox-circle-line' : opt.value === 'kisitli' ? 'ri-alert-line' : 'ri-close-circle-line'}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.sonuc && <p className="text-[10px]" style={{ color: '#EF4444' }}>{fieldErrors.sonuc}</p>}

                <div className="mt-1">
                  <label className="block text-[11px] font-semibold mb-1.5" style={{ color: labelColor }}>
                    Karar Açıklaması / Kısıtlamalar
                  </label>
                  <textarea
                    value={form.aciklama}
                    onChange={set('aciklama')}
                    placeholder="Kısıtlamalar, öneriler, notlar..."
                    rows={3} maxLength={500}
                    className={`${inputClass} resize-none`}
                    style={inputStyle()}
                    onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                    onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
                  />
                  <p className="text-[10px] text-right mt-0.5" style={{ color: textSecondary }}>{form.aciklama.length}/500</p>
                </div>
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: sectionBg, border: `1px solid ${borderColor}` }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                  <i className="ri-calendar-event-line mr-1.5" />Takip Tarihleri
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: labelColor }}>
                      Muayene Tarihi <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="date" value={form.muayeneTarihi}
                      onChange={set('muayeneTarihi')}
                      className={inputClass}
                      style={inputStyle(!!fieldErrors.muayeneTarihi)}
                      onFocus={e => { e.currentTarget.style.borderColor = fieldErrors.muayeneTarihi ? '#EF4444' : ACCENT; }}
                      onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.muayeneTarihi ? '#EF4444' : borderColor; }}
                    />
                    {fieldErrors.muayeneTarihi && <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>{fieldErrors.muayeneTarihi}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: labelColor }}>
                      Sonraki Muayene
                    </label>
                    <input
                      type="date" value={form.sonrakiTarih}
                      onChange={set('sonrakiTarih')}
                      className={inputClass}
                      style={inputStyle()}
                      onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
                      onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: `1px solid ${borderColor}`, background: modalBg }}>
          {/* Tab navigation */}
          <div className="flex items-center gap-1.5">
            {TABS.map((tab, idx) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="w-2.5 h-2.5 rounded-full cursor-pointer transition-all"
                style={{
                  background: activeTab === tab.key ? ACCENT : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.15)'),
                  transform: activeTab === tab.key ? 'scale(1.3)' : 'scale(1)',
                }}
                title={TABS[idx].label}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Prev / Next */}
            {activeTab !== 'saglik' && (
              <button
                onClick={() => setActiveTab(activeTab === 'karar' ? 'bulgular' : 'saglik')}
                className="whitespace-nowrap px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }}
              >
                <i className="ri-arrow-left-line mr-1" />Geri
              </button>
            )}
            {activeTab !== 'karar' ? (
              <button
                onClick={() => setActiveTab(activeTab === 'saglik' ? 'bulgular' : 'karar')}
                className="whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all text-white"
                style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
              >
                İleri<i className="ri-arrow-right-line ml-1" />
              </button>
            ) : (
              <>
                <button onClick={onClose}
                  className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }}>
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="whitespace-nowrap flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all text-white"
                  style={{ background: saving ? 'rgba(14,165,233,0.5)' : `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})`, opacity: saving ? 0.7 : 1 }}
                >
                  {saving
                    ? <><i className="ri-loader-4-line animate-spin text-sm" />Kaydediliyor...</>
                    : <><i className={editData ? 'ri-save-line' : 'ri-add-line'} />{editData ? 'Güncelle' : 'Kaydet'}</>
                  }
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
