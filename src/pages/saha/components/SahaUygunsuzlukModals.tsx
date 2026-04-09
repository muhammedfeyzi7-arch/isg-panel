import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/store/AppContext';
import type { Uygunsuzluk } from '@/types';
import { STATUS_CONFIG, SEV_CONFIG } from '@/pages/nonconformity/utils/statusHelper';
import { uploadFileToStorage, getSignedUrlFromPath } from '@/utils/fileUpload';
import { useSignedUrl } from '@/hooks/useSignedUrl';

// ─── Ortak bottom-sheet wrapper ─────────────────────────────────────────────
function SahaSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', opacity: visible ? 1 : 0, transition: 'opacity 0.25s ease' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 600, margin: '0 auto',
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
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.15)' }} />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─── Fotoğraf Slot ──────────────────────────────────────────────────────────
function FotoSlot({ rawPath, alt, borderColor = 'rgba(255,255,255,0.1)' }: { rawPath: string | null; alt: string; borderColor?: string }) {
  const { url, loading } = useSignedUrl(rawPath);
  if (loading && rawPath) {
    return (
      <div style={{ height: 110, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#34D399', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 11, color: '#475569' }}>Yükleniyor...</span>
      </div>
    );
  }
  if (url) {
    return <img src={url} alt={alt} style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 14, background: 'rgba(0,0,0,0.3)', border: `1px solid ${borderColor}` }} />;
  }
  return (
    <div style={{ height: 90, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
      <i className="ri-image-line" style={{ color: '#334155', fontSize: 20 }} />
      <span style={{ fontSize: 11, color: '#334155' }}>Fotoğraf yok</span>
    </div>
  );
}

// ─── Detay Modal ────────────────────────────────────────────────────────────
interface DetailProps {
  record: Uygunsuzluk | null;
  onClose: () => void;
  onKapat: (rec: Uygunsuzluk) => void;
  onEdit: (rec: Uygunsuzluk) => void;
}

export function SahaDetayModal({ record, onClose, onKapat, onEdit }: DetailProps) {
  const { firmalar, personeller, getUygunsuzlukPhoto } = useApp();

  const acilisRaw = record ? (getUygunsuzlukPhoto(record.id, 'acilis') ?? null) : null;
  const kapatmaRaw = record ? (getUygunsuzlukPhoto(record.id, 'kapatma') ?? null) : null;

  if (!record) return null;

  const firma = firmalar.find(f => f.id === record.firmaId);
  const personel = personeller.find(p => p.id === record.personelId);
  const sc = STATUS_CONFIG[record.durum] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)', icon: 'ri-question-line', label: record.durum };
  const sev = SEV_CONFIG[record.severity] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8' };

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, color: value ? '#CBD5E1' : '#334155' }}>{value || '—'}</p>
    </div>
  );

  return (
    <SahaSheet open={!!record} onClose={onClose}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', flexShrink: 0 }}>
            <i className="ri-alert-line" style={{ color: '#F87171', fontSize: 15 }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Uygunsuzluk Detayı</p>
            {record.acilisNo && <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>#{record.acilisNo}</p>}
          </div>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B', flexShrink: 0 }}>
          <i className="ri-close-line" style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overscrollBehavior: 'contain' }}>

        {/* Durum + Önem */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
            <i className={sc.icon} style={{ fontSize: 11 }} />{sc.label}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: sev.bg, color: sev.color }}>
            {record.severity}
          </span>
        </div>

        {/* Başlık */}
        <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{record.baslik}</p>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Firma" value={firma?.ad} />
          <Field label="Personel" value={personel?.adSoyad} />
          <Field label="Tespit Tarihi" value={record.tarih ? new Date(record.tarih).toLocaleDateString('tr-TR') : undefined} />
          <Field label="Sorumlu" value={record.sorumlu} />
          {record.hedefTarih && <Field label="Hedef Tarih" value={new Date(record.hedefTarih).toLocaleDateString('tr-TR')} />}
          {record.kapatmaTarihi && <Field label="Kapatma Tarihi" value={new Date(record.kapatmaTarihi).toLocaleDateString('tr-TR')} />}
        </div>

        {record.aciklama && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', marginBottom: 6 }}>Açıklama</p>
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 13, color: '#CBD5E1', lineHeight: 1.6 }}>
              {record.aciklama}
            </div>
          </div>
        )}

        {record.onlem && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', marginBottom: 6 }}>Alınacak Önlem</p>
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 13, color: '#FCD34D', lineHeight: 1.6 }}>
              {record.onlem}
            </div>
          </div>
        )}

        {/* Fotoğraflar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', marginBottom: 6 }}>Açılış Fotoğrafı</p>
            <FotoSlot rawPath={acilisRaw} alt="Açılış" />
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', marginBottom: 6 }}>Kapatma Fotoğrafı</p>
            <FotoSlot rawPath={kapatmaRaw} alt="Kapatma" borderColor="rgba(34,197,94,0.25)" />
          </div>
        </div>

        {record.kapatmaAciklama && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', marginBottom: 6 }}>Kapatma Açıklaması</p>
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 13, color: '#34D399', lineHeight: 1.6 }}>
              {record.kapatmaAciklama}
            </div>
          </div>
        )}

        <div style={{ height: 4 }} />
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)', display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}>
          Kapat
        </button>
        <button onClick={() => onEdit(record)} style={{ flex: 1, padding: '12px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <i className="ri-edit-line" style={{ fontSize: 13 }} />Düzenle
        </button>
        {record.durum !== 'Kapandı' && (
          <button onClick={() => { onClose(); onKapat(record); }} style={{ flex: 1, padding: '12px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <i className="ri-checkbox-circle-line" style={{ fontSize: 13 }} />Kapat
          </button>
        )}
      </div>
    </SahaSheet>
  );
}

// ─── Kapatma Modal ──────────────────────────────────────────────────────────
interface KapatmaProps {
  record: Uygunsuzluk | null;
  onClose: () => void;
}

function SahaFotoUploadKapatma({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
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
      const filePath = await uploadFileToStorage(file, orgId, 'kapatma', crypto.randomUUID());
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
      <div style={{ height: 90, borderRadius: 14, background: 'rgba(52,211,153,0.05)', border: '1px dashed rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ width: 16, height: 16, border: '2px solid rgba(52,211,153,0.3)', borderTopColor: '#34D399', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 12, color: '#34D399' }}>Yükleniyor...</span>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(34,197,94,0.25)' }}>
        <img src={previewUrl} alt="Kapatma" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', background: 'rgba(0,0,0,0.3)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(34,197,94,0.08)' }}>
          <span style={{ fontSize: 12, color: '#34D399', display: 'flex', alignItems: 'center', gap: 5 }}><i className="ri-cloud-line" />Fotoğraf yüklendi</span>
          <button type="button" onClick={() => { onChange(null); setPreviewUrl(null); }} style={{ width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: 'none' }}>
            <i className="ri-delete-bin-line" style={{ fontSize: 11 }} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
      <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '16px 8px', borderRadius: 14, cursor: 'pointer', background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.2)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.12)' }}>
          <i className="ri-image-line" style={{ color: '#818CF8', fontSize: 16 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#818CF8' }}>Galeriden</span>
      </button>
      <button type="button" onClick={() => camRef.current?.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '16px 8px', borderRadius: 14, cursor: 'pointer', background: 'rgba(52,211,153,0.05)', border: '1px dashed rgba(52,211,153,0.2)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(52,211,153,0.12)' }}>
          <i className="ri-camera-line" style={{ color: '#34D399', fontSize: 16 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#34D399' }}>Kamera</span>
      </button>
    </div>
  );
}

export function SahaKapatmaModal({ record, onClose }: KapatmaProps) {
  const { updateUygunsuzluk, setUygunsuzlukPhoto, addToast } = useApp();
  const [aciklama, setAciklama] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) { setAciklama(''); setFoto(null); }
  }, [record]);

  const handleSave = async () => {
    if (!record) return;
    if (!foto) { addToast('Kapatma fotoğrafı zorunludur.', 'error'); return; }
    setSaving(true);
    try {
      let kapatmaFotoUrl: string | undefined;
      if (foto.startsWith('data:')) {
        const url = await setUygunsuzlukPhoto(record.id, 'kapatma', foto);
        if (!url) { addToast('Fotoğraf yüklenemedi. Tekrar deneyin.', 'error'); return; }
        kapatmaFotoUrl = url;
      } else { kapatmaFotoUrl = foto; }
      updateUygunsuzluk(record.id, {
        kapatmaAciklama: aciklama.trim() || undefined,
        kapatmaFotoMevcut: true,
        kapatmaFotoUrl,
        kapatmaTarihi: new Date().toISOString(),
        durum: 'Kapandı',
      });
      addToast('Uygunsuzluk başarıyla kapatıldı.', 'success');
      setAciklama(''); setFoto(null);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <SahaSheet open={!!record} onClose={onClose}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)', flexShrink: 0 }}>
            <i className="ri-checkbox-circle-line" style={{ color: '#22C55E', fontSize: 16 }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Uygunsuzluk Kapat</p>
            <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Kapatma fotoğrafı zorunludur</p>
          </div>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B', flexShrink: 0 }}>
          <i className="ri-close-line" style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overscrollBehavior: 'contain' }}>
        {/* Kayıt özeti */}
        {record && (
          <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
            {record.acilisNo && <p style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', marginBottom: 3 }}>#{record.acilisNo}</p>}
            <p style={{ fontSize: 14, fontWeight: 600, color: '#CBD5E1', margin: 0 }}>{record.baslik}</p>
          </div>
        )}

        {/* Fotoğraf yükleme — zorunlu */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
            <i className="ri-camera-line" style={{ marginRight: 5 }} />
            Kapatma Fotoğrafı <span style={{ color: '#EF4444' }}>*</span>
          </p>
          <SahaFotoUploadKapatma value={foto} onChange={setFoto} />
        </div>

        {/* Açıklama */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 6 }}>
            Kapatma Açıklaması <span style={{ fontWeight: 400, color: '#334155', fontSize: 11 }}>(opsiyonel)</span>
          </p>
          <textarea
            value={aciklama}
            onChange={e => setAciklama(e.target.value)}
            placeholder="Kapatma işlemine ilişkin açıklama..."
            rows={3}
            maxLength={500}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', borderRadius: 12, padding: '12px 14px', fontSize: 13, width: '100%', outline: 'none', resize: 'none', WebkitAppearance: 'none' }}
          />
          <p style={{ fontSize: 10, color: '#334155', textAlign: 'right', marginTop: 4 }}>{aciklama.length}/500</p>
        </div>

        {/* Bilgi */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <i className="ri-information-line" style={{ color: '#22C55E', fontSize: 13, marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: '#64748B', margin: 0, lineHeight: 1.5 }}>Kapatma fotoğrafı yüklendikten sonra durum otomatik olarak &ldquo;Kapandı&rdquo; olarak değişecektir.</p>
        </div>

        <div style={{ height: 4 }} />
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)', display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}>
          İptal
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !foto}
          style={{ flex: 2, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: (!foto || saving) ? 'not-allowed' : 'pointer', background: !foto ? 'rgba(34,197,94,0.05)' : saving ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.2)', color: !foto ? '#334155' : '#22C55E', border: `1px solid ${!foto ? 'rgba(255,255,255,0.06)' : 'rgba(34,197,94,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {saving ? <><i className="ri-loader-4-line animate-spin" style={{ fontSize: 14 }} />Kaydediliyor...</> : <><i className="ri-checkbox-circle-line" style={{ fontSize: 14 }} />Uygunsuzluğu Kapat</>}
        </button>
      </div>
    </SahaSheet>
  );
}
