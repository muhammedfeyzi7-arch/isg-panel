import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import InlineEdit from './InlineEdit';
import { exportToPDF } from '../utils/pdfExport';

const SEKTORLER = [
  'İnşaat', 'Liman / Denizcilik', 'Metal / Çelik', 'Kimya / Petrokimya',
  'Gıda Üretimi', 'Tekstil', 'Madencilik', 'Enerji / Elektrik',
  'Sağlık / Hastane', 'Ulaşım / Lojistik', 'Orman / Ağaç İşleme', 'Diğer',
];

interface PlanSection {
  baslik: string;
  icerik: string[];
}

interface Props {
  onClose: () => void;
}

export default function AcilDurumEylemPlaniModal({ onClose }: Props) {
  const [sektor, setSektor] = useState('');
  const [firmaAdi, setFirmaAdi] = useState('');
  const [calisanSayisi, setCalisanSayisi] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [ozet, setOzet] = useState('');
  const [sections, setSections] = useState<PlanSection[]>([]);

  const handleGenerate = async () => {
    if (!sektor || !firmaAdi.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('openai-assistant', {
        body: { mode: 'acil-durum-eylem-plani', data: { sektor, firmaAdi, calisanSayisi, prompt } },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (!fnData?.success) throw new Error(fnData?.error || 'Bilinmeyen hata');
      setOzet(fnData.data.ozet || '');
      setSections(fnData.data.basliklar || []);
      setStep('result');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try { await exportToPDF('acil-eylem-pdf', `Acil-Durum-Eylem-Plani-${firmaAdi}`); }
    finally { setPdfLoading(false); }
  };

  const updateSectionTitle = (si: number, val: string) => {
    setSections(prev => prev.map((s, i) => i === si ? { ...s, baslik: val } : s));
  };

  const updateItem = (si: number, ii: number, val: string) => {
    setSections(prev => prev.map((s, i) => i === si
      ? { ...s, icerik: s.icerik.map((item, j) => j === ii ? val : item) }
      : s
    ));
  };

  const addItem = (si: number) => {
    setSections(prev => prev.map((s, i) => i === si ? { ...s, icerik: [...s.icerik, 'Yeni madde...'] } : s));
  };

  const removeItem = (si: number, ii: number) => {
    setSections(prev => prev.map((s, i) => i === si ? { ...s, icerik: s.icerik.filter((_, j) => j !== ii) } : s));
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: step === 'result' ? '780px' : '560px', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <i className="ri-alarm-warning-line text-sm" style={{ color: '#DC2626' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Acil Durum Eylem Planı</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI Destekli — Sektöre Özel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 'result' && (
              <span className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                <i className="ri-edit-line mr-1" />Tıklayarak düzenleyin
              </span>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)' }}>
              <i className="ri-close-line text-sm" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'form' ? (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Firma / İşyeri Adı *</label>
                  <input value={firmaAdi} onChange={e => setFirmaAdi(e.target.value)} placeholder="Örn: ABC İnşaat A.Ş."
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Çalışan Sayısı</label>
                  <input value={calisanSayisi} onChange={e => setCalisanSayisi(e.target.value)} placeholder="Örn: 50"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sektör *</label>
                <div className="grid grid-cols-3 gap-2">
                  {SEKTORLER.map(s => (
                    <button key={s} onClick={() => setSektor(s)} className="text-xs py-2 px-3 rounded-lg text-left cursor-pointer transition-all overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ background: sektor === s ? 'rgba(220,38,38,0.08)' : 'var(--bg-app)', border: `1px solid ${sektor === s ? 'rgba(220,38,38,0.35)' : 'var(--border-main)'}`, color: sektor === s ? '#DC2626' : 'var(--text-muted)', fontWeight: sektor === s ? 600 : 400 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Ek Notlar <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(isteğe bağlı)</span>
                </label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                  placeholder="Örn: Deprem ve yangın senaryolarına özellikle yer ver" rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
              </div>

              {error && <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626' }}>{error}</div>}
            </div>
          ) : (
            <div id="acil-eylem-pdf" className="p-6 space-y-4">
              {/* Özet */}
              {ozet && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#DC2626' }}>Plan Özeti</p>
                  <InlineEdit value={ozet} onChange={setOzet} multiline
                    style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }} />
                </div>
              )}

              {/* Bölümler */}
              {sections.map((section, si) => (
                <div key={si} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-main)' }}>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: '#DC2626' }}>{si + 1}</span>
                    <InlineEdit value={section.baslik} onChange={v => updateSectionTitle(si, v)}
                      style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }} />
                  </div>
                  <ul className="p-4 space-y-2">
                    {section.icerik.map((item, ii) => (
                      <li key={ii} className="flex items-start gap-2 group">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: '#DC2626' }} />
                        <div className="flex-1">
                          <InlineEdit value={item} onChange={v => updateItem(si, ii, v)} multiline
                            style={{ fontSize: '12px', color: 'var(--text-primary)' }} />
                        </div>
                        <button onClick={() => removeItem(si, ii)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded cursor-pointer flex-shrink-0 mt-0.5"
                          style={{ color: '#DC2626' }} title="Maddeyi sil">
                          <i className="ri-close-line text-xs" />
                        </button>
                      </li>
                    ))}
                    <li>
                      <button onClick={() => addItem(si)}
                        className="flex items-center gap-1.5 text-[11px] cursor-pointer mt-1 px-2 py-1 rounded-lg transition-all"
                        style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-main)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.3)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-main)'; }}>
                        <i className="ri-add-line" /> Madde Ekle
                      </button>
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border-main)', background: 'var(--bg-app)' }}>
          {step === 'result' ? (
            <>
              <button onClick={() => { setStep('form'); setSections([]); setOzet(''); }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>
                <i className="ri-arrow-left-line" /> Yeniden Oluştur
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{firmaAdi} — {sektor}</span>
                <button onClick={handlePDF} disabled={pdfLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  style={{ background: pdfLoading ? 'rgba(220,38,38,0.4)' : '#DC2626', color: '#fff', opacity: pdfLoading ? 0.7 : 1 }}>
                  {pdfLoading ? <><i className="ri-loader-4-line animate-spin" /> Hazırlanıyor...</> : <><i className="ri-file-pdf-line" /> PDF İndir</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>
                İptal
              </button>
              <button onClick={handleGenerate} disabled={!sektor || !firmaAdi.trim() || loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: !sektor || !firmaAdi.trim() || loading ? 'rgba(220,38,38,0.4)' : '#DC2626', color: '#fff', opacity: !sektor || !firmaAdi.trim() || loading ? 0.6 : 1 }}>
                {loading ? <><i className="ri-loader-4-line animate-spin" /> Plan Oluşturuluyor...</> : <><i className="ri-sparkling-2-line" /> Plan Oluştur</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
