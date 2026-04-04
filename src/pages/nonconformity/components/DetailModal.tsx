import { useEffect, useState } from 'react';
import Modal from '../../../components/base/Modal';
import { useApp } from '../../../store/AppContext';
import type { Uygunsuzluk } from '../../../types';
import { STATUS_CONFIG, SEV_CONFIG } from '../utils/statusHelper';
import { useSignedUrl } from '../../../hooks/useSignedUrl';

interface Props {
  record: Uygunsuzluk | null;
  onClose: () => void;
  onKapat: (rec: Uygunsuzluk) => void;
  onEdit: (rec: Uygunsuzluk) => void;
}

export default function DetailModal({ record, onClose, onKapat, onEdit }: Props) {
  const { firmalar, personeller, getUygunsuzlukPhoto } = useApp();

  // Ham path/URL'leri al
  const acilisRaw = record ? (getUygunsuzlukPhoto(record.id, 'acilis') ?? null) : null;
  const kapatmaRaw = record ? (getUygunsuzlukPhoto(record.id, 'kapatma') ?? null) : null;

  // Signed URL'e çevir (filePath ise) — base64 ve tam URL'ler de desteklenir
  const acilisFoto = useSignedUrl(acilisRaw);
  const kapatmaFoto = useSignedUrl(kapatmaRaw);

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  useEffect(() => {}, [record]);

  if (!record) return null;

  const firma = firmalar.find(f => f.id === record.firmaId);
  const personel = personeller.find(p => p.id === record.personelId);
  const sc = STATUS_CONFIG[record.durum];
  const sev = SEV_CONFIG[record.severity];

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-sm" style={{ color: value ? 'var(--text-primary)' : '#475569' }}>{value || '—'}</p>
    </div>
  );

  return (
    <Modal
      isOpen={!!record}
      onClose={onClose}
      title="Uygunsuzluk Detayı"
      size="lg"
      icon="ri-alert-line"
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">Kapat</button>
          <button onClick={() => onEdit(record)} className="btn-secondary whitespace-nowrap">
            <i className="ri-edit-line mr-1" />Düzenle
          </button>
          {record.durum !== 'Kapandı' && (
            <button
              onClick={() => { onClose(); onKapat(record); }}
              className="whitespace-nowrap px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all"
              style={{ background: '#22C55E', color: '#fff' }}
            >
              <i className="ri-checkbox-circle-line mr-1.5" />Kapatma Yap
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Header badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {record.acilisNo && (
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
              {record.acilisNo}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
            <i className={sc.icon} />{sc.label}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: sev.bg, color: sev.color }}>
            {record.severity}
          </span>
        </div>

        {/* Main title */}
        <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(51,65,85,0.4)' }}>
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{record.baslik}</h3>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Firma" value={firma?.ad} />
          <Field label="Personel" value={personel?.adSoyad} />
          <Field label="Tespit Tarihi" value={record.tarih ? new Date(record.tarih).toLocaleDateString('tr-TR') : undefined} />
          <Field label="Sorumlu" value={record.sorumlu} />
          <Field label="Hedef Tarih" value={record.hedefTarih ? new Date(record.hedefTarih).toLocaleDateString('tr-TR') : undefined} />
          {record.kapatmaTarihi && (
            <Field label="Kapatma Tarihi" value={new Date(record.kapatmaTarihi).toLocaleDateString('tr-TR')} />
          )}
        </div>

        {record.aciklama && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#64748B' }}>Açıklama</p>
            <div className="px-3 py-2.5 rounded-xl text-sm leading-relaxed" style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(51,65,85,0.3)', color: 'var(--text-secondary)' }}>
              {record.aciklama}
            </div>
          </div>
        )}

        {record.onlem && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#64748B' }}>Alınması Gereken Önlem</p>
            <div className="px-3 py-2.5 rounded-xl text-sm leading-relaxed" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--text-secondary)' }}>
              {record.onlem}
            </div>
          </div>
        )}

        {/* Photos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Açılış Fotoğrafı</p>
            {acilisFoto ? (
              <img src={acilisFoto} alt="Açılış" className="w-full rounded-xl object-cover" style={{ maxHeight: '200px', objectFit: 'contain', background: '#0F172A', border: '1px solid rgba(51,65,85,0.3)' }} />
            ) : (
              <div className="flex items-center justify-center rounded-xl" style={{ height: '120px', background: 'rgba(15,23,42,0.3)', border: '1px dashed rgba(51,65,85,0.4)' }}>
                <div className="text-center">
                  <i className="ri-image-line text-2xl block mb-1" style={{ color: '#475569' }} />
                  <p className="text-xs" style={{ color: '#475569' }}>Fotoğraf yok</p>
                </div>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Kapatma Fotoğrafı</p>
            {kapatmaFoto ? (
              <img src={kapatmaFoto} alt="Kapatma" className="w-full rounded-xl object-cover" style={{ maxHeight: '200px', objectFit: 'contain', background: '#0F172A', border: '1px solid rgba(34,197,94,0.3)' }} />
            ) : (
              <div className="flex items-center justify-center rounded-xl" style={{ height: '120px', background: 'rgba(15,23,42,0.3)', border: '1px dashed rgba(51,65,85,0.4)' }}>
                <div className="text-center">
                  <i className="ri-image-line text-2xl block mb-1" style={{ color: '#475569' }} />
                  <p className="text-xs" style={{ color: '#475569' }}>Henüz yüklenmedi</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {record.kapatmaAciklama && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#64748B' }}>Kapatma Açıklaması</p>
            <div className="px-3 py-2.5 rounded-xl text-sm leading-relaxed" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--text-secondary)' }}>
              {record.kapatmaAciklama}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
