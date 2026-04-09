import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import type { Uygunsuzluk, UygunsuzlukSeverity } from '@/types';
import { SEV_CONFIG } from '@/pages/nonconformity/utils/statusHelper';
import { uploadFileToStorage, getSignedUrlFromPath } from '@/utils/fileUpload';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editRecord?: Uygunsuzluk | null;
}

type FormState = {
  baslik: string;
  aciklama: string;
  onlem: string;
  firmaId: string;
  personelId: string;
  tarih: string;
  severity: UygunsuzlukSeverity;
  sorumlu: string;
  hedefTarih: string;
  notlar: string;
  acilisFoto: string | null;
};

const defaultForm: FormState = {
  baslik: '',
  aciklama: '',
  onlem: '',
  firmaId: '',
  personelId: '',
  tarih: new Date().toISOString().slice(0, 10),
  severity: 'Orta',
  sorumlu: '',
  hedefTarih: '',
  notlar: '',
  acilisFoto: null,
};

const SEV_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'Düşük':   { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)' },
  'Orta':    { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
  'Yüksek':  { color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  'Kritik':  { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
};

// ─── Mobil Fotoğraf Yükleme ───────────────────────────────────────────────────
function SahaFotoUpload({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { org } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setPreviewUrl(null); return; }
    if (value.startsWith('data:') || value.startsWith('http')) { setPreviewUrl(value); return; }
    getSignedUrlFromPath(value).then(url => setPreviewUrl(url));
  }, [value]);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return;
    setLoading(true);
    // Anlık preview
    const reader = new FileReader();
    reader.onload = e => { if (e.target?.result) setPreviewUrl(e.target.result as string); };
    reader.readAsDataURL(file);
    try {
      const orgId = org?.id ?? 'unknown';
      const filePath = await uploadFileToStorage(file, orgId, 'dof', crypto.randomUUID());
      if (filePath) {
        onChange(filePath);
        const signed = await getSignedUrlFromPath(filePath);
        if (signed) setPreviewUrl(signed);
      } else {
        // Fallback base64
        const r = new FileReader();
        r.onload = e2 => { if (e2.target?.result) { onChange(e2.target.result as string); setPreviewUrl(e2.target.result as string); } };
        r.readAsDataURL(file);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-5 rounded-2xl" style={{ background: 'rgba(52,211,153,0.05)', border: '1px dashed rgba(52,211,153,0.2)' }}>
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(52,211,153,0.4)', borderTopColor: 'transparent' }} />
        <span className="text-xs font-medium" style={{ color: '#34D399' }}>Yükleniyor...</span>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(52,211,153,0.25)' }}>
        <img src={previewUrl} alt="Fotoğraf" className="w-full object-cover" style={{ maxHeight: '200px', objectFit: 'contain', background: 'rgba(0,0,0,0.3)' }} />
        <div className="flex items-center justify-between px-3 py-2" style={{ background: 'rgba(52,211,153,0.08)' }}>
          <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#34D399' }}>
            <i className="ri-cloud-line" />Fotoğraf yüklendi
          </span>
          <button onClick={() => { onChange(null); setPreviewUrl(null); }} className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
            <i className="ri-delete-bin-line text-xs" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl cursor-pointer transition-all"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      >
        <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(99,102,241,0.12)' }}>
          <i className="ri-image-line text-lg" style={{ color: '#818CF8' }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: '#818CF8' }}>Galeriden</span>
      </button>
      <button
        type="button"
        onClick={() => camRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl cursor-pointer transition-all"
        style={{ background: 'rgba(52,211,153,0.05)', border: '1px dashed rgba(52,211,153,0.2)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.05)'; }}
      >
        <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(52,211,153,0.12)' }}>
          <i className="ri-camera-line text-lg" style={{ color: '#34D399' }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: '#34D399' }}>Kamera</span>
      </button>
    </div>
  );
}

// ─── Ana Form Bileşeni ────────────────────────────────────────────────────────
export default function SahaUygunsuzlukForm({ isOpen, onClose, editRecord }: Props) {
  const { firmalar, personeller, addUygunsuzluk, updateUygunsuzluk, setUygunsuzlukPhoto, getUygunsuzlukPhoto, addToast } = useApp();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const submittingRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) { setStep(1); return; }
    if (editRecord) {
      const existingPhoto = getUygunsuzlukPhoto(editRecord.id, 'acilis') ?? null;
      setForm({
        baslik: editRecord.baslik,
        aciklama: editRecord.aciklama,
        onlem: editRecord.onlem ?? '',
        firmaId: editRecord.firmaId,
        personelId: editRecord.personelId ?? '',
        tarih: editRecord.tarih,
        severity: editRecord.severity,
        sorumlu: editRecord.sorumlu ?? '',
        hedefTarih: editRecord.hedefTarih ?? '',
        notlar: editRecord.notlar ?? '',
        acilisFoto: existingPhoto,
      });
    } else {
      setForm(defaultForm);
    }
    setStep(1);
  }, [isOpen, editRecord, getUygunsuzlukPhoto]);

  // Body scroll kilitle
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const filteredPersoneller = useMemo(
    () => form.firmaId
      ? personeller.filter(p => p.firmaId === form.firmaId && !p.silinmis)
      : personeller.filter(p => !p.silinmis),
    [personeller, form.firmaId],
  );

  const set = (key: keyof FormState, val: string | null) =>
    setForm(prev => ({ ...prev, [key]: val as string }));

  const handleAiOneri = async () => {
    if (!form.aciklama.trim()) { addToast('Önce açıklama girin.', 'error'); return; }
    setAiLoading(true);
    try {
      const firmaAdi = firmalar.find(f => f.id === form.firmaId)?.ad || '';
      const res = await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/openai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          mode: 'uygunsuzluk',
          data: { baslik: form.baslik, aciklama: form.aciklama, severity: form.severity, firmaAdi },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Hata');
      setForm(prev => ({ ...prev, onlem: json.data.onlem || prev.onlem }));
      addToast('AI önlem önerisi oluşturuldu!', 'success');
    } catch (e) {
      addToast(`AI hatası: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const canGoStep2 = form.baslik.trim() && form.firmaId;

  const handleSave = async () => {
    if (!form.baslik.trim()) { addToast('Başlık zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      if (editRecord) {
        let acilisFotoUrl: string | undefined;
        if (form.acilisFoto && form.acilisFoto.startsWith('data:')) {
          const uploaded = await setUygunsuzlukPhoto(editRecord.id, 'acilis', form.acilisFoto);
          acilisFotoUrl = uploaded ?? undefined;
        } else if (form.acilisFoto) {
          acilisFotoUrl = form.acilisFoto;
        }
        updateUygunsuzluk(editRecord.id, {
          baslik: form.baslik.trim(), aciklama: form.aciklama.trim(), onlem: form.onlem.trim(),
          firmaId: form.firmaId, personelId: form.personelId || undefined, tarih: form.tarih,
          severity: form.severity, sorumlu: form.sorumlu.trim(), hedefTarih: form.hedefTarih,
          notlar: form.notlar.trim(), acilisFotoMevcut: !!acilisFotoUrl, acilisFotoUrl,
        });
        addToast('Uygunsuzluk güncellendi.', 'success');
      } else {
        let acilisFotoUrl: string | undefined;
        if (form.acilisFoto && form.acilisFoto.startsWith('data:')) {
          const tempId = `temp-${Date.now()}`;
          const uploaded = await setUygunsuzlukPhoto(tempId, 'acilis', form.acilisFoto);
          acilisFotoUrl = uploaded ?? undefined;
        } else if (form.acilisFoto) {
          acilisFotoUrl = form.acilisFoto;
        }
        addUygunsuzluk({
          baslik: form.baslik.trim(), aciklama: form.aciklama.trim(), onlem: form.onlem.trim(),
          firmaId: form.firmaId, personelId: form.personelId || undefined, tarih: form.tarih,
          severity: form.severity, sorumlu: form.sorumlu.trim(), hedefTarih: form.hedefTarih,
          notlar: form.notlar.trim(), durum: 'Açık',
          acilisFotoMevcut: !!acilisFotoUrl, acilisFotoUrl, kapatmaFotoMevcut: false,
        });
        addToast('Uygunsuzluk kaydı oluşturuldu.', 'success');
      }
      onClose();
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  const sevCfg = SEV_COLORS[form.severity] ?? SEV_COLORS['Orta'];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="w-full flex flex-col rounded-t-3xl"
        style={{
          background: 'linear-gradient(180deg, #0F172A 0%, #0B1120 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          maxHeight: '92vh',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)' }}>
              <i className={`${editRecord ? 'ri-edit-line' : 'ri-add-circle-line'} text-base`} style={{ color: '#F87171' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {editRecord ? 'Uygunsuzluk Düzenle' : 'Yeni Uygunsuzluk Kaydı'}
              </p>
              <p className="text-[10px]" style={{ color: '#475569' }}>
                {editRecord ? `#${editRecord.acilisNo}` : `Adım ${step}/2`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}
          >
            <i className="ri-close-line text-base" />
          </button>
        </div>

        {/* Adım göstergesi (sadece yeni kayıtta) */}
        {!editRecord && (
          <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: step >= s ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)',
                    color: step >= s ? '#F87171' : '#475569',
                    border: `1px solid ${step >= s ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {step > s ? <i className="ri-check-line text-[10px]" /> : s}
                </div>
                <span className="text-[10px] font-semibold" style={{ color: step >= s ? '#F87171' : '#475569' }}>
                  {s === 1 ? 'Temel Bilgiler' : 'Detaylar & Fotoğraf'}
                </span>
                {s < 2 && <div className="flex-1 h-px" style={{ background: step > s ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)' }} />}
              </div>
            ))}
          </div>
        )}

        {/* Form İçeriği */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>

          {/* ── ADIM 1 ── */}
          {(step === 1 || editRecord) && (
            <>
              {/* Başlık */}
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#94A3B8' }}>
                  Uygunsuzluk Başlığı <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  value={form.baslik}
                  onChange={e => set('baslik', e.target.value)}
                  placeholder="Kısa ve açıklayıcı başlık..."
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Firma */}
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#94A3B8' }}>
                  Firma <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={form.firmaId}
                  onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                >
                  <option value="">Firma Seçin</option>
                  {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
                </select>
              </div>

              {/* Önem Derecesi — görsel seçici */}
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: '#94A3B8' }}>Önem Derecesi</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(SEV_COLORS) as UygunsuzlukSeverity[]).map(sev => {
                    const cfg = SEV_COLORS[sev];
                    const isSelected = form.severity === sev;
                    return (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, severity: sev }))}
                        className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl cursor-pointer transition-all"
                        style={{
                          background: isSelected ? cfg.bg : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected ? cfg.border : 'rgba(255,255,255,0.07)'}`,
                        }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                        <span className="text-[10px] font-bold" style={{ color: isSelected ? cfg.color : '#475569' }}>{sev}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tarih + Personel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#94A3B8' }}>Tespit Tarihi</label>
                  <input
                    type="date"
                    value={form.tarih}
                    onChange={e => set('tarih', e.target.value)}
                    className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#94A3B8' }}>Personel</label>
                  <select
                    value={form.personelId}
                    onChange={e => set('personelId', e.target.value)}
                    className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Seçin</option>
                    {filteredPersoneller.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── ADIM 2 ── */}
          {(step === 2 || editRecord) && (
            <>
              {/* Açıklama */}
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: '#94A3B8' }}>Uygunsuzluk Açıklaması</label>
                <textarea
                  value={form.aciklama}
                  onChange={e => set('aciklama', e.target.value)}
                  placeholder="Tespit edilen uygunsuzluğun detaylı açıklaması..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                />
                <p className="text-[10px] text-right mt-1" style={{ color: '#334155' }}>{form.aciklama.length}/500</p>
              </div>

              {/* Önlem */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold" style={{ color: '#94A3B8' }}>Alınması Gereken Önlem</label>
                  <button
                    type="button"
                    onClick={() => void handleAiOneri()}
                    disabled={aiLoading || !form.aciklama.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap disabled:opacity-40"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.25)' }}
                  >
                    {aiLoading
                      ? <><i className="ri-loader-4-line animate-spin" />Öneriliyor...</>
                      : <><i className="ri-sparkling-line" />AI Öneri</>
                    }
                  </button>
                </div>
                <textarea
                  value={form.onlem}
                  onChange={e => set('onlem', e.target.value)}
                  placeholder="Uygunsuzluğun giderilmesi için alınacak önlemler..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Sorumlu + Hedef Tarih */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#94A3B8' }}>Sorumlu Kişi</label>
                  <input
                    value={form.sorumlu}
                    onChange={e => set('sorumlu', e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#94A3B8' }}>Hedef Tarih</label>
                  <input
                    type="date"
                    value={form.hedefTarih}
                    onChange={e => set('hedefTarih', e.target.value)}
                    className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Fotoğraf */}
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: '#94A3B8' }}>
                  <i className="ri-camera-line mr-1" />Açılış Fotoğrafı
                  <span className="ml-1 font-normal" style={{ color: '#334155' }}>(opsiyonel)</span>
                </label>
                <SahaFotoUpload value={form.acilisFoto} onChange={v => setForm(p => ({ ...p, acilisFoto: v }))} />
              </div>
            </>
          )}

          {/* Seçili önem derecesi özeti (adım 2'de) */}
          {step === 2 && !editRecord && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: sevCfg.bg, border: `1px solid ${sevCfg.border}` }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sevCfg.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: sevCfg.color }}>{form.baslik || 'Başlıksız'}</p>
                <p className="text-[10px]" style={{ color: '#64748B' }}>{form.severity} · {firmalar.find(f => f.id === form.firmaId)?.ad || '—'}</p>
              </div>
            </div>
          )}

          {/* Alt boşluk */}
          <div className="h-4" />
        </div>

        {/* Footer Butonlar */}
        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          {editRecord ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                İptal
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                style={{ background: saving ? 'rgba(248,113,113,0.1)' : 'rgba(248,113,113,0.2)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}
              >
                {saving ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-save-line" />Güncelle</>}
              </button>
            </div>
          ) : step === 1 ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                İptal
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canGoStep2}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: canGoStep2 ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)', color: canGoStep2 ? '#F87171' : '#475569', border: `1px solid ${canGoStep2 ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}` }}
              >
                Devam <i className="ri-arrow-right-line" />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <i className="ri-arrow-left-line" />Geri
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                style={{ background: saving ? 'rgba(248,113,113,0.1)' : 'rgba(248,113,113,0.2)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}
              >
                {saving ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-check-line" />Kaydet</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
