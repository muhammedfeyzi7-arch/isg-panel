import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { exportToPDF } from '../utils/pdfExport';

interface RiskRow {
  no: number;
  tehlikeBolumu: string;
  tehlikeKaynagi: string;
  olasiZarar: string;
  ihtimal: number;
  frekans: number;
  siddet: number;
  riskSkoru: number;
  riskSeviyesi: string;
  onleyiciFaaliyet: string;
}

const SEKTORLER = [
  'İnşaat', 'Liman / Denizcilik', 'Metal / Çelik', 'Kimya / Petrokimya',
  'Gıda Üretimi', 'Tekstil', 'Madencilik', 'Enerji / Elektrik',
  'Sağlık / Hastane', 'Ulaşım / Lojistik', 'Orman / Ağaç İşleme', 'Diğer',
];

const RISK_SEVIYE_STYLE: Record<string, { bg: string; color: string }> = {
  'Tolerans Gösterilemez': { bg: 'rgba(220,38,38,0.1)',  color: '#DC2626' },
  'Esaslı':               { bg: 'rgba(234,88,12,0.1)',   color: '#EA580C' },
  'Önemli':               { bg: 'rgba(217,119,6,0.1)',   color: '#D97706' },
  'Olası':                { bg: 'rgba(2,132,199,0.1)',    color: '#0284C7' },
  'Önemsiz':              { bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
};

function getRiskSeviyesi(skor: number): string {
  if (skor >= 400) return 'Tolerans Gösterilemez';
  if (skor >= 200) return 'Esaslı';
  if (skor >= 70)  return 'Önemli';
  if (skor >= 20)  return 'Olası';
  return 'Önemsiz';
}

function EditableCell({ value, onChange, numeric = false, minWidth }: { value: string | number; onChange: (v: string) => void; numeric?: boolean; minWidth?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const commit = () => { setEditing(false); const t = draft.trim(); if (t && t !== String(value)) onChange(t); else setDraft(String(value)); };
  if (editing) return (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); } }}
      className="outline-none rounded px-1.5 py-0.5 text-xs w-full"
      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--text-primary)', minWidth: minWidth || (numeric ? '48px' : '100px') }} />
  );
  return (
    <span onClick={() => { setDraft(String(value)); setEditing(true); }} className="cursor-text rounded px-1 py-0.5 transition-all inline-block w-full"
      style={{ minWidth: minWidth || (numeric ? '32px' : '80px') }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'; (e.currentTarget as HTMLElement).style.outline = '1px dashed rgba(99,102,241,0.3)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.outline = 'none'; }}
      title="Düzenlemek için tıklayın">{value}</span>
  );
}

interface Props { onClose: () => void; }

export default function RiskAnaliziModal({ onClose }: Props) {
  const [sektor, setSektor] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'result'>('form');
  const tableRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    if (!sektor || !prompt.trim()) return;
    setLoading(true); setError('');
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('openai-assistant', { body: { mode: 'risk-analizi', data: { sektor, prompt } } });
      if (fnErr) throw new Error(fnErr.message);
      if (!fnData?.success) throw new Error(fnData?.error || 'Bilinmeyen hata');
      setRows(fnData.data.rows || []);
      setStep('result');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Bir hata oluştu'); }
    finally { setLoading(false); }
  };

  const updateRow = (i: number, field: keyof RiskRow, val: string) => {
    setRows(prev => {
      const next = [...prev];
      const row = { ...next[i] };
      if (field === 'ihtimal' || field === 'frekans' || field === 'siddet') {
        const num = parseFloat(val);
        if (!isNaN(num)) { (row as Record<string, unknown>)[field] = num; row.riskSkoru = Math.round(row.ihtimal * row.frekans * row.siddet); row.riskSeviyesi = getRiskSeviyesi(row.riskSkoru); }
      } else { (row as Record<string, unknown>)[field] = val; }
      next[i] = row;
      return next;
    });
  };

  const addRow = () => {
    const newNo = rows.length + 1;
    setRows(prev => [...prev, { no: newNo, tehlikeBolumu: 'Yeni Bölüm', tehlikeKaynagi: 'Tehlike kaynağı...', olasiZarar: 'Olası zarar...', ihtimal: 3, frekans: 3, siddet: 7, riskSkoru: 63, riskSeviyesi: 'Olası', onleyiciFaaliyet: 'Önleyici faaliyet...' }]);
  };

  const removeRow = (i: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, no: idx + 1 })));
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try { await exportToPDF('risk-analizi-pdf', `Risk-Analizi-${sektor}`); }
    finally { setPdfLoading(false); }
  };

  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: step === 'result' ? '1160px' : '560px', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(2,132,199,0.1)', border: '1px solid rgba(2,132,199,0.2)' }}>
              <i className="ri-bar-chart-grouped-line text-sm" style={{ color: '#0284C7' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Risk Analizi</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fine-Kinney Metodu — AI Destekli</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 'result' && (
              <span className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                <i className="ri-edit-line mr-1" />Hücrelere tıklayarak düzenleyin
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
              <div className="rounded-xl p-4" style={{ background: 'rgba(2,132,199,0.05)', border: '1px solid rgba(2,132,199,0.15)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#0284C7' }}>Fine-Kinney Formülü: R = İhtimal × Frekans × Şiddet</p>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: 'İhtimal (İ)', desc: '0.2 – 10', sub: 'Olayın gerçekleşme ihtimali' }, { label: 'Frekans (F)', desc: '0.5 – 10', sub: 'Tehlikeye maruz kalma sıklığı' }, { label: 'Şiddet (Ş)', desc: '1 – 100', sub: 'Zararın büyüklüğü' }].map(item => (
                    <div key={item.label} className="rounded-lg p-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                      <p className="text-[11px] font-bold mt-0.5" style={{ color: '#0284C7' }}>{item.desc}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sektör</label>
                <div className="grid grid-cols-3 gap-2">
                  {SEKTORLER.map(s => (
                    <button key={s} onClick={() => setSektor(s)} className="text-xs py-2 px-3 rounded-lg text-left cursor-pointer transition-all overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ background: sektor === s ? 'rgba(2,132,199,0.1)' : 'var(--bg-app)', border: `1px solid ${sektor === s ? 'rgba(2,132,199,0.4)' : 'var(--border-main)'}`, color: sektor === s ? '#0284C7' : 'var(--text-muted)', fontWeight: sektor === s ? 600 : 400 }}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Ne analiz edilsin?</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                  placeholder="Örnek: Yüksekte çalışma ile ilgili 5 risk yaz&#10;Örnek: Forklift operasyonuna ait 8 risk analizi yap"
                  rows={4} className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
              </div>
              {error && <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626' }}>{error}</div>}
            </div>
          ) : (
            <div className="p-6">
              {/* Özet badges */}
              <div className="flex flex-wrap gap-3 mb-5">
                {Object.entries(rows.reduce((acc, r) => { acc[r.riskSeviyesi] = (acc[r.riskSeviyesi] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([sev, count]) => {
                  const st = RISK_SEVIYE_STYLE[sev] || { bg: 'rgba(100,116,139,0.1)', color: '#64748B' };
                  return <div key={sev} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: st.bg, border: `1px solid ${st.color}30` }}><span className="text-lg font-bold" style={{ color: st.color }}>{count}</span><span className="text-xs font-semibold" style={{ color: st.color }}>{sev}</span></div>;
                })}
                <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)' }}>
                  <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{rows.length}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Toplam Risk</span>
                </div>
              </div>

              {/* Tablo — hem UI hem PDF için */}
              <div ref={tableRef}>
                {/* PDF için beyaz arka plan wrapper */}
                <div id="risk-analizi-pdf" style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
                  {/* PDF Header */}
                  <div style={{ borderBottom: '2px solid #0284C7', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0284C7', margin: 0 }}>Risk Analizi Tablosu</h1>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Fine-Kinney Metodu — {sektor}</p>
                      </div>
                      <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{today}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {Object.entries(rows.reduce((acc, r) => { acc[r.riskSeviyesi] = (acc[r.riskSeviyesi] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([sev, count]) => {
                        const st = RISK_SEVIYE_STYLE[sev] || { bg: 'rgba(100,116,139,0.1)', color: '#64748B' };
                        return <span key={sev} style={{ fontSize: '11px', fontWeight: 600, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: '4px' }}>{count} {sev}</span>;
                      })}
                    </div>
                  </div>

                  {/* Tablo */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            {['No', 'Bölüm', 'Tehlike Kaynağı', 'Olası Zarar', 'İ', 'F', 'Ş', 'Risk', 'Seviye', 'Önleyici Faaliyet', ''].map((h, hi) => (
                              <th key={hi} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: '#64748b', fontSize: '11px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => {
                            const st = RISK_SEVIYE_STYLE[row.riskSeviyesi] || { bg: 'rgba(100,116,139,0.1)', color: '#64748B' };
                            return (
                              <tr key={i} className="group" style={{ borderBottom: '1px solid #e2e8f0' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <td className="px-3 py-2" style={{ color: '#94a3b8', fontSize: '11px' }}>{row.no}</td>
                                <td className="px-3 py-2" style={{ minWidth: '100px' }}><EditableCell value={row.tehlikeBolumu} onChange={v => updateRow(i, 'tehlikeBolumu', v)} /></td>
                                <td className="px-3 py-2" style={{ minWidth: '160px' }}><EditableCell value={row.tehlikeKaynagi} onChange={v => updateRow(i, 'tehlikeKaynagi', v)} minWidth="140px" /></td>
                                <td className="px-3 py-2" style={{ minWidth: '140px' }}><EditableCell value={row.olasiZarar} onChange={v => updateRow(i, 'olasiZarar', v)} minWidth="120px" /></td>
                                <td className="px-3 py-2 text-center"><EditableCell value={row.ihtimal} onChange={v => updateRow(i, 'ihtimal', v)} numeric /></td>
                                <td className="px-3 py-2 text-center"><EditableCell value={row.frekans} onChange={v => updateRow(i, 'frekans', v)} numeric /></td>
                                <td className="px-3 py-2 text-center"><EditableCell value={row.siddet} onChange={v => updateRow(i, 'siddet', v)} numeric /></td>
                                <td className="px-3 py-2 text-center font-bold" style={{ color: st.color }}>{row.riskSkoru}</td>
                                <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{row.riskSeviyesi}</span></td>
                                <td className="px-3 py-2" style={{ minWidth: '200px' }}><EditableCell value={row.onleyiciFaaliyet} onChange={v => updateRow(i, 'onleyiciFaaliyet', v)} minWidth="180px" /></td>
                                <td className="px-3 py-2">
                                  <button onClick={() => removeRow(i)} className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded cursor-pointer" style={{ color: '#DC2626' }} title="Satırı sil">
                                    <i className="ri-close-line text-xs" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Satır Ekle */}
                  <button onClick={addRow} className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all"
                    style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-main)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0284C7'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(2,132,199,0.4)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-main)'; }}>
                    <i className="ri-add-line" /> Yeni Satır Ekle
                  </button>

                  {/* PDF Footer */}
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '20px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>ISG Denetim Yönetim Sistemi — Fine-Kinney Risk Analizi</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>{today}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border-main)', background: 'var(--bg-app)' }}>
          {step === 'result' ? (
            <>
              <button onClick={() => { setStep('form'); setRows([]); }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>
                <i className="ri-arrow-left-line" /> Yeniden Oluştur
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sektor} — {rows.length} risk</span>
                <button onClick={handlePDF} disabled={pdfLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  style={{ background: pdfLoading ? 'rgba(2,132,199,0.4)' : '#0284C7', color: '#fff', opacity: pdfLoading ? 0.7 : 1 }}>
                  {pdfLoading ? <><i className="ri-loader-4-line animate-spin" /> Hazırlanıyor...</> : <><i className="ri-file-pdf-line" /> PDF İndir</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>İptal</button>
              <button onClick={handleGenerate} disabled={!sektor || !prompt.trim() || loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: !sektor || !prompt.trim() || loading ? 'rgba(2,132,199,0.4)' : '#0284C7', color: '#fff', opacity: !sektor || !prompt.trim() || loading ? 0.6 : 1 }}>
                {loading ? <><i className="ri-loader-4-line animate-spin" /> Analiz Yapılıyor...</> : <><i className="ri-sparkling-2-line" /> Analiz Oluştur</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
