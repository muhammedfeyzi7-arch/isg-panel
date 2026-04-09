import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/store/AppContext';
import type { Uygunsuzluk, UygunsuzlukSeverity } from '@/types';
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
  baslik: '', aciklama: '', onlem: '', firmaId: '', personelId: '',
  tarih: new Date().toISOString().slice(0, 10),
  severity: 'Orta', sorumlu: '', hedefTarih: '', notlar: '', acilisFoto: null,
};

const SEV_LIST: { key: UygunsuzlukSeverity; color: string; bg: string; border: string }[] = [
  { key: 'Düşük',  color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)' },
  { key: 'Orta',   color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
  { key: 'Yüksek', color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  { key: 'Kritik', color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
];

// ─── Saha Fotoğraf Yükleme ──────────────────────────────────────────────────
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
    if (!file || file.size > 8 * 1024 * 1024) return;
    setLoading(true);
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
        const r = new FileReader();
        r.onload = e2 => { if (e2.target?.result) { onChange(e2.target.result as string); setPreviewUrl(e2.target.result as string); } };
        r.readAsDataURL(file);
      }
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-6 rounded-2xl" style={{ background: 'rgba(52,211,153,0.05)', border: '1px dashed rgba(52,211,153,0.2)' }}>
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(52,211,153,0.5)', borderTopColor: 'transparent' }} />
        <span className="text-xs font-medium" style={{ color: '#34D399' }}>Yükleniyor...</span>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(52,211,153,0.25)' }}>
        <img src={previewUrl} alt="Fotoğraf" className="w-full" style={{ maxHeight: '180px', objectFit: 'contain', background: 'rgba(0,0,0,0.3)' }} />
        <div className="flex items-center justify-between px-3 py-2" style={{ background: 'rgba(52,211,153,0.08)' }}>
          <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#34D399' }}>
            <i className="ri-cloud-line" />Fotoğraf yüklendi
          </span>
          <button type="button" onClick={() => { onChange(null); setPreviewUrl(null); }} className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
            <i className="ri-delete-bin-line text-xs" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
      <button type="button" onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl cursor-pointer transition-all"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.2)' }}>
        <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(99,102,241,0.12)' }}>
          <i className="ri-image-line text-lg" style={{ color: '#818CF8' }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: '#818CF8' }}>Galeriden</span>
      </button>
      <button type="button" onClick={() => camRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl cursor-pointer transition-all"
        style={{ background: 'rgba(52,211,153,0.05)', border: '1px dashed rgba(52,211,153,0.2)' }}>
        <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(52,211,153,0.12)' }}>
          <i className="ri-camera-line text-lg" style={{ color: '#34D399' }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: '#34D399' }}>Kamera</span>
      </button>
    </div>
  );
}

// ─── Input / Textarea yardımcı ──────────────────────────────────────────────
const sahaInputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#E2E8F0',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
  WebkitAppearance: 'none',
};

function SahaInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...sahaInputStyle, ...props.style }} />;
}
function SahaSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{ ...sahaInputStyle, ...props.style }}>
      {props.children}
    </select>
  );
}
function SahaTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...sahaInputStyle, resize: 'none', ...props.style }} />;
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold mb-1.5" style={{ color: '#94A3B8' }}>{children}</p>;
}

// ─── Ana Form ───────────────────────────────────────────────────────────────
export default function SahaUygunsuzlukForm({ isOpen, onClose, editRecord }: Props) {
  const { firmalar, personeller, addUygunsuzluk, updateUygunsuzluk, setUygunsuzlukPhoto, getUygunsuzlukPhoto, addToast } = useApp();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const submittingRef = useRef(false);
  const [visible, setVisible] = useState(false);

  // Animasyon
  useEffect(() => {
    if (isOpen) {
      setVisible(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) { setStep(1); return; }
    if (editRecord) {
      const existingPhoto = getUygunsuzlukPhoto(editRecord.id, 'acilis') ?? null;
      setForm({
        baslik: editRecord.baslik, aciklama: editRecord.aciklama, onlem: editRecord.onlem ?? '',
        firmaId: editRecord.firmaId, personelId: editRecord.personelId ?? '', tarih: editRecord.tarih,
        severity: editRecord.severity, sorumlu: editRecord.sorumlu ?? '', hedefTarih: editRecord.hedefTarih ?? '',
        notlar: editRecord.notlar ?? '', acilisFoto: existingPhoto,
      });
    } else { setForm(defaultForm); }
    setStep(1);
  }, [isOpen, editRecord, getUygunsuzlukPhoto]);

  const filteredPersoneller = useMemo(
    () => form.firmaId
      ? personeller.filter(p => p.firmaId === form.firmaId && !p.silinmis)
      : personeller.filter(p => !p.silinmis),
    [personeller, form.firmaId],
  );

  const set = (key: keyof FormState, val: string | null) => setForm(prev => ({ ...prev, [key]: val as string }));

  const handleAiOneri = async () => {
    if (!form.aciklama.trim()) { addToast('Önce açıklama girin.', 'error'); return; }
    setAiLoading(true);
    try {
      const firmaAdi = firmalar.find(f => f.id === form.firmaId)?.ad || '';
      const res = await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/openai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '' },
        body: JSON.stringify({ mode: 'uygunsuzluk', data: { baslik: form.baslik, aciklama: form.aciklama, severity: form.severity, firmaAdi } }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Hata');
      setForm(prev => ({ ...prev, onlem: json.data.onlem || prev.onlem }));
      addToast('AI önlem önerisi oluşturuldu!', 'success');
    } catch (e) {
      addToast(`AI hatası: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally { setAiLoading(false); }
  };

  const canGoStep2 = !!(form.baslik.trim() && form.firmaId);

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
        } else if (form.acilisFoto) { acilisFotoUrl = form.acilisFoto; }
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
        } else if (form.acilisFoto) { acilisFotoUrl = form.acilisFoto; }
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
    } finally { setSaving(false); submittingRef.current = false; }
  };

  if (!isOpen) return null;

  const sevCfg = SEV_LIST.find(s => s.key === form.severity) ?? SEV_LIST[1];

  const panel = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          transition: 'opacity 0.25s ease',
          opacity: visible ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          display: 'flex', flexDirection: 'column',
          borderRadius: '24px 24px 0 0',
          background: 'linear-gradient(180deg, #111827 0%, #0B1120 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          maxHeight: '92vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', flexShrink: 0 }}>
              <i className={editRecord ? 'ri-edit-line' : 'ri-add-circle-line'} style={{ color: '#F87171', fontSize: 16 }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
                {editRecord ? 'Uygunsuzluk Düzenle' : 'Yeni Uygunsuzluk Kaydı'}
              </p>
              <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
                {editRecord ? (editRecord.acilisNo ? `#${editRecord.acilisNo}` : 'Düzenleme modu') : `Adım ${step} / 2`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748B', flexShrink: 0 }}>
            <i className="ri-close-line" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Adım göstergesi */}
        {!editRecord && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {[1, 2].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                  background: step >= s ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)',
                  color: step >= s ? '#F87171' : '#475569',
                  border: `1px solid ${step >= s ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                  {step > s ? <i className="ri-check-line" style={{ fontSize: 10 }} /> : s}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: step >= s ? '#F87171' : '#475569', whiteSpace: 'nowrap' }}>
                  {s === 1 ? 'Temel Bilgiler' : 'Detaylar & Fotoğraf'}
                </span>
                {i < 1 && <div style={{ flex: 1, height: 1, background: step > s ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.07)' }} />}
              </div>
            ))}
          </div>
        )}

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overscrollBehavior: 'contain' }}>

          {/* ─ ADIM 1 ─ */}
          {(step === 1 || !!editRecord) && (
            <>
              <div>
                <Label>Uygunsuzluk Başlığı <span style={{ color: '#EF4444' }}>*</span></Label>
                <SahaInput value={form.baslik} onChange={e => set('baslik', e.target.value)} placeholder="Kısa ve açıklayıcı başlık..." />
              </div>

              <div>
                <Label>Firma <span style={{ color: '#EF4444' }}>*</span></Label>
                <SahaSelect value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))}>
                  <option value="">Firma Seçin</option>
                  {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
                </SahaSelect>
              </div>

              {/* Önem derecesi görsel seçici */}
              <div>
                <Label>Önem Derecesi</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {SEV_LIST.map(sev => (
                    <button
                      key={sev.key}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, severity: sev.key }))}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 6, padding: '10px 6px', borderRadius: 12, cursor: 'pointer',
                        background: form.severity === sev.key ? sev.bg : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${form.severity === sev.key ? sev.border : 'rgba(255,255,255,0.07)'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sev.color }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: form.severity === sev.key ? sev.color : '#475569', whiteSpace: 'nowrap' }}>{sev.key}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tarih + Personel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <Label>Tespit Tarihi</Label>
                  <SahaInput type="date" value={form.tarih} onChange={e => set('tarih', e.target.value)} />
                </div>
                <div>
                  <Label>Personel</Label>
                  <SahaSelect value={form.personelId} onChange={e => set('personelId', e.target.value)}>
                    <option value="">Seçin</option>
                    {filteredPersoneller.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
                  </SahaSelect>
                </div>
              </div>
            </>
          )}

          {/* ─ ADIM 2 ─ */}
          {(step === 2 || !!editRecord) && (
            <>
              {/* Özet chip (sadece adım 2'de, düzenleme modunda değil) */}
              {step === 2 && !editRecord && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: sevCfg.bg, border: `1px solid ${sevCfg.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: sevCfg.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: sevCfg.color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.baslik || 'Başlıksız'}</p>
                    <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>{form.severity} · {firmalar.find(f => f.id === form.firmaId)?.ad || '—'}</p>
                  </div>
                </div>
              )}

              <div>
                <Label>Açıklama</Label>
                <SahaTextarea value={form.aciklama} onChange={e => set('aciklama', e.target.value)} placeholder="Tespit edilen uygunsuzluğun detaylı açıklaması..." rows={3} maxLength={500} />
                <p style={{ fontSize: 10, color: '#334155', textAlign: 'right', marginTop: 4 }}>{form.aciklama.length}/500</p>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Label>Alınması Gereken Önlem</Label>
                  <button
                    type="button"
                    onClick={() => void handleAiOneri()}
                    disabled={aiLoading || !form.aciklama.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                      borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: 'rgba(99,102,241,0.15)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.25)',
                      opacity: (aiLoading || !form.aciklama.trim()) ? 0.4 : 1,
                    }}
                  >
                    <i className={aiLoading ? 'ri-loader-4-line animate-spin' : 'ri-sparkling-line'} style={{ fontSize: 11 }} />
                    {aiLoading ? 'Öneriliyor...' : 'AI Öneri'}
                  </button>
                </div>
                <SahaTextarea value={form.onlem} onChange={e => set('onlem', e.target.value)} placeholder="Uygunsuzluğun giderilmesi için alınacak önlemler..." rows={3} maxLength={500} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <Label>Sorumlu Kişi</Label>
                  <SahaInput value={form.sorumlu} onChange={e => set('sorumlu', e.target.value)} placeholder="Ad Soyad" />
                </div>
                <div>
                  <Label>Hedef Tarih</Label>
                  <SahaInput type="date" value={form.hedefTarih} onChange={e => set('hedefTarih', e.target.value)} />
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
                  <i className="ri-camera-line" style={{ marginRight: 5 }} />
                  Açılış Fotoğrafı <span style={{ fontWeight: 400, color: '#334155', fontSize: 11 }}>(opsiyonel)</span>
                </p>
                <SahaFotoUpload value={form.acilisFoto} onChange={v => setForm(p => ({ ...p, acilisFoto: v }))} />
              </div>
            </>
          )}

          <div style={{ height: 8 }} />
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)', display: 'flex', gap: 10 }}>
          {editRecord ? (
            <>
              <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}>
                İptal
              </button>
              <button onClick={() => void handleSave()} disabled={saving} style={{ flex: 1, padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? 'rgba(248,113,113,0.1)' : 'rgba(248,113,113,0.2)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving ? <><i className="ri-loader-4-line animate-spin" style={{ fontSize: 14 }} />Kaydediliyor...</> : <><i className="ri-save-line" style={{ fontSize: 14 }} />Güncelle</>}
              </button>
            </>
          ) : step === 1 ? (
            <>
              <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}>
                İptal
              </button>
              <button onClick={() => setStep(2)} disabled={!canGoStep2} style={{ flex: 2, padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: canGoStep2 ? 'pointer' : 'not-allowed', background: canGoStep2 ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.04)', color: canGoStep2 ? '#F87171' : '#334155', border: `1px solid ${canGoStep2 ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Devam <i className="ri-arrow-right-line" style={{ fontSize: 14 }} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <i className="ri-arrow-left-line" style={{ fontSize: 14 }} />Geri
              </button>
              <button onClick={() => void handleSave()} disabled={saving} style={{ flex: 2, padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? 'rgba(248,113,113,0.1)' : 'rgba(248,113,113,0.2)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving ? <><i className="ri-loader-4-line animate-spin" style={{ fontSize: 14 }} />Kaydediliyor...</> : <><i className="ri-check-line" style={{ fontSize: 14 }} />Kaydet</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
