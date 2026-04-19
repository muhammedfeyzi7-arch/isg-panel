import { useState, useEffect, useRef } from 'react';
import Drawer from '@/components/base/Drawer';
import Button from '@/components/base/Button';
import { supabase } from '@/lib/supabase';
import type { EquipmentRow } from '@/services/specialistService';
import type { EquipmentFormData } from './EquipmentAddDrawer';

interface AppFirm {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  equipment: EquipmentRow | null;
  onSave: (id: string, data: EquipmentFormData) => Promise<void>;
  firms: AppFirm[];
  organizationId: string;
}

const CATEGORIES = ['KKD', 'Yangın Güvenliği', 'İş Makinesi', 'Tesisat', 'Elektrik', 'Diğer'];
const TYPES = ['Yangın Söndürücü', 'Baret', 'Emniyet Kemeri', 'Eldiven', 'Gözlük', 'Maske', 'Vinç', 'Forklift', 'Kompresör', 'Jeneratör', 'Diğer'];

export default function EquipmentEditDrawer({ open, onClose, equipment: eq, onSave, firms, organizationId }: Props) {
  const [form, setForm] = useState<EquipmentFormData>({
    name: '', category: 'KKD', equipmentType: '', firmId: '',
    area: '', serialNo: '', brand: '',
    lastControlDate: '', nextControlDate: '',
    status: 'Uygun', hasDocument: false, documentUrl: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docFileName, setDocFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eq) {
      setForm({
        name: eq.name,
        category: eq.category,
        equipmentType: eq.equipment_type ?? '',
        firmId: eq.firm_id ?? '',
        area: eq.area ?? '',
        serialNo: eq.serial_no ?? '',
        brand: eq.brand ?? '',
        lastControlDate: eq.last_control_date ?? '',
        nextControlDate: eq.next_control_date ?? '',
        status: eq.status,
        hasDocument: eq.has_document,
        documentUrl: eq.document_url ?? '',
        notes: eq.notes ?? '',
      });
      setDocFileName(eq.document_url ? 'Mevcut belge' : '');
    }
  }, [eq]);

  const f = (k: keyof EquipmentFormData, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleDocUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `equipment-docs/${organizationId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('equipment-docs').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('equipment-docs').getPublicUrl(path);
      f('documentUrl', urlData.publicUrl);
      setDocFileName(file.name);
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!eq) return;
    setSaving(true);
    try {
      await onSave(eq.id, form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ekipmanı Düzenle"
      width="w-[520px]"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>
            {saving ? 'Kaydediliyor...' : 'Güncelle'}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div>
          <label className="form-label">Ekipman Adı *</label>
          <input className="input" value={form.name} onChange={(e) => f('name', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Ekipman Türü</label>
            <select className="input cursor-pointer" value={form.equipmentType} onChange={(e) => f('equipmentType', e.target.value)}>
              <option value="">Tür seçin</option>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Kategori</label>
            <select className="input cursor-pointer" value={form.category} onChange={(e) => f('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Firma</label>
          <select className="input cursor-pointer" value={form.firmId} onChange={(e) => f('firmId', e.target.value)}>
            <option value="">Firma seçin</option>
            {firms.map((fi) => <option key={fi.id} value={fi.id}>{fi.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Bulunduğu Alan</label>
            <input className="input" value={form.area} onChange={(e) => f('area', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Seri Numarası</label>
            <input className="input font-mono" value={form.serialNo} onChange={(e) => f('serialNo', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="form-label">Marka</label>
          <input className="input" value={form.brand} onChange={(e) => f('brand', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Son Kontrol Tarihi</label>
            <input type="date" className="input" value={form.lastControlDate} onChange={(e) => f('lastControlDate', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Sonraki Kontrol Tarihi</label>
            <input type="date" className="input" value={form.nextControlDate} onChange={(e) => f('nextControlDate', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="form-label">Durum</label>
          <div className="flex gap-3">
            {['Uygun', 'Uygun Değil'].map((s) => (
              <button
                key={s}
                onClick={() => f('status', s)}
                className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all whitespace-nowrap"
                style={{
                  backgroundColor: form.status === s
                    ? (s === 'Uygun' ? '#16A34A' : '#DC2626')
                    : 'var(--surface)',
                  color: form.status === s ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${form.status === s ? 'transparent' : 'var(--border)'}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">Belge Mevcut mu?</label>
          <div className="flex gap-3 mb-3">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => f('hasDocument', v)}
                className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all whitespace-nowrap"
                style={{
                  backgroundColor: form.hasDocument === v ? 'var(--text-primary)' : 'var(--surface)',
                  color: form.hasDocument === v ? 'var(--card)' : 'var(--text-secondary)',
                  border: `1px solid ${form.hasDocument === v ? 'var(--text-primary)' : 'var(--border)'}`,
                }}
              >
                {v ? 'Evet' : 'Hayır'}
              </button>
            ))}
          </div>

          {form.hasDocument && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDocUpload(file);
                }}
              />
              {docFileName ? (
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#DCFCE7', border: '1px solid #86EFAC' }}>
                  <i className="ri-file-check-line text-lg" style={{ color: '#16A34A' }} />
                  <span className="text-sm flex-1 truncate" style={{ color: '#15803D' }}>{docFileName}</span>
                  <button
                    onClick={() => { f('documentUrl', ''); setDocFileName(''); if (fileRef.current) fileRef.current.value = ''; }}
                    className="w-5 h-5 flex items-center justify-center rounded-full cursor-pointer"
                    style={{ backgroundColor: '#16A34A', color: '#fff' }}
                  >
                    <i className="ri-close-line text-xs" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-3 rounded-lg border-2 border-dashed text-sm cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-loader-4-line animate-spin" /> Yükleniyor...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-upload-cloud-line" /> PDF, JPEG, PNG, DOC yükle
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="form-label">Notlar</label>
          <textarea
            className="input resize-none"
            rows={3}
            value={form.notes}
            onChange={(e) => f('notes', e.target.value)}
          />
        </div>
      </div>
    </Drawer>
  );
}
