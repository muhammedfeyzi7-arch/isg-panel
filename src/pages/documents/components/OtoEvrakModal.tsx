import { useState, useMemo } from 'react';
import { useApp } from '../../../store/AppContext';
import Modal from '../../../components/base/Modal';
import {
  TEMPLATE_META,
  generateDocument,
  type DocTemplate,
  type TemplateExtra,
} from '../utils/autoDocGenerator';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultPersonelId?: string;
  defaultFirmaId?: string;
}

const TEMPLATES = Object.keys(TEMPLATE_META) as DocTemplate[];

export default function OtoEvrakModal({ open, onClose, defaultPersonelId, defaultFirmaId }: Props) {
  const { personeller, firmalar } = useApp();

  const [firmaId, setFirmaId] = useState(defaultFirmaId || '');
  const [personelId, setPersonelId] = useState(defaultPersonelId || '');
  const [template, setTemplate] = useState<DocTemplate>('egitim-katilim');
  const [extra, setExtra] = useState<TemplateExtra>({});
  const [generating, setGenerating] = useState(false);

  const filtPersonel = useMemo(
    () => (firmaId
      ? personeller.filter(p => p.firmaId === firmaId && !p.silinmis)
      : personeller.filter(p => !p.silinmis)),
    [personeller, firmaId],
  );

  const selectedPersonel = personeller.find(p => p.id === personelId);
  const selectedFirma = firmalar.find(f => f.id === firmaId);
  const tplMeta = TEMPLATE_META[template];

  const handleGenerate = () => {
    if (!personelId || !selectedPersonel) return;
    setGenerating(true);
    try {
      generateDocument(template, selectedPersonel, selectedFirma, extra);
    } finally {
      setTimeout(() => setGenerating(false), 800);
    }
  };

  const setExtraField = (key: keyof TemplateExtra, value: string) =>
    setExtra(prev => ({ ...prev, [key]: value }));

  const handleFirmaChange = (id: string) => {
    setFirmaId(id);
    setPersonelId('');
  };

  const canGenerate = !!personelId;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Oto Evrak Oluştur"
      size="lg"
      icon="ri-magic-line"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 cursor-pointer"
            style={{
              background: canGenerate
                ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                : 'rgba(99,102,241,0.3)',
              boxShadow: canGenerate ? '0 4px 15px rgba(99,102,241,0.4)' : 'none',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              opacity: canGenerate ? 1 : 0.6,
            }}
          >
            <i className={`${generating ? 'ri-loader-4-line animate-spin' : 'ri-file-pdf-line'}`} />
            {generating ? 'Oluşturuluyor...' : 'PDF Oluştur'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Info banner */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="ri-magic-line text-sm" style={{ color: '#818CF8' }} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: '#818CF8' }}>Otomatik Doldurma</p>
            <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
              Personel seçtikten sonra şablon türünü belirleyin.
              Ad Soyad, T.C. Kimlik No ve Görev/Ünvan alanları otomatik doldurulur, PDF yazıcı penceresinde açılır.
            </p>
          </div>
        </div>

        {/* Şablon seçimi */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#64748B' }}>
            Belge Şablonu Seçin *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(t => {
              const meta = TEMPLATE_META[t];
              const isSelected = template === t;
              return (
                <button
                  key={t}
                  onClick={() => { setTemplate(t); setExtra({}); }}
                  className="flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200 cursor-pointer"
                  style={{
                    background: isSelected ? meta.bg : 'rgba(255,255,255,0.03)',
                    border: isSelected
                      ? `2px solid ${meta.color}`
                      : '2px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: meta.bg }}
                  >
                    <i className={`${meta.icon} text-sm`} style={{ color: meta.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight" style={{ color: isSelected ? meta.color : '#CBD5E1' }}>
                      {meta.label}
                    </p>
                    <p className="text-[10px] mt-1 leading-relaxed" style={{ color: '#475569' }}>
                      {meta.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Firma + Personel */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Firma</label>
            <select
              value={firmaId}
              onChange={e => handleFirmaChange(e.target.value)}
              className="input-premium cursor-pointer"
            >
              <option value="">Tüm Firmalar</option>
              {firmalar.filter(f => !f.silinmis).map(f => (
                <option key={f.id} value={f.id}>{f.ad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>
              Personel *
            </label>
            <select
              value={personelId}
              onChange={e => setPersonelId(e.target.value)}
              className="input-premium cursor-pointer"
            >
              <option value="">Personel Seçin</option>
              {filtPersonel.map(p => (
                <option key={p.id} value={p.id}>{p.adSoyad}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Personel önizleme */}
        {selectedPersonel && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: `${tplMeta.color}08`,
              border: `1px solid ${tplMeta.color}25`,
            }}
          >
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            >
              {selectedPersonel.adSoyad.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#E2E8F0' }}>{selectedPersonel.adSoyad}</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs" style={{ color: '#64748B' }}>
                  <i className="ri-id-card-line mr-1" />
                  {selectedPersonel.tc || 'TC Yok'}
                </span>
                <span className="text-xs" style={{ color: '#64748B' }}>
                  <i className="ri-briefcase-line mr-1" />
                  {selectedPersonel.gorev || 'Görev Yok'}
                </span>
              </div>
            </div>
            <div
              className="text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap"
              style={{ background: `${tplMeta.color}15`, color: tplMeta.color }}
            >
              <i className={`${tplMeta.icon} mr-1`} />
              Hazır
            </div>
          </div>
        )}

        {/* Ek alanlar */}
        {tplMeta.extraFields.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
              Ek Bilgiler (Opsiyonel)
            </p>
            <div className="grid grid-cols-1 gap-3">
              {tplMeta.extraFields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>
                    {field.label}
                  </label>
                  <input
                    value={extra[field.key] || ''}
                    onChange={e => setExtraField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="input-premium"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Otomatik doldurulan alanlar */}
        {selectedPersonel && (
          <div
            className="rounded-xl p-3.5"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
          >
            <p className="text-xs font-semibold mb-2.5" style={{ color: '#34D399' }}>
              <i className="ri-checkbox-circle-line mr-1.5" />
              Otomatik doldurulan alanlar:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'SAYIN', value: selectedPersonel.adSoyad },
                { label: 'ADI SOYADI', value: selectedPersonel.adSoyad },
                { label: 'T.C. KİMLİK NO', value: selectedPersonel.tc || '—' },
                { label: 'GÖREV / ÜNVAN', value: selectedPersonel.gorev || '—' },
                { label: 'TARİH', value: new Date().toLocaleDateString('tr-TR') },
                { label: 'FİRMA', value: selectedFirma?.ad || '—' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2">
                  <span className="text-[10px] font-bold w-28 flex-shrink-0" style={{ color: '#475569' }}>
                    {item.label}:
                  </span>
                  <span className="text-[10px] font-semibold truncate" style={{ color: '#94A3B8' }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
