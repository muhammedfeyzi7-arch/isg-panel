import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import InlineEdit from './InlineEdit';
import { exportToPDF } from '../utils/pdfExport';

interface EkipUye {
  ad: string;
  gorev: string;
  sorumluluklar: string[];
}

interface Ekip {
  ekipAdi: string;
  ekipRengi: string;
  aciklama: string;
  uyeler: EkipUye[];
}

interface Props { onClose: () => void; }

const EKIP_RENKLERI: Record<string, { bg: string; color: string; border: string }> = {
  'Yangın Söndürme Ekibi': { bg: 'rgba(220,38,38,0.08)',  color: '#DC2626', border: 'rgba(220,38,38,0.2)' },
  'Tahliye Ekibi':         { bg: 'rgba(234,88,12,0.08)',  color: '#EA580C', border: 'rgba(234,88,12,0.2)' },
  'İlk Yardım Ekibi':      { bg: 'rgba(5,150,105,0.08)',  color: '#059669', border: 'rgba(5,150,105,0.2)' },
  'Kurtarma Ekibi':        { bg: 'rgba(217,119,6,0.08)',  color: '#D97706', border: 'rgba(217,119,6,0.2)' },
  'Haberleşme Ekibi':      { bg: 'rgba(2,132,199,0.08)',  color: '#0284C7', border: 'rgba(2,132,199,0.2)' },
  'Koruma ve Güvenlik':    { bg: 'rgba(124,58,237,0.08)', color: '#7C3AED', border: 'rgba(124,58,237,0.2)' },
};
const DEFAULT_STYLE = { bg: 'rgba(100,116,139,0.08)', color: '#64748B', border: 'rgba(100,116,139,0.2)' };

export default function AcilDurumEkipleriModal({ onClose }: Props) {
  const [firmaAdi, setFirmaAdi] = useState('');
  const [calisanSayisi, setCalisanSayisi] = useState('');
  const [sektor, setSektor] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [ekipler, setEkipler] = useState<Ekip[]>([]);
  const [activeEkip, setActiveEkip] = useState(0);

  const SEKTORLER = ['İnşaat', 'Liman / Denizcilik', 'Metal / Çelik', 'Kimya', 'Gıda', 'Tekstil', 'Madencilik', 'Enerji', 'Sağlık', 'Ulaşım', 'Diğer'];

  const handleGenerate = async () => {
    if (!firmaAdi.trim()) return;
    setLoading(true); setError('');
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('openai-assistant', { body: { mode: 'acil-durum-ekipleri', data: { firmaAdi, calisanSayisi, sektor, prompt } } });
      if (fnErr) throw new Error(fnErr.message);
      if (!fnData?.success) throw new Error(fnData?.error || 'Bilinmeyen hata');
      setEkipler(fnData.data.ekipler || []);
      setActiveEkip(0);
      setStep('result');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Bir hata oluştu'); }
    finally { setLoading(false); }
  };

  // Ekip düzenleme
  const updateEkipAdi = (ei: number, val: string) => setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, ekipAdi: val } : e));
  const updateEkipAciklama = (ei: number, val: string) => setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, aciklama: val } : e));
  const updateUyeAd = (ei: number, ui: number, val: string) => setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, uyeler: e.uyeler.map((u, j) => j === ui ? { ...u, ad: val } : u) } : e));
  const updateUyeGorev = (ei: number, ui: number, val: string) => setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, uyeler: e.uyeler.map((u, j) => j === ui ? { ...u, gorev: val } : u) } : e));
  const updateSorumluluk = (ei: number, ui: number, si: number, val: string) => setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, uyeler: e.uyeler.map((u, j) => j === ui ? { ...u, sorumluluklar: u.sorumluluklar.map((s, k) => k === si ? val : s) } : u) } : e));
  const addSorumluluk = (ei: number, ui: number) => setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, uyeler: e.uyeler.map((u, j) => j === ui ? { ...u, sorumluluklar: [...u.sorumluluklar, 'Yeni sorumluluk...'] } : u) } : e));
  const removeSorumluluk = (ei: number, ui: number, si: number) => setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, uyeler: e.uyeler.map((u, j) => j === ui ? { ...u, sorumluluklar: u.sorumluluklar.filter((_, k) => k !== si) } : u) } : e));

  // Yeni ekip ekle
  const addEkip = () => {
    const newEkip: Ekip = { ekipAdi: 'Yeni Ekip', ekipRengi: 'gri', aciklama: 'Ekip açıklaması...', uyeler: [{ ad: 'Ekip Lideri', gorev: 'Lider', sorumluluklar: ['Ekibi yönetir', 'Raporlama yapar'] }] };
    setEkipler(prev => [...prev, newEkip]);
    setActiveEkip(ekipler.length);
  };

  // Yeni üye ekle
  const addUye = (ei: number) => {
    const newUye: EkipUye = { ad: `${ekipler[ei]?.uyeler?.length + 1 || 1}. Üye`, gorev: 'Üye', sorumluluklar: ['Görev tanımı...'] };
    setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, uyeler: [...e.uyeler, newUye] } : e));
  };

  // Üye sil
  const removeUye = (ei: number, ui: number) => {
    setEkipler(prev => prev.map((e, i) => i === ei ? { ...e, uyeler: e.uyeler.filter((_, j) => j !== ui) } : e));
  };

  // Ekip sil
  const removeEkip = (ei: number) => {
    setEkipler(prev => prev.filter((_, i) => i !== ei));
    setActiveEkip(Math.max(0, activeEkip - 1));
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try { await exportToPDF('acil-ekipler-pdf', `Acil-Durum-Ekipleri-${firmaAdi}`); }
    finally { setPdfLoading(false); }
  };

  const currentEkip = ekipler[activeEkip];
  const ekipStyle = currentEkip ? (EKIP_RENKLERI[currentEkip.ekipAdi] || DEFAULT_STYLE) : DEFAULT_STYLE;
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: step === 'result' ? '900px' : '540px', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)' }}>
              <i className="ri-team-line text-sm" style={{ color: '#D97706' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Acil Durum Ekipleri</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ekip Oluşturma ve Görev Dağılımı</p>
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

        <div className="flex-1 overflow-hidden">
          {step === 'form' ? (
            <div className="p-6 space-y-5 overflow-y-auto h-full">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Firma / İşyeri Adı *</label>
                  <input value={firmaAdi} onChange={e => setFirmaAdi(e.target.value)} placeholder="Örn: DEF Enerji A.Ş."
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Çalışan Sayısı</label>
                  <input value={calisanSayisi} onChange={e => setCalisanSayisi(e.target.value)} placeholder="Örn: 80"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sektör</label>
                <div className="flex flex-wrap gap-2">
                  {SEKTORLER.map(s => (
                    <button key={s} onClick={() => setSektor(s)} className="text-xs py-1.5 px-3 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                      style={{ background: sektor === s ? 'rgba(217,119,6,0.08)' : 'var(--bg-app)', border: `1px solid ${sektor === s ? 'rgba(217,119,6,0.35)' : 'var(--border-main)'}`, color: sektor === s ? '#D97706' : 'var(--text-muted)', fontWeight: sektor === s ? 600 : 400 }}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Ek Notlar <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(isteğe bağlı)</span></label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                  placeholder="Örn: 6 ekip oluştur, her ekipte 4 kişi olsun" rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
              </div>
              {error && <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626' }}>{error}</div>}
            </div>
          ) : (
            <div className="flex h-full" style={{ minHeight: '400px' }}>
              {/* Sol — Ekip Listesi */}
              <div className="w-52 flex-shrink-0 border-r overflow-y-auto flex flex-col" style={{ borderColor: 'var(--border-main)', background: 'var(--bg-app)' }}>
                <div className="p-3 space-y-1.5 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider px-2 mb-2" style={{ color: 'var(--text-muted)' }}>Ekipler ({ekipler.length})</p>
                  {ekipler.map((ekip, i) => {
                    const st = EKIP_RENKLERI[ekip.ekipAdi] || DEFAULT_STYLE;
                    return (
                      <div key={i} className="group relative">
                        <button onClick={() => setActiveEkip(i)} className="w-full text-left px-3 py-2.5 rounded-lg cursor-pointer transition-all pr-7"
                          style={{ background: activeEkip === i ? st.bg : 'transparent', border: `1px solid ${activeEkip === i ? st.border : 'transparent'}` }}>
                          <p className="text-xs font-semibold leading-tight truncate" style={{ color: activeEkip === i ? st.color : 'var(--text-primary)' }}>{ekip.ekipAdi}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{ekip.uyeler?.length || 0} üye</p>
                        </button>
                        <button onClick={() => removeEkip(i)} className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded cursor-pointer" style={{ color: '#DC2626' }}>
                          <i className="ri-close-line text-xs" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* Yeni Ekip Ekle */}
                <div className="p-3 border-t" style={{ borderColor: 'var(--border-main)' }}>
                  <button onClick={addEkip} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs cursor-pointer transition-all"
                    style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-main)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D97706'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(217,119,6,0.4)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-main)'; }}>
                    <i className="ri-add-line" /> Yeni Ekip
                  </button>
                </div>
              </div>

              {/* Sağ — Ekip Detayı */}
              {currentEkip && (
                <div className="flex-1 overflow-y-auto">
                  {/* PDF wrapper */}
                  <div id="acil-ekipler-pdf" style={{ background: '#fff', padding: '20px' }}>
                    {/* PDF Header (sadece PDF'te görünür) */}
                    <div className="hidden" style={{ display: 'none' }}>
                      <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#D97706' }}>Acil Durum Ekipleri — {firmaAdi}</h1>
                      <p style={{ fontSize: '11px', color: '#94a3b8' }}>{today}</p>
                    </div>

                    <div className="p-5">
                      {/* Ekip Başlık */}
                      <div className="flex items-start gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid var(--border-main)' }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ekipStyle.bg, border: `1px solid ${ekipStyle.border}` }}>
                          <i className="ri-team-line text-base" style={{ color: ekipStyle.color }} />
                        </div>
                        <div className="flex-1">
                          <InlineEdit value={currentEkip.ekipAdi} onChange={v => updateEkipAdi(activeEkip, v)} style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }} />
                          <div className="mt-1">
                            <InlineEdit value={currentEkip.aciklama} onChange={v => updateEkipAciklama(activeEkip, v)} multiline style={{ fontSize: '12px', color: 'var(--text-muted)' }} />
                          </div>
                        </div>
                      </div>

                      {/* Üyeler */}
                      <div className="space-y-3">
                        {currentEkip.uyeler?.map((uye, ui) => (
                          <div key={ui} className="rounded-xl p-4 group relative" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)' }}>
                            <button onClick={() => removeUye(activeEkip, ui)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded cursor-pointer" style={{ color: '#DC2626' }}>
                              <i className="ri-close-line text-xs" />
                            </button>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: ekipStyle.color }}>{ui + 1}</div>
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <InlineEdit value={uye.ad} onChange={v => updateUyeAd(activeEkip, ui, v)} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }} placeholder="Üye adı..." />
                                <InlineEdit value={uye.gorev} onChange={v => updateUyeGorev(activeEkip, ui, v)} style={{ fontSize: '11px', color: ekipStyle.color }} placeholder="Görev..." />
                              </div>
                            </div>
                            <ul className="space-y-1.5 pl-1">
                              {uye.sorumluluklar?.map((s, si) => (
                                <li key={si} className="flex items-start gap-1.5 group/item">
                                  <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: ekipStyle.color }} />
                                  <div className="flex-1">
                                    <InlineEdit value={s} onChange={v => updateSorumluluk(activeEkip, ui, si, v)} multiline style={{ fontSize: '11px', color: 'var(--text-muted)' }} />
                                  </div>
                                  <button onClick={() => removeSorumluluk(activeEkip, ui, si)} className="opacity-0 group-hover/item:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded cursor-pointer flex-shrink-0" style={{ color: '#DC2626' }}>
                                    <i className="ri-close-line text-[10px]" />
                                  </button>
                                </li>
                              ))}
                              <li>
                                <button onClick={() => addSorumluluk(activeEkip, ui)} className="flex items-center gap-1 text-[10px] cursor-pointer mt-1 px-1.5 py-0.5 rounded transition-all"
                                  style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-main)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ekipStyle.color; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
                                  <i className="ri-add-line" /> Sorumluluk Ekle
                                </button>
                              </li>
                            </ul>
                          </div>
                        ))}

                        {/* Yeni Üye Ekle */}
                        <button onClick={() => addUye(activeEkip)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs cursor-pointer transition-all"
                          style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-main)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ekipStyle.color; (e.currentTarget as HTMLElement).style.borderColor = ekipStyle.border; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-main)'; }}>
                          <i className="ri-user-add-line" /> Yeni Üye Ekle
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border-main)', background: 'var(--bg-app)' }}>
          {step === 'result' ? (
            <>
              <button onClick={() => { setStep('form'); setEkipler([]); }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>
                <i className="ri-arrow-left-line" /> Yeniden Oluştur
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{firmaAdi} — {ekipler.length} ekip</span>
                <button onClick={handlePDF} disabled={pdfLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  style={{ background: pdfLoading ? 'rgba(217,119,6,0.4)' : '#D97706', color: '#fff', opacity: pdfLoading ? 0.7 : 1 }}>
                  {pdfLoading ? <><i className="ri-loader-4-line animate-spin" /> Hazırlanıyor...</> : <><i className="ri-file-pdf-line" /> PDF İndir</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>İptal</button>
              <button onClick={handleGenerate} disabled={!firmaAdi.trim() || loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: !firmaAdi.trim() || loading ? 'rgba(217,119,6,0.4)' : '#D97706', color: '#fff', opacity: !firmaAdi.trim() || loading ? 0.6 : 1 }}>
                {loading ? <><i className="ri-loader-4-line animate-spin" /> Ekipler Oluşturuluyor...</> : <><i className="ri-sparkling-2-line" /> Ekipleri Oluştur</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
