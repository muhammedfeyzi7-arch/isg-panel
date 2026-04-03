import { useState } from 'react';
import Modal from '../../../components/base/Modal';
import ImageUpload from './ImageUpload';
import { useApp } from '../../../store/AppContext';
import type { Uygunsuzluk } from '../../../types';

interface Props {
  record: Uygunsuzluk | null;
  onClose: () => void;
}

export default function KapatmaModal({ record, onClose }: Props) {
  const { updateUygunsuzluk, setUygunsuzlukPhoto, addToast } = useApp();
  const [aciklama, setAciklama] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setAciklama('');
    setFoto(null);
    onClose();
  };

  const handleSave = async () => {
    if (!record) return;
    if (!foto) { addToast('Kapatma fotoğrafı zorunludur.', 'error'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();

      // Önce fotoğrafı Storage'a yükle, URL al, sonra kaydet
      let kapatmaFotoUrl: string | undefined;
      if (foto.startsWith('data:')) {
        const url = await setUygunsuzlukPhoto(record.id, 'kapatma', foto);
        if (!url) {
          addToast('Fotoğraf yüklenemedi. Lütfen tekrar deneyin.', 'error');
          return;
        }
        kapatmaFotoUrl = url;
      } else if (foto.startsWith('http')) {
        // Zaten URL — değişmemiş
        kapatmaFotoUrl = foto;
      }

      updateUygunsuzluk(record.id, {
        kapatmaAciklama: aciklama.trim() || undefined,
        kapatmaFotoMevcut: true,
        kapatmaFotoUrl,
        kapatmaTarihi: now,
        durum: 'Kapandı',
      });
      addToast('Uygunsuzluk başarıyla kapatıldı.', 'success');
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!record}
      onClose={handleClose}
      title="Uygunsuzluk Kapat"
      size="md"
      icon="ri-checkbox-circle-line"
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button onClick={handleSave} className="whitespace-nowrap px-5 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer" style={{ background: '#22C55E', color: '#fff' }} disabled={saving}>
            <i className="ri-checkbox-circle-line mr-1.5" />
            {saving ? 'Kaydediliyor...' : 'Uygunsuzluğu Kapat'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {record && (
          <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-xs font-bold mb-0.5" style={{ color: '#EF4444' }}>{record.acilisNo}</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{record.baslik}</p>
          </div>
        )}

        <ImageUpload
          label="Kapatma Fotoğrafı *"
          value={foto}
          onChange={setFoto}
        />

        <div>
          <label className="form-label">Kapatma Açıklaması <span style={{ color: '#64748B', fontSize: '11px' }}>(İsteğe bağlı)</span></label>
          <textarea
            value={aciklama}
            onChange={e => setAciklama(e.target.value)}
            placeholder="Kapatma işlemine ilişkin açıklama..."
            rows={3}
            maxLength={500}
            className="isg-input"
          />
          <p className="text-xs mt-1" style={{ color: '#475569' }}>{aciklama.length}/500</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', color: '#94A3B8' }}>
          <i className="ri-information-line" style={{ color: '#22C55E' }} />
          Kapatma fotoğrafı yüklendikten sonra durum otomatik "Kapandı" olarak değişecektir.
        </div>
      </div>
    </Modal>
  );
}
