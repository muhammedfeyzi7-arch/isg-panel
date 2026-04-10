import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { exportToPDF } from '../utils/pdfExport';

interface RiskRow {
  no: number;
  bolum: string;
  faaliyet: string;
  tehlikeKaynagi: string;
  tehlikeler: string;
  riskler: string;
  kimlerEtkilenir: string;
  mevcutDurum: string;
  // Mevcut risk
  o1: number;
  s1: number;
  f1: number;
  r1: number;
  riskTanimi1: string;
  // Planlama
  planlamaAnalizSonucu: string;
  // Düzeltici
  duzelticiTedbirler: string;
  sorumluluk: string;
  // Gerçekleştirilen
  gerceklestirilenTedbirler: string;
  gercTarih: string;
  // Sonraki risk
  o2: number;
  s2: number;
  f2: number;
  r2: number;
  riskTanimi2: string;
  aciklama: string;
}

const SEKTORLER = [
  'İnşaat', 'Liman / Denizcilik', 'Metal / Çelik', 'Kimya / Petrokimya',
  'Gıda Üretimi', 'Tekstil', 'Madencilik', 'Enerji / Elektrik',
  'Sağlık / Hastane', 'Ulaşım / Lojistik', 'Orman / Ağaç İşleme', 'Diğer',
];

const OLASILIK_TABLOSU = [
  { deger: 10, aciklama: 'Beklenir, kesin' },
  { deger: 6, aciklama: 'Yüksek, oldukça mümkün' },
  { deger: 3, aciklama: 'Olası' },
  { deger: 1, aciklama: 'Mümkün fakat düşük' },
  { deger: 0.5, aciklama: 'Beklenmesi fakat mümkün' },
  { deger: 0.2, aciklama: 'Beklenmez' },
];

const SIDDET_TABLOSU = [
  { deger: 100, aciklama: 'Birden fazla ölümlü kaza/Çevresel felaket' },
  { deger: 40, aciklama: 'Ölümlü kaza/Büyük çevresel zarar' },
  { deger: 15, aciklama: 'Kalıcı hasar/Yaralanma, iş kaybı/Çevresel engel' },
  { deger: 7, aciklama: 'Önemli yaralanma, ilk yardım ihtiyacı' },
  { deger: 3, aciklama: 'Küçük hasar/Yaralanma, dahili ilk yardım' },
  { deger: 1, aciklama: 'Ucuz atlatma/Çevresel zarar yok' },
];

const FREKANS_TABLOSU = [
  { deger: 10, aciklama: 'Hemen hemen sürekli (bir saatte birkaç defa)' },
  { deger: 6, aciklama: 'Sık (günde bir veya birkaç defa)' },
  { deger: 3, aciklama: 'Ara sıra (haftada bir veya birkaç defa)' },
  { deger: 2, aciklama: 'Sık değil (ayda bir veya birkaç defa)' },
  { deger: 1, aciklama: 'Seyrek (yılda birkaç defa)' },
  { deger: 0.5, aciklama: 'Çok seyrek (yılda bir veya daha seyrek)' },
];

const RISK_DERECELENDIRME = [
  { min: 400, label: 'TOLERANS GÖSTERİLEMEZ RİSK', aciklama: 'Hemen gerekli önlemler alınmalı veya iş durdurulmalı', bg: '#DC2626', color: '#fff' },
  { min: 200, label: 'YÜKSEK RİSK (Esaslı risk)', aciklama: 'En kısa dönemde iyileştirilmeli (bir hafta içerisinde)', bg: '#EA580C', color: '#fff' },
  { min: 70, label: 'ÖNEMLİ RİSK', aciklama: 'Kısa dönemde iyileştirilmeli (1 hafta içerisinde)', bg: '#D97706', color: '#fff' },
  { min: 20, label: 'KESİN RİSK (Olası risk)', aciklama: 'Gözetim altında uygulanmalıdır', bg: '#16A34A', color: '#fff' },
  { min: 0, label: 'KABUL EDİLEBİLİR RİSK (Önemsiz risk)', aciklama: 'Önlem öncelikli değil', bg: '#0284C7', color: '#fff' },
];

const RISK_SEVIYE_STYLE: Record<string, { bg: string; color: string }> = {
  'Tolerans Gösterilemez': { bg: 'rgba(220,38,38,0.12)', color: '#DC2626' },
  'Esaslı':               { bg: 'rgba(234,88,12,0.12)',  color: '#EA580C' },
  'Önemli':               { bg: 'rgba(217,119,6,0.12)',  color: '#D97706' },
  'Olası':                { bg: 'rgba(22,163,74,0.12)',   color: '#16A34A' },
  'Önemsiz':              { bg: 'rgba(2,132,199,0.12)',   color: '#0284C7' },
};

function getRiskSeviyesi(skor: number): string {
  if (skor >= 400) return 'Tolerans Gösterilemez';
  if (skor >= 200) return 'Esaslı';
  if (skor >= 70)  return 'Önemli';
  if (skor >= 20)  return 'Olası';
  return 'Önemsiz';
}

function calcR(o: number, s: number, f: number) { return Math.round(o * s * f); }

function EditableCell({ value, onChange, numeric = false, minW = '80px', multiline = false }: {
  value: string | number; onChange: (v: string) => void; numeric?: boolean; minW?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (t !== String(value)) onChange(t);
    else setDraft(String(value));
  };
  const style: React.CSSProperties = {
    background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.35)',
    color: 'var(--text-primary)', fontSize: '11px', width: '100%', minWidth: minW,
    borderRadius: '4px', padding: '2px 6px', outline: 'none', resize: 'none',
  };
  if (editing) {
    if (multiline) return (
      <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
        rows={2} style={style} />
    );
    return (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); } }}
        style={style} />
    );
  }
  return (
    <span onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="cursor-text rounded inline-block w-full transition-all"
      style={{ minWidth: numeric ? '32px' : minW, fontSize: '11px', lineHeight: '1.4', color: 'var(--text-primary)', display: 'block' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'; (e.currentTarget as HTMLElement).style.outline = '1px dashed rgba(99,102,241,0.3)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.outline = 'none'; }}
      title="Düzenlemek için tıklayın">{value}</span>
  );
}

interface FirmaBilgileri {
  firmaAdi: string;
  adres: string;
  isverenAdi: string;
  revizyonNo: string;
  gerceklesmeTarihi: string;
  gecerlilikTarihi: string;
}

interface Props { onClose: () => void; }

export default function RiskAnaliziModal({ onClose }: Props) {
  const [sektor, setSektor] = useState('');
  const [firmaAdi, setFirmaAdi] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [showRefTables, setShowRefTables] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const [firmaBilgileri, setFirmaBilgileri] = useState<FirmaBilgileri>({
    firmaAdi: '',
    adres: '',
    isverenAdi: '',
    revizyonNo: '0',
    gerceklesmeTarihi: todayStr,
    gecerlilikTarihi: '',
  });

  const updateFirma = (field: keyof FirmaBilgileri, val: string) =>
    setFirmaBilgileri(prev => ({ ...prev, [field]: val }));

  const handleGenerate = async () => {
    if (!sektor || !prompt.trim()) return;
    setLoading(true); setError('');
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('openai-assistant', {
        body: { mode: 'risk-analizi-v2', data: { sektor, firmaAdi, prompt } },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (!fnData?.success) throw new Error(fnData?.error || 'Bilinmeyen hata');
      setRows(fnData.data.rows || []);
      // Firma adını form'dan al
      setFirmaBilgileri(prev => ({ ...prev, firmaAdi: firmaAdi || prev.firmaAdi }));
      setStep('result');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Bir hata oluştu'); }
    finally { setLoading(false); }
  };

  const updateRow = (i: number, field: keyof RiskRow, val: string) => {
    setRows(prev => {
      const next = [...prev];
      const row = { ...next[i] } as Record<string, unknown>;
      const numFields = ['o1', 's1', 'f1', 'o2', 's2', 'f2'];
      if (numFields.includes(field)) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          row[field] = num;
          if (['o1', 's1', 'f1'].includes(field)) {
            const r = next[i];
            const o1 = field === 'o1' ? num : r.o1;
            const s1 = field === 's1' ? num : r.s1;
            const f1 = field === 'f1' ? num : r.f1;
            row.r1 = calcR(o1, s1, f1);
            row.riskTanimi1 = getRiskSeviyesi(row.r1 as number);
          }
          if (['o2', 's2', 'f2'].includes(field)) {
            const r = next[i];
            const o2 = field === 'o2' ? num : r.o2;
            const s2 = field === 's2' ? num : r.s2;
            const f2 = field === 'f2' ? num : r.f2;
            row.r2 = calcR(o2, s2, f2);
            row.riskTanimi2 = getRiskSeviyesi(row.r2 as number);
          }
        }
      } else {
        row[field] = val;
      }
      next[i] = row as unknown as RiskRow;
      return next;
    });
  };

  const addRow = () => {
    const no = rows.length + 1;
    setRows(prev => [...prev, {
      no, bolum: 'Yeni Bölüm', faaliyet: 'Faaliyet...', tehlikeKaynagi: 'Tehlike kaynağı...',
      tehlikeler: 'Tehlike...', riskler: 'Risk...', kimlerEtkilenir: 'Tüm çalışanlar',
      mevcutDurum: 'Mevcut durum...', o1: 3, s1: 7, f1: 3, r1: 63, riskTanimi1: 'Önemli',
      planlamaAnalizSonucu: 'Hemen gerekli önlemler alınmalı', duzelticiTedbirler: 'Önleyici tedbir...',
      sorumluluk: 'İşveren', gerceklestirilenTedbirler: 'Gerçekleştirilen tedbir...',
      gercTarih: '', o2: 0.5, s2: 7, f2: 3, r2: 11, riskTanimi2: 'Önemsiz', aciklama: '',
    }]);
  };

  const removeRow = (i: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, no: idx + 1 })));
  };

  const handlePDF = async () => {
    if (!tableRef.current) return;
    setPdfLoading(true);
    try {
      await exportToPDF(
        tableRef.current,
        `Risk-Analizi-${firmaBilgileri.firmaAdi || firmaAdi || sektor}`,
      );
    } finally { setPdfLoading(false); }
  };

  const riskSummary = rows.reduce((acc, r) => { acc[r.riskTanimi1] = (acc[r.riskTanimi1] || 0) + 1; return acc; }, {} as Record<string, number>);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: step === 'result' ? '98vw' : '580px', maxHeight: '92vh', background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(2,132,199,0.1)', border: '1px solid rgba(2,132,199,0.2)' }}>
              <i className="ri-bar-chart-grouped-line text-sm" style={{ color: '#0284C7' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Risk Değerlendirme Raporu</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fine-Kinney Metodu — AI Destekli Analiz Formu</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 'result' && (
              <>
                <button onClick={() => setShowRefTables(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg cursor-pointer"
                  style={{ background: showRefTables ? 'rgba(2,132,199,0.08)' : 'var(--bg-app)', border: '1px solid var(--border-main)', color: showRefTables ? '#0284C7' : 'var(--text-muted)' }}>
                  <i className="ri-table-line" /> Referans Tablolar
                </button>
                <span className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <i className="ri-edit-line mr-1" />Hücrelere tıklayarak düzenleyin
                </span>
              </>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)' }}>
              <i className="ri-close-line text-sm" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'form' ? (
            <div className="p-6 space-y-5">
              {/* Fine-Kinney açıklama */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(2,132,199,0.05)', border: '1px solid rgba(2,132,199,0.15)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: '#0284C7' }}>Fine-Kinney Formülü: R = Olasılık (O) × Şiddet (Ş) × Frekans (F)</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Olasılık (O)', range: '0.2 – 10', sub: 'Olayın gerçekleşme ihtimali' },
                    { label: 'Şiddet (Ş)', range: '1 – 100', sub: 'Zararın büyüklüğü' },
                    { label: 'Frekans (F)', range: '0.5 – 10', sub: 'Tehlikeye maruz kalma sıklığı' },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg p-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                      <p className="text-[11px] font-bold mt-0.5" style={{ color: '#0284C7' }}>{item.range}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Firma / İşyeri Adı</label>
                  <input value={firmaAdi} onChange={e => setFirmaAdi(e.target.value)} placeholder="Örn: ABC Tekstil Ltd."
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sektör *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SEKTORLER.map(s => (
                      <button key={s} onClick={() => setSektor(s)} className="text-xs py-1.5 px-2 rounded-lg text-left cursor-pointer transition-all overflow-hidden text-ellipsis whitespace-nowrap"
                        style={{ background: sektor === s ? 'rgba(2,132,199,0.1)' : 'var(--bg-app)', border: `1px solid ${sektor === s ? 'rgba(2,132,199,0.4)' : 'var(--border-main)'}`, color: sektor === s ? '#0284C7' : 'var(--text-muted)', fontWeight: sektor === s ? 600 : 400 }}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Ne analiz edilsin? *</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                  placeholder="Örnek: Yüksekte çalışma ile ilgili 5 risk yaz&#10;Örnek: Forklift operasyonuna ait 8 risk analizi yap"
                  rows={4} className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
              </div>
              {error && <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626' }}>{error}</div>}
            </div>
          ) : (
            <div className="p-4">
            {/* PDF export wrapper — beyaz arka plan, sabit renkler */}
            <div ref={tableRef} style={{ background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif' }}>
              {/* Referans Tablolar */}
              {showRefTables && (
                <div className="mb-5 grid grid-cols-4 gap-3">
                  {/* Olasılık Tablosu */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                    <div className="px-3 py-2 text-center" style={{ background: '#1e3a5f' }}>
                      <p className="text-[10px] font-bold text-white">OLASILIK DEĞERİ TABLOSU</p>
                    </div>
                    <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--border-main)', background: 'rgba(30,58,95,0.06)' }}>
                      <div className="px-2 py-1 text-[9px] font-bold text-center" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-main)' }}>OLASILIK DEĞERİ</div>
                      <div className="px-2 py-1 text-[9px] font-bold text-center" style={{ color: 'var(--text-muted)' }}>OLASILIK</div>
                    </div>
                    {OLASILIK_TABLOSU.map((row, i) => (
                      <div key={i} className="grid grid-cols-2" style={{ borderBottom: i < OLASILIK_TABLOSU.length - 1 ? '1px solid var(--border-main)' : 'none' }}>
                        <div className="px-2 py-1.5 text-[10px] font-bold text-center" style={{ color: '#0284C7', borderRight: '1px solid var(--border-main)', background: 'rgba(2,132,199,0.04)' }}>{row.deger}</div>
                        <div className="px-2 py-1.5 text-[9px]" style={{ color: 'var(--text-primary)' }}>{row.aciklama}</div>
                      </div>
                    ))}
                  </div>

                  {/* Şiddet Tablosu */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                    <div className="px-3 py-2 text-center" style={{ background: '#1e3a5f' }}>
                      <p className="text-[10px] font-bold text-white">ŞİDDET DEĞERİ TABLOSU</p>
                    </div>
                    <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--border-main)', background: 'rgba(30,58,95,0.06)' }}>
                      <div className="px-2 py-1 text-[9px] font-bold text-center" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-main)' }}>ŞİDDET DEĞERİ</div>
                      <div className="px-2 py-1 text-[9px] font-bold text-center" style={{ color: 'var(--text-muted)' }}>ŞİDDET</div>
                    </div>
                    {SIDDET_TABLOSU.map((row, i) => (
                      <div key={i} className="grid grid-cols-2" style={{ borderBottom: i < SIDDET_TABLOSU.length - 1 ? '1px solid var(--border-main)' : 'none' }}>
                        <div className="px-2 py-1.5 text-[10px] font-bold text-center" style={{ color: '#EA580C', borderRight: '1px solid var(--border-main)', background: 'rgba(234,88,12,0.04)' }}>{row.deger}</div>
                        <div className="px-2 py-1.5 text-[9px]" style={{ color: 'var(--text-primary)' }}>{row.aciklama}</div>
                      </div>
                    ))}
                  </div>

                  {/* Frekans Tablosu */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                    <div className="px-3 py-2 text-center" style={{ background: '#1e3a5f' }}>
                      <p className="text-[10px] font-bold text-white">FREKANS DEĞERİ TABLOSU</p>
                    </div>
                    <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--border-main)', background: 'rgba(30,58,95,0.06)' }}>
                      <div className="px-2 py-1 text-[9px] font-bold text-center" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-main)' }}>FREKANS DEĞERİ</div>
                      <div className="px-2 py-1 text-[9px] font-bold text-center" style={{ color: 'var(--text-muted)' }}>FREKANS</div>
                    </div>
                    {FREKANS_TABLOSU.map((row, i) => (
                      <div key={i} className="grid grid-cols-2" style={{ borderBottom: i < FREKANS_TABLOSU.length - 1 ? '1px solid var(--border-main)' : 'none' }}>
                        <div className="px-2 py-1.5 text-[10px] font-bold text-center" style={{ color: '#16A34A', borderRight: '1px solid var(--border-main)', background: 'rgba(22,163,74,0.04)' }}>{row.deger}</div>
                        <div className="px-2 py-1.5 text-[9px]" style={{ color: 'var(--text-primary)' }}>{row.aciklama}</div>
                      </div>
                    ))}
                  </div>

                  {/* Risk Derecelendirme */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                    <div className="px-3 py-2 text-center" style={{ background: '#1e3a5f' }}>
                      <p className="text-[10px] font-bold text-white">RİSK DERECELENDİRME TABLOSU</p>
                    </div>
                    <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--border-main)', background: 'rgba(30,58,95,0.06)' }}>
                      <div className="px-2 py-1 text-[9px] font-bold text-center" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-main)' }}>RİSK DEĞERİ</div>
                      <div className="px-2 py-1 text-[9px] font-bold text-center" style={{ color: 'var(--text-muted)' }}>RİSK DEĞERLENDİRME SONUCU</div>
                    </div>
                    {RISK_DERECELENDIRME.map((row, i) => (
                      <div key={i} className="grid grid-cols-2" style={{ borderBottom: i < RISK_DERECELENDIRME.length - 1 ? '1px solid var(--border-main)' : 'none' }}>
                        <div className="px-2 py-1.5 text-[10px] font-bold text-center flex items-center justify-center" style={{ color: '#fff', background: row.bg, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                          {i === 0 ? 'R≥400' : i === 1 ? '200≤R&lt;400' : i === 2 ? '70≤R&lt;200' : i === 3 ? '20≤R&lt;70' : 'R≤20'}
                        </div>
                        <div className="px-2 py-1.5" style={{ background: row.bg }}>
                          <p className="text-[9px] font-bold" style={{ color: row.color }}>{row.label}</p>
                          <p className="text-[8px] mt-0.5" style={{ color: row.color, opacity: 0.85 }}>{row.aciklama}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Firma Bilgileri Başlık — Düzenlenebilir */}
              <div className="rounded-xl mb-4 overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                {/* Başlık satırı */}
                <div className="px-4 py-2.5 flex items-center justify-between gap-4" style={{ background: '#1e3a5f' }}>
                  <div className="flex-1">
                    <EditableCell
                      value={firmaBilgileri.firmaAdi || firmaAdi || 'Firma Adı'}
                      onChange={v => updateFirma('firmaAdi', v)}
                      minW="200px"
                    />
                    {/* Inline style override for white text on dark bg */}
                    <style>{`.firma-baslik-edit span { color: #fff !important; font-size: 12px !important; font-weight: 700 !important; }`}</style>
                  </div>
                  <p className="text-[10px] text-white/70 whitespace-nowrap">RİSK DEĞERLENDİRME RAPORU — Fine-Kinney Metodu</p>
                </div>

                {/* Adres + İşveren satırı */}
                <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--border-main)' }}>
                  <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-main)' }}>
                    <p className="text-[9px] font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Adres</p>
                    <EditableCell value={firmaBilgileri.adres || 'Firma adresi...'} onChange={v => updateFirma('adres', v)} minW="200px" multiline />
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>İşveren Adı Soyadı</p>
                    <EditableCell value={firmaBilgileri.isverenAdi || 'İşveren adı...'} onChange={v => updateFirma('isverenAdi', v)} minW="150px" />
                  </div>
                </div>

                {/* Alt bilgi satırı */}
                <div className="grid grid-cols-4">
                  {[
                    { label: 'Sektör', field: null as null, value: sektor },
                    { label: 'Revizyon No', field: 'revizyonNo' as keyof FirmaBilgileri, value: firmaBilgileri.revizyonNo },
                    { label: 'Gerçekleşme Tarihi', field: 'gerceklesmeTarihi' as keyof FirmaBilgileri, value: firmaBilgileri.gerceklesmeTarihi },
                    { label: 'Geçerlilik Tarihi', field: 'gecerlilikTarihi' as keyof FirmaBilgileri, value: firmaBilgileri.gecerlilikTarihi },
                  ].map((item, i) => (
                    <div key={i} className="px-3 py-2" style={{ borderRight: i < 3 ? '1px solid var(--border-main)' : 'none' }}>
                      <p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      {item.field ? (
                        <EditableCell value={item.value || '—'} onChange={v => updateFirma(item.field!, v)} minW="80px" />
                      ) : (
                        <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.value || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Özet badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(riskSummary).map(([sev, count]) => {
                  const st = RISK_SEVIYE_STYLE[sev] || { bg: 'rgba(100,116,139,0.1)', color: '#64748B' };
                  return (
                    <div key={sev} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: st.bg, border: `1px solid ${st.color}30` }}>
                      <span className="text-sm font-bold" style={{ color: st.color }}>{count}</span>
                      <span className="text-[11px] font-semibold" style={{ color: st.color }}>{sev}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)' }}>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{rows.length}</span>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Toplam Risk</span>
                </div>
              </div>

              {/* Ana Tablo */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                <div className="overflow-x-auto">
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '1800px' }}>
                    <thead>
                      {/* Üst grup başlıkları */}
                      <tr style={{ background: '#1e3a5f' }}>
                        <th colSpan={3} style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)' }}>GENEL BİLGİLER</th>
                        <th colSpan={5} style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)' }}>TEHLİKELERE GÖRE MEVCUT DURUM RİSK SEVİYESİNİN TESPİT TABLOSU</th>
                        <th colSpan={4} style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', background: 'rgba(220,38,38,0.5)' }}>MEVCUT RİSK</th>
                        <th colSpan={3} style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)' }}>YAPILACAK/GERÇEKLEŞTİRİLEN DÜZELTİCİ/ÖNLEYİCİ FAALİYET</th>
                        <th colSpan={4} style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', background: 'rgba(22,163,74,0.5)' }}>SONRAKI RİSK</th>
                        <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>AÇIKLAMA</th>
                        <th style={{ padding: '6px 4px', fontSize: '10px', color: '#fff', textAlign: 'center' }}></th>
                      </tr>
                      {/* Alt başlıklar */}
                      <tr style={{ background: 'rgba(30,58,95,0.08)', borderBottom: '2px solid #1e3a5f' }}>
                        {[
                          'S.No', 'BÖLÜM', 'FAALİYET',
                          'TEHLİKE KAYNAĞI', 'TEHLİKELER', 'RİSKLER', 'KİMLER ETKİLENEBİLİR', 'MEVCUT DURUM',
                          'O', 'Ş', 'F', 'R / RİSK TANIMI',
                          'PLANLAMA VE ANALİZ SONUCU', 'DÜZELTİCİ/ÖNLEYİCİ KONTROL TEDBİRLERİ', 'SORUMLULUK',
                          'GERÇEKLEŞTİRİLEN TEDBİRLER', 'TARİH', 'O', 'Ş', 'F', 'R / RİSK TANIMI',
                          'AÇIKLAMA', '',
                        ].map((h, hi) => (
                          <th key={hi} style={{
                            padding: '5px 6px', fontSize: '9px', fontWeight: 700, color: 'var(--text-primary)',
                            textAlign: 'center', borderRight: '1px solid var(--border-main)',
                            whiteSpace: 'nowrap', background: 'inherit',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const st1 = RISK_SEVIYE_STYLE[row.riskTanimi1] || { bg: 'rgba(100,116,139,0.1)', color: '#64748B' };
                        const st2 = RISK_SEVIYE_STYLE[row.riskTanimi2] || { bg: 'rgba(100,116,139,0.1)', color: '#64748B' };
                        const rowBg = i % 2 === 0 ? 'transparent' : 'rgba(30,58,95,0.02)';
                        const td = (content: React.ReactNode, extra?: React.CSSProperties) => (
                          <td style={{ padding: '4px 6px', borderRight: '1px solid var(--border-main)', borderBottom: '1px solid var(--border-main)', verticalAlign: 'top', background: rowBg, ...extra }}>{content}</td>
                        );
                        return (
                          <tr key={i} className="group">
                            {td(<span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{row.no}</span>)}
                            {td(<EditableCell value={row.bolum} onChange={v => updateRow(i, 'bolum', v)} minW="80px" />)}
                            {td(<EditableCell value={row.faaliyet} onChange={v => updateRow(i, 'faaliyet', v)} minW="90px" multiline />)}
                            {td(<EditableCell value={row.tehlikeKaynagi} onChange={v => updateRow(i, 'tehlikeKaynagi', v)} minW="100px" multiline />)}
                            {td(<EditableCell value={row.tehlikeler} onChange={v => updateRow(i, 'tehlikeler', v)} minW="100px" multiline />)}
                            {td(<EditableCell value={row.riskler} onChange={v => updateRow(i, 'riskler', v)} minW="100px" multiline />)}
                            {td(<EditableCell value={row.kimlerEtkilenir} onChange={v => updateRow(i, 'kimlerEtkilenir', v)} minW="80px" />)}
                            {td(<EditableCell value={row.mevcutDurum} onChange={v => updateRow(i, 'mevcutDurum', v)} minW="100px" multiline />)}
                            {/* Mevcut risk */}
                            {td(<EditableCell value={row.o1} onChange={v => updateRow(i, 'o1', v)} numeric minW="32px" />, { background: 'rgba(220,38,38,0.04)' })}
                            {td(<EditableCell value={row.s1} onChange={v => updateRow(i, 's1', v)} numeric minW="32px" />, { background: 'rgba(220,38,38,0.04)' })}
                            {td(<EditableCell value={row.f1} onChange={v => updateRow(i, 'f1', v)} numeric minW="32px" />, { background: 'rgba(220,38,38,0.04)' })}
                            {td(
                              <div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: st1.color, display: 'block', textAlign: 'center' }}>{row.r1}</span>
                                <span style={{ fontSize: '8px', fontWeight: 600, color: st1.color, background: st1.bg, padding: '1px 4px', borderRadius: '3px', display: 'block', textAlign: 'center', marginTop: '2px', whiteSpace: 'nowrap' }}>{row.riskTanimi1}</span>
                              </div>,
                              { background: 'rgba(220,38,38,0.04)', minWidth: '80px' }
                            )}
                            {/* Planlama */}
                            {td(<EditableCell value={row.planlamaAnalizSonucu} onChange={v => updateRow(i, 'planlamaAnalizSonucu', v)} minW="120px" multiline />)}
                            {td(<EditableCell value={row.duzelticiTedbirler} onChange={v => updateRow(i, 'duzelticiTedbirler', v)} minW="130px" multiline />)}
                            {td(<EditableCell value={row.sorumluluk} onChange={v => updateRow(i, 'sorumluluk', v)} minW="70px" />)}
                            {/* Gerçekleştirilen */}
                            {td(<EditableCell value={row.gerceklestirilenTedbirler} onChange={v => updateRow(i, 'gerceklestirilenTedbirler', v)} minW="120px" multiline />)}
                            {td(<EditableCell value={row.gercTarih} onChange={v => updateRow(i, 'gercTarih', v)} minW="70px" />)}
                            {/* Sonraki risk */}
                            {td(<EditableCell value={row.o2} onChange={v => updateRow(i, 'o2', v)} numeric minW="32px" />, { background: 'rgba(22,163,74,0.04)' })}
                            {td(<EditableCell value={row.s2} onChange={v => updateRow(i, 's2', v)} numeric minW="32px" />, { background: 'rgba(22,163,74,0.04)' })}
                            {td(<EditableCell value={row.f2} onChange={v => updateRow(i, 'f2', v)} numeric minW="32px" />, { background: 'rgba(22,163,74,0.04)' })}
                            {td(
                              <div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: st2.color, display: 'block', textAlign: 'center' }}>{row.r2}</span>
                                <span style={{ fontSize: '8px', fontWeight: 600, color: st2.color, background: st2.bg, padding: '1px 4px', borderRadius: '3px', display: 'block', textAlign: 'center', marginTop: '2px', whiteSpace: 'nowrap' }}>{row.riskTanimi2}</span>
                              </div>,
                              { background: 'rgba(22,163,74,0.04)', minWidth: '80px' }
                            )}
                            {td(<EditableCell value={row.aciklama} onChange={v => updateRow(i, 'aciklama', v)} minW="100px" multiline />)}
                            <td style={{ padding: '4px', borderBottom: '1px solid var(--border-main)', verticalAlign: 'middle', background: rowBg }}>
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

            </div>
              <button onClick={addRow} className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all"
                style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-main)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0284C7'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(2,132,199,0.4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-main)'; }}>
                <i className="ri-add-line" /> Yeni Satır Ekle
              </button>
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
    </div>,
    document.body
  );
}
