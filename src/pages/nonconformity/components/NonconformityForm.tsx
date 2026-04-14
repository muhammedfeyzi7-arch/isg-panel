import { useState, useMemo, useEffect, useRef } from 'react';
import Modal from '../../../components/base/Modal';
import ImageUpload from './ImageUpload';
import { useApp } from '../../../store/AppContext';
import type { Uygunsuzluk, UygunsuzlukSeverity } from '../../../types';
import { SEV_CONFIG } from '../utils/statusHelper';

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
  severity: 'Orta', sorumlu: '', hedefTarih: '', notlar: '',
  acilisFoto: null,
};

export default function NonconformityForm({ isOpen, onClose, editRecord }: Props) {
  const { firmalar, personeller, addUygunsuzluk, updateUygunsuzluk, setUygunsuzlukPhoto, getUygunsuzlukPhoto, addToast, logAction } = useApp();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [aiOnlemLoading, setAiOnlemLoading] = useState(false);
  // FIX 4: useRef lock to prevent double-click duplicate submissions
  const submittingRef = useRef(false);

  const handleAiOnlemOner = async () => {
    if (!form.aciklama.trim()) { addToast('Önce uygunsuzluk açıklamasını girin.', 'error'); return; }
    setAiOnlemLoading(true);
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
      const msg = e instanceof Error ? e.message : String(e);
      addToast(`AI hatası: ${msg}`, 'error');
    } finally {
      setAiOnlemLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editRecord) {
      // Storage URL öncelikli, localStorage fallback
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
  }, [isOpen, editRecord, getUygunsuzlukPhoto]);

  const filteredPersoneller = useMemo(
    () => form.firmaId
      ? personeller.filter(p => p.firmaId === form.firmaId && !p.silinmis)
      : personeller.filter(p => !p.silinmis),
    [personeller, form.firmaId],
  );

  const set = (key: keyof FormState, val: string | null) =>
    setForm(prev => ({ ...prev, [key]: val as string }));

  const handleSave = async () => {
    if (!form.baslik.trim()) { addToast('Başlık zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      if (editRecord) {
        // Storage filePath veya URL ise direkt kullan; base64 ise Storage'a yükle
        let acilisFotoUrl: string | undefined;
        if (form.acilisFoto && form.acilisFoto.startsWith('data:')) {
          // base64 → Storage'a yükle
          const uploaded = await setUygunsuzlukPhoto(editRecord.id, 'acilis', form.acilisFoto);
          acilisFotoUrl = uploaded ?? undefined;
          if (!uploaded) addToast('Fotoğraf yüklenemedi, kayıt yine de güncellendi.', 'warning');
        } else if (form.acilisFoto) {
          // http URL veya filePath — direkt kullan
          acilisFotoUrl = form.acilisFoto;
        }

        updateUygunsuzluk(editRecord.id, {
          baslik: form.baslik.trim(), aciklama: form.aciklama.trim(), onlem: form.onlem.trim(),
          firmaId: form.firmaId, personelId: form.personelId || undefined, tarih: form.tarih,
          severity: form.severity, sorumlu: form.sorumlu.trim(), hedefTarih: form.hedefTarih,
          notlar: form.notlar.trim(),
          acilisFotoMevcut: !!acilisFotoUrl,
          acilisFotoUrl,
        });
        logAction('uygunsuzluk_updated', 'Uygunsuzluklar', editRecord.id, form.baslik, 'Uygunsuzluk güncellendi.');
        addToast('Uygunsuzluk güncellendi.', 'success');
      } else {
        // Yeni kayıt: ImageUpload zaten Storage'a yükledi, filePath döndürdü
        let acilisFotoUrl: string | undefined;
        if (form.acilisFoto && form.acilisFoto.startsWith('data:')) {
          // base64 fallback → geçici ID ile Storage'a yükle
          const tempId = `temp-${Date.now()}`;
          const uploaded = await setUygunsuzlukPhoto(tempId, 'acilis', form.acilisFoto);
          acilisFotoUrl = uploaded ?? undefined;
          if (!uploaded) addToast('Fotoğraf yüklenemedi, kayıt yine de oluşturuldu.', 'warning');
        } else if (form.acilisFoto) {
          // ImageUpload'dan gelen filePath veya http URL — direkt kullan
          acilisFotoUrl = form.acilisFoto;
        }

        await addUygunsuzluk({
          baslik: form.baslik.trim(), aciklama: form.aciklama.trim(), onlem: form.onlem.trim(),
          firmaId: form.firmaId, personelId: form.personelId || undefined, tarih: form.tarih,
          severity: form.severity, sorumlu: form.sorumlu.trim(), hedefTarih: form.hedefTarih,
          notlar: form.notlar.trim(), durum: 'Açık',
          acilisFotoMevcut: !!acilisFotoUrl,
          acilisFotoUrl,
          kapatmaFotoMevcut: false,
        });

        addToast('Uygunsuzluk kaydı oluşturuldu.', 'success');
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Kayıt sırasında hata oluştu: ${msg}`, 'error');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editRecord ? 'Uygunsuzluk Düzenle' : 'Yeni Uygunsuzluk Ekle'}
      size="lg"
      icon="ri-alert-line"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button onClick={handleSave} className="btn-primary whitespace-nowrap" disabled={saving}>
            <i className={editRecord ? 'ri-save-line' : 'ri-add-line'} />
            {saving ? 'Kaydediliyor...' : editRecord ? 'Güncelle' : 'Kaydet'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {editRecord?.acilisNo && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <i className="ri-hashtag text-sm" style={{ color: '#818CF8' }} />
            <span className="text-xs font-mono font-bold" style={{ color: '#818CF8' }}>{editRecord.acilisNo}</span>
            <span className="text-xs ml-2" style={{ color: '#64748B' }}>— Kayıt No</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">Uygunsuzluk Başlığı *</label>
            <input value={form.baslik} onChange={e => set('baslik', e.target.value)} placeholder="Uygunsuzluk kısa başlığı..." className="isg-input" />
          </div>

          <div>
            <label className="form-label">Firma *</label>
            <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))} className="isg-input">
              <option value="">Firma Seçin</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">İlgili Personel <span style={{ color: '#64748B', fontSize: '11px' }}>(İsteğe bağlı)</span></label>
            <select value={form.personelId} onChange={e => set('personelId', e.target.value)} className="isg-input">
              <option value="">Personel Seçin</option>
              {filteredPersoneller.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">Tespit Tarihi</label>
            <input type="date" value={form.tarih} onChange={e => set('tarih', e.target.value)} className="isg-input" />
          </div>

          <div>
            <label className="form-label">Önem Derecesi</label>
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value as UygunsuzlukSeverity }))} className="isg-input">
              {Object.entries(SEV_CONFIG).map(([k]) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">Sorumlu Kişi</label>
            <input value={form.sorumlu} onChange={e => set('sorumlu', e.target.value)} placeholder="Ad Soyad" className="isg-input" />
          </div>

          <div>
            <label className="form-label">Hedef Kapatma Tarihi</label>
            <input type="date" value={form.hedefTarih} onChange={e => set('hedefTarih', e.target.value)} className="isg-input" />
          </div>

          <div className="sm:col-span-2">
            <label className="form-label">Uygunsuzluk Açıklaması</label>
            <textarea value={form.aciklama} onChange={e => set('aciklama', e.target.value)} placeholder="Tespit edilen uygunsuzluğun detaylı açıklaması..." rows={3} maxLength={500} className="isg-input" />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="form-label mb-0">Alınması Gereken Önlem</label>
              <button
                type="button"
                onClick={handleAiOnlemOner}
                disabled={aiOnlemLoading || !form.aciklama.trim()}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.25)' }}
                title={!form.aciklama.trim() ? 'Önce açıklama girin' : 'AI ile önlem öner'}
              >
                {aiOnlemLoading
                  ? <><i className="ri-loader-4-line animate-spin text-xs" /> Öneriliyor...</>
                  : <><i className="ri-sparkling-line text-xs" /> AI Öneri Al</>
                }
              </button>
            </div>
            <textarea value={form.onlem} onChange={e => set('onlem', e.target.value)} placeholder="Uygunsuzluğun giderilmesi için alınması gereken önlemler..." rows={3} maxLength={500} className="isg-input" />
            {!form.aciklama.trim() && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                <i className="ri-information-line mr-1" />AI önerisi için önce açıklama alanını doldurun
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <ImageUpload
              label="Açılış Fotoğrafı"
              value={form.acilisFoto}
              onChange={v => setForm(p => ({ ...p, acilisFoto: v }))}
              capture="environment"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', color: '#94A3B8' }}>
          <i className="ri-information-line" style={{ color: '#22C55E' }} />
          Durum otomatik hesaplanır. Kapatma fotoğrafı yüklendikten sonra kayıt otomatik "Kapandı" olarak işaretlenir.
        </div>
      </div>
    </Modal>
  );
}
