import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import XLSXStyle from 'xlsx-js-style';
import {
  COLORS, headerStyle, cellStyle, titleStyle, statusStyle,
  cellAddr, setRowHeights, addMerge,
} from '@/utils/excelStyles';

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}

function getDurumConfig(days: number) {
  if (days < 0)  return { label: `${Math.abs(days)} gün geçti`, color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   icon: 'ri-alarm-warning-line' };
  if (days <= 30) return { label: `${days} gün kaldı`,          color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  icon: 'ri-time-line' };
  return           { label: `${days} gün kaldı`,                color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  icon: 'ri-checkbox-circle-line' };
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
function exportToExcel(
  muayeneler: { id: string; personelId: string; muayeneTarihi: string; sonrakiTarih: string; saglikDurumu?: string; silinmis?: boolean }[],
  personeller: { id: string; adSoyad: string; gorev?: string }[],
  firmalar: { id: string; ad: string }[],
) {
  const aktif = muayeneler.filter(m => !m.silinmis);
  const today = new Date().toLocaleDateString('tr-TR');

  const TITLE_ROW = [`SAĞLIK TAKİBİ — ${today}`, '', '', '', '', '', ''];
  const COLS = ['Ad Soyad', 'Görev', 'Firma', 'Muayene Tarihi', 'Sonraki Muayene', 'Kalan Gün', 'Durum'];

  const rows = aktif.map(m => {
    const p = personeller.find(x => x.id === m.personelId);
    const f = firmalar.find(x => x.id === (m as unknown as { firmaId?: string }).firmaId);
    const days = getDaysUntil(m.sonrakiTarih);
    const durum = days < 0 ? 'Süresi Geçmiş' : days <= 30 ? 'Yaklaşıyor' : 'Güncel';
    return [
      p?.adSoyad || '—',
      p?.gorev || '—',
      f?.ad || '—',
      fmtDate(m.muayeneTarihi),
      fmtDate(m.sonrakiTarih),
      m.sonrakiTarih ? String(days) : '—',
      durum,
    ];
  });

  const allData = [TITLE_ROW, COLS, ...rows];
  const ws = XLSXStyle.utils.aoa_to_sheet(allData);

  TITLE_ROW.forEach((_, ci) => {
    const addr = cellAddr(ci, 0);
    if (!ws[addr]) ws[addr] = { v: ci === 0 ? TITLE_ROW[0] : '', t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = titleStyle();
  });

  COLS.forEach((col, ci) => {
    const addr = cellAddr(ci, 1);
    if (!ws[addr]) ws[addr] = { v: col, t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = headerStyle();
  });

  rows.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const addr = cellAddr(ci, ri + 2);
      if (!ws[addr]) ws[addr] = { v: val, t: 's' };
      if (ci === 6) {
        (ws[addr] as XLSXStyle.CellObject).s = statusStyle(val as string);
      } else if (ci === 5) {
        const days = parseInt(val as string, 10);
        const color = isNaN(days) ? COLORS.gray : days < 0 ? COLORS.red : days <= 30 ? COLORS.yellow : COLORS.green;
        (ws[addr] as XLSXStyle.CellObject).s = {
          ...cellStyle(ri, 'center'),
          font: { bold: true, sz: 10, color: { rgb: color }, name: 'Calibri' },
        };
      } else {
        (ws[addr] as XLSXStyle.CellObject).s = cellStyle(ri, 'left');
      }
    });
  });

  addMerge(ws, { r: 0, c: 0 }, { r: 0, c: 6 });
  ws['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 16 }];
  setRowHeights(ws, [28, 22, ...rows.map(() => 18)]);

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Sağlık Takibi');
  const data = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Saglik_Takibi_${today.replace(/\./g, '-')}.xlsx`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Excel Şablon İndir ───────────────────────────────────────────────────────
function downloadTemplate() {
  const TITLE_ROW = ['SAĞLIK TAKİBİ — İÇE AKTARMA ŞABLONU', '', ''];
  const INFO_ROW = ['Lütfen bu şablonu doldurun. Ad Soyad alanı sistemdeki personel adıyla tam eşleşmelidir.', '', ''];
  const COLS = ['Ad Soyad', 'Muayene Tarihi', 'Sonraki Muayene Tarihi'];
  const EXAMPLE_ROWS = [
    ['Ahmet Yılmaz', '15.03.2025', '15.03.2026'],
    ['Fatma Kaya', '20.01.2025', '20.01.2026'],
    ['Mehmet Demir', '10.06.2024', '10.06.2025'],
  ];

  const allData = [TITLE_ROW, INFO_ROW, COLS, ...EXAMPLE_ROWS];
  const ws = XLSXStyle.utils.aoa_to_sheet(allData);

  TITLE_ROW.forEach((_, ci) => {
    const addr = cellAddr(ci, 0);
    if (!ws[addr]) ws[addr] = { v: ci === 0 ? TITLE_ROW[0] : '', t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = titleStyle();
  });

  INFO_ROW.forEach((_, ci) => {
    const addr = cellAddr(ci, 1);
    if (!ws[addr]) ws[addr] = { v: ci === 0 ? INFO_ROW[0] : '', t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = {
      font: { italic: true, sz: 9, color: { rgb: COLORS.gray }, name: 'Calibri' },
      fill: { fgColor: { rgb: 'FEF9C3' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { rgb: COLORS.borderColor } }, bottom: { style: 'thin', color: { rgb: COLORS.borderColor } }, left: { style: 'thin', color: { rgb: COLORS.borderColor } }, right: { style: 'thin', color: { rgb: COLORS.borderColor } } },
    };
  });

  COLS.forEach((col, ci) => {
    const addr = cellAddr(ci, 2);
    if (!ws[addr]) ws[addr] = { v: col, t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = headerStyle();
  });

  EXAMPLE_ROWS.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const addr = cellAddr(ci, ri + 3);
      if (!ws[addr]) ws[addr] = { v: val, t: 's' };
      (ws[addr] as XLSXStyle.CellObject).s = {
        ...cellStyle(ri),
        font: { italic: true, sz: 10, color: { rgb: COLORS.gray }, name: 'Calibri' },
      };
    });
  });

  addMerge(ws, { r: 0, c: 0 }, { r: 0, c: 2 });
  addMerge(ws, { r: 1, c: 0 }, { r: 1, c: 2 });

  ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 24 }];
  setRowHeights(ws, [28, 32, 22, 18, 18, 18]);

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Şablon');
  const data = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Saglik_Takibi_Sablon.xlsx';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Excel Import ─────────────────────────────────────────────────────────────
function excelSerialToDate(serial: number): string {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date = new Date(utc_value * 1000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateValue(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') return excelSerialToDate(val);
  const s = String(val).trim();
  if (!s) return '';
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

async function parseImportFile(file: File): Promise<{ adSoyad: string; muayeneTarihi: string; sonrakiTarih: string }[]> {
  const XLSXLib = await import('xlsx-js-style');
  const buf = await file.arrayBuffer();
  const wb = XLSXLib.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const allRows = XLSXLib.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    const rowStr = row.map(c => String(c).toLowerCase()).join('|');
    if (rowStr.includes('ad soyad') || rowStr.includes('adı soyadı') || rowStr.includes('adi soyadi') || rowStr.includes('isim')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 0;

  const headerRow = allRows[headerRowIdx].map(c => String(c).toLowerCase().trim());

  const adIdx = headerRow.findIndex(h =>
    h.includes('ad soyad') || h.includes('adı soyadı') || h.includes('adi soyadi') || h === 'isim' || h === 'ad'
  );
  const muayeneIdx = headerRow.findIndex(h =>
    h.includes('muayene tarihi') && !h.includes('sonraki')
  );
  const sonrakiIdx = headerRow.findIndex(h =>
    h.includes('sonraki') || h.includes('sonraki muayene')
  );

  const results: { adSoyad: string; muayeneTarihi: string; sonrakiTarih: string }[] = [];

  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.length === 0) continue;

    const adSoyad = adIdx >= 0 ? String(row[adIdx] ?? '').trim() : String(row[0] ?? '').trim();
    const muayeneTarihi = muayeneIdx >= 0 ? parseDateValue(row[muayeneIdx]) : parseDateValue(row[1]);
    const sonrakiTarih = sonrakiIdx >= 0 ? parseDateValue(row[sonrakiIdx]) : parseDateValue(row[2]);

    if (!adSoyad || adSoyad.toLowerCase().includes('örnek') || adSoyad.toLowerCase().includes('ornek')) continue;
    if (adSoyad.toLowerCase().includes('ad soyad') || adSoyad.toLowerCase().includes('isim')) continue;

    results.push({ adSoyad, muayeneTarihi, sonrakiTarih });
  }

  return results;
}

// ─── Form tipi ────────────────────────────────────────────────────────────────
interface MuayeneForm {
  personelId: string;
  firmaId: string;
  muayeneTarihi: string;
  sonrakiTarih: string;
  saglikDurumu: string;
}

const emptyForm: MuayeneForm = {
  personelId: '', firmaId: '', muayeneTarihi: '', sonrakiTarih: '', saglikDurumu: '',
};

function HealthActionBtn({ icon, onClick, title }: { icon: string; onClick: () => void; title: string }) {
  const accent = '#0EA5E9';
  return (
    <button onClick={onClick} title={title}
      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
      style={{ color: 'var(--text-muted)', background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}
      onMouseEnter={e => { e.currentTarget.style.color = accent; e.currentTarget.style.background = `${accent}15`; e.currentTarget.style.borderColor = `${accent}35`; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-item)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
      <i className={`${icon} text-xs`} />
    </button>
  );
}

// ─── Gezici Uzman: Sadece Görüntüleme ─────────────────────────────────────────
interface SaglikRow {
  id: string;
  personelAd: string;
  firmaAd: string;
  firmaId: string;
  saglikDurumu: string;
  sonuc: string;
  muayeneTarihi: string;
  sonrakiTarih: string;
}

function getDurumBadge(sonuc: string, saglikDurumu: string) {
  const label = saglikDurumu || sonuc || '—';
  if (!label || label === '—') return { label: '—', color: '#64748B', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' };
  const lower = label.toLowerCase();
  if (lower.includes('çalışamaz') || lower.includes('uygunsuz') || lower.includes('red'))
    return { label, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' };
  if (lower.includes('kısıtlı') || lower.includes('kisitli'))
    return { label, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' };
  return { label, color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.2)' };
}

function GeziciSaglikView() {
  const { org } = useApp();

  const firmIds: string[] = useMemo(() => {
    if (!org) return [];
    if (org.activeFirmIds && org.activeFirmIds.length > 0) return org.activeFirmIds;
    return org.id ? [org.id] : [];
  }, [org]);

  const [rows, setRows] = useState<SaglikRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [durumFilter, setDurumFilter] = useState('');

  const loadData = useCallback(async () => {
    if (firmIds.length === 0) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', firmIds);
      const firmaAdMap: Record<string, string> = {};
      (orgs ?? []).forEach(o => { firmaAdMap[o.id] = o.name; });

      const allRows: SaglikRow[] = [];

      await Promise.all(firmIds.map(async (firmaId) => {
        const { data: personelRows } = await supabase
          .from('personeller')
          .select('id, data')
          .eq('organization_id', firmaId)
          .is('deleted_at', null);

        const personelAdMap: Record<string, string> = {};
        (personelRows ?? []).forEach(r => {
          const d = r.data as Record<string, unknown>;
          personelAdMap[r.id] = (d.adSoyad as string) ?? 'Bilinmiyor';
        });

        const { data: mRows } = await supabase
          .from('muayeneler')
          .select('id, data')
          .eq('organization_id', firmaId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        (mRows ?? []).forEach(m => {
          const d = m.data as Record<string, unknown>;
          const personelId = (d.personelId as string) ?? '';
          allRows.push({
            id: m.id,
            personelAd: personelAdMap[personelId] ?? 'Bilinmiyor',
            firmaAd: firmaAdMap[firmaId] ?? firmaId,
            firmaId,
            saglikDurumu: (d.saglikDurumu as string) ?? '',
            sonuc: (d.sonuc as string) ?? '',
            muayeneTarihi: (d.muayeneTarihi as string) ?? '',
            sonrakiTarih: (d.sonrakiTarih as string) ?? '',
          });
        });
      }));

      allRows.sort((a, b) =>
        new Date(b.muayeneTarihi || 0).getTime() - new Date(a.muayeneTarihi || 0).getTime()
      );
      setRows(allRows);
    } catch (err) {
      console.error('[GeziciSaglikView] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [firmIds]);

  useEffect(() => { loadData(); }, [loadData]);

  const firmaListesi = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter(r => { if (seen.has(r.firmaId)) return false; seen.add(r.firmaId); return true; })
      .map(r => ({ id: r.firmaId, ad: r.firmaAd }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      const matchQ = !q || r.personelAd.toLowerCase().includes(q) || r.firmaAd.toLowerCase().includes(q) || (r.saglikDurumu || r.sonuc).toLowerCase().includes(q);
      const matchFirma = !firmaFilter || r.firmaId === firmaFilter;
      if (!durumFilter) return matchQ && matchFirma;
      const label = (r.saglikDurumu || r.sonuc || '').toLowerCase();
      if (durumFilter === 'calisabilir') return matchQ && matchFirma && label.includes('çalışabilir') && !label.includes('kısıtlı');
      if (durumFilter === 'kisitli') return matchQ && matchFirma && label.includes('kısıtlı');
      if (durumFilter === 'calisamamaz') return matchQ && matchFirma && label.includes('çalışamaz');
      return matchQ && matchFirma;
    });
  }, [rows, search, firmaFilter, durumFilter]);

  const stats = useMemo(() => ({
    toplam: rows.length,
    calisabilir: rows.filter(r => { const l = (r.saglikDurumu || r.sonuc || '').toLowerCase(); return l.includes('çalışabilir') && !l.includes('kısıtlı'); }).length,
    kisitli: rows.filter(r => (r.saglikDurumu || r.sonuc || '').toLowerCase().includes('kısıtlı')).length,
    calisamamaz: rows.filter(r => (r.saglikDurumu || r.sonuc || '').toLowerCase().includes('çalışamaz')).length,
  }), [rows]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden isg-card">
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #0284C7, #0EA5E9, #38BDF8)' }} />
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}>
              <i className="ri-heart-pulse-line text-white text-sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Sağlık Durumu
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Hekim tarafından girilen muayene ve sağlık durumu kayıtları
              </p>
            </div>
          </div>
          <button onClick={loadData} className="btn-secondary whitespace-nowrap self-end sm:self-auto" style={{ fontSize: '12px', padding: '6px 12px', height: 'auto' }}>
            <i className="ri-refresh-line text-xs" /> Yenile
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Kayıt',   value: stats.toplam,       icon: 'ri-heart-pulse-line',    color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Çalışabilir',    value: stats.calisabilir,  icon: 'ri-checkbox-circle-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
          { label: 'Kısıtlı',        value: stats.kisitli,      icon: 'ri-alert-line',           color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Çalışamaz',      value: stats.calisamamaz,  icon: 'ri-alarm-warning-line',   color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card stat-card-interactive rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Personel veya firma ara..." className="isg-input pl-9" />
        </div>
        {firmaListesi.length > 1 && (
          <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
            <option value="">Tüm Firmalar</option>
            {firmaListesi.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
        )}
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="isg-input" style={{ minWidth: '150px' }}>
          <option value="">Tüm Durumlar</option>
          <option value="calisabilir">Çalışabilir</option>
          <option value="kisitli">Kısıtlı Çalışabilir</option>
          <option value="calisamamaz">Çalışamaz</option>
        </select>
        {(search || firmaFilter || durumFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setDurumFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-list-check text-xs" />{filtered.length} kayıt
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="isg-card rounded-xl py-16 flex flex-col items-center gap-3">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: '#0EA5E9' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Kayıtlar yükleniyor...</p>
        </div>
      )}

      {/* Boş state */}
      {!loading && filtered.length === 0 && (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-heart-pulse-line text-3xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>
            {search || firmaFilter || durumFilter ? 'Arama kriterlerine uygun kayıt bulunamadı.' : 'Henüz sağlık kaydı yok.'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Sağlık kayıtları hekim tarafından OSGB - Hekim ekranından girilmektedir.
          </p>
        </div>
      )}

      {/* Liste */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-1">
          <div className="grid items-center px-4 py-2"
            style={{ gridTemplateColumns: '2fr 1.5fr 1.5fr', borderBottom: '1px solid var(--border-subtle)' }}>
            {['PERSONEL ADI', 'FİRMA', 'DURUM'].map(h => (
              <span key={h} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</span>
            ))}
          </div>
          <div className="space-y-1.5 pt-1">
            {filtered.map(row => {
              const badge = getDurumBadge(row.sonuc, row.saglikDurumu);
              const days = getDaysUntil(row.sonrakiTarih);
              const isYaklasan = row.sonrakiTarih && days >= 0 && days <= 30;
              const isGecmis = row.sonrakiTarih && days < 0;
              return (
                <div key={row.id}
                  className="grid items-center px-4 py-3 rounded-xl transition-all"
                  style={{ gridTemplateColumns: '2fr 1.5fr 1.5fr', background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-solid)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                >
                  {/* Personel */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}>
                      {(row.personelAd || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{row.personelAd}</p>
                      {row.muayeneTarihi && (
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                          {fmtDate(row.muayeneTarihi)}
                          {row.sonrakiTarih && (
                            <span className="ml-1.5" style={{ color: isGecmis ? '#EF4444' : isYaklasan ? '#F59E0B' : 'var(--text-muted)' }}>
                              · Sonraki: {fmtDate(row.sonrakiTarih)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Firma */}
                  <div className="min-w-0 pr-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap max-w-full truncate"
                      style={{ background: 'rgba(14,165,233,0.08)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.18)' }}>
                      <i className="ri-building-2-line text-[9px] flex-shrink-0" />
                      <span className="truncate">{row.firmaAd}</span>
                    </span>
                  </div>
                  {/* Durum */}
                  <div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap"
                      style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      <i className="ri-heart-pulse-line text-[9px]" />
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bilgi notu */}
      {!loading && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
          <i className="ri-information-line text-sm mt-0.5 flex-shrink-0" style={{ color: '#0EA5E9' }} />
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Bu sayfada yalnızca size atanan firmalara ait personellerin sağlık durumları görüntülenmektedir.
            Kayıt eklemek veya düzenlemek için OSGB - Hekim panelini kullanınız.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tam Özellikli Sayfa (Firma Paneli) ──────────────────────────────────────
function MuayenelerFullPage() {
  const { muayeneler, personeller, firmalar, addMuayene, updateMuayene, deleteMuayene, addToast } = useApp();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<MuayeneForm>(emptyForm);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ adSoyad: string; muayeneTarihi: string; sonrakiTarih: string; matched?: string }[] | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const aktif = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const aktifPersoneller = useMemo(() => personeller.filter(p => !p.silinmis && p.durum === 'Aktif'), [personeller]);
  const filteredPersoneller = useMemo(
    () => form.firmaId ? aktifPersoneller.filter(p => p.firmaId === form.firmaId) : aktifPersoneller,
    [aktifPersoneller, form.firmaId],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return aktif.filter(m => {
      const p = personeller.find(x => x.id === m.personelId);
      const f = firmalar.find(x => x.id === m.firmaId);
      const matchQ = !q || (p?.adSoyad.toLowerCase().includes(q) ?? false) || (f?.ad.toLowerCase().includes(q) ?? false);
      const matchFirma = !firmaFilter || m.firmaId === firmaFilter;
      const days = getDaysUntil(m.sonrakiTarih);
      const matchDurum = !durumFilter
        || (durumFilter === 'gecmis' && days < 0)
        || (durumFilter === 'yaklasan' && days >= 0 && days <= 30)
        || (durumFilter === 'guncel' && days > 30);
      return matchQ && matchFirma && matchDurum;
    }).sort((a, b) => getDaysUntil(a.sonrakiTarih) - getDaysUntil(b.sonrakiTarih));
  }, [aktif, personeller, firmalar, search, firmaFilter, durumFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(m => selectedIds.has(m.id));
  const someSelected = filtered.some(m => selectedIds.has(m.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(m => next.delete(m.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(m => next.add(m.id)); return next; });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    const count = ids.length;
    for (const id of ids) {
      deleteMuayene(id);
      await new Promise(r => setTimeout(r, 30));
    }
    addToast(`${count} kayıt silindi.`, 'success');
    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
  };

  const stats = useMemo(() => ({
    toplam: aktif.length,
    gecmis: aktif.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length,
    yaklasan: aktif.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length,
    guncel: aktif.filter(m => getDaysUntil(m.sonrakiTarih) > 30).length,
  }), [aktif]);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (m: typeof muayeneler[0]) => {
    setEditId(m.id);
    setForm({
      personelId: m.personelId,
      firmaId: m.firmaId,
      muayeneTarihi: m.muayeneTarihi,
      sonrakiTarih: m.sonrakiTarih,
      saglikDurumu: (m as unknown as { saglikDurumu?: string }).saglikDurumu ?? '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.personelId) { addToast('Personel seçimi zorunludur.', 'error'); return; }
    if (!form.muayeneTarihi) { addToast('Muayene tarihi zorunludur.', 'error'); return; }
    if (!form.sonrakiTarih) { addToast('Sonraki muayene tarihi zorunludur.', 'error'); return; }

    const payload = {
      personelId: form.personelId,
      firmaId: form.firmaId,
      muayeneTarihi: form.muayeneTarihi,
      sonrakiTarih: form.sonrakiTarih,
      saglikDurumu: form.saglikDurumu,
      sonuc: 'Çalışabilir' as const,
      hastane: '',
      doktor: '',
      notlar: '',
      belgeMevcut: false,
    };

    if (editId) {
      updateMuayene(editId, payload);
      addToast('Kayıt güncellendi.', 'success');
    } else {
      addMuayene(payload);
      addToast('Kayıt eklendi.', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMuayene(deleteId);
    addToast('Kayıt silindi.', 'success');
    setDeleteId(null);
  };

  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, ' ').trim();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const rows = await parseImportFile(file);
      const preview = rows.map(r => {
        const normR = normalize(r.adSoyad);
        let matched = aktifPersoneller.find(p => normalize(p.adSoyad) === normR);
        if (!matched) {
          matched = aktifPersoneller.find(p =>
            normalize(p.adSoyad).includes(normR) || normR.includes(normalize(p.adSoyad))
          );
        }
        return { ...r, matched: matched?.id };
      });
      setImportPreview(preview);
    } catch (err) {
      console.error('Import error:', err);
      addToast('Dosya okunamadı. Excel formatını kontrol edin.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleImportConfirm = () => {
    if (!importPreview) return;
    let added = 0;
    importPreview.forEach(r => {
      if (!r.matched) return;
      const p = aktifPersoneller.find(x => x.id === r.matched);
      if (!p) return;
      const parseDate = (s: string) => {
        if (!s) return '';
        if (s.includes('.')) { const [d, m, y] = s.split('.'); return `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`; }
        return s;
      };
      addMuayene({
        personelId: r.matched,
        firmaId: p.firmaId,
        muayeneTarihi: parseDate(r.muayeneTarihi),
        sonrakiTarih: parseDate(r.sonrakiTarih),
        sonuc: 'Çalışabilir' as const,
        hastane: '', doktor: '', notlar: '', belgeMevcut: false,
      });
      added++;
    });
    addToast(`${added} kayıt içe aktarıldı.`, 'success');
    setImportPreview(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden isg-card">
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #0284C7, #0EA5E9, #38BDF8)' }} />
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}>
              <i className="ri-heart-pulse-line text-white text-sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Sağlık Durumu
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Personel periyodik muayene takibi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={downloadTemplate} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 12px', height: 'auto' }}>
              <i className="ri-file-download-line text-xs" />Şablon
            </button>
            <button onClick={() => importRef.current?.click()} disabled={importing} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 10px', height: 'auto' }}>
              <i className="ri-upload-2-line text-xs" />{importing ? 'Okunuyor...' : 'İçe Aktar'}
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
            <button onClick={() => exportToExcel(muayeneler, personeller, firmalar)} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 10px', height: 'auto' }}>
              <i className="ri-file-excel-2-line text-xs" />Excel
            </button>
            <button onClick={openAdd} className="btn-primary whitespace-nowrap" style={{ fontSize: '12px', padding: '8px 16px', height: 'auto', background: 'linear-gradient(135deg, #0284C7, #0EA5E9)', border: '1px solid rgba(14,165,233,0.4)' }}>
              <i className="ri-add-line" /> Kayıt Ekle
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Kayıt',    value: stats.toplam,   icon: 'ri-heart-pulse-line',     color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Güncel',          value: stats.guncel,   icon: 'ri-checkbox-circle-line',  color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
          { label: 'Yaklaşan (≤30g)', value: stats.yaklasan, icon: 'ri-time-line',             color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Süresi Geçmiş',   value: stats.gecmis,   icon: 'ri-alarm-warning-line',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card stat-card-interactive rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Personel veya firma ara..." className="isg-input pl-9" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="isg-input" style={{ minWidth: '140px' }}>
          <option value="">Tüm Durumlar</option>
          <option value="gecmis">Süresi Geçmiş</option>
          <option value="yaklasan">Yaklaşıyor</option>
          <option value="guncel">Güncel</option>
        </select>
        {(search || firmaFilter || durumFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setDurumFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-list-check text-xs" />{filtered.length} kayıt
        </div>
      </div>

      {/* Toplu Seçim Aksiyon Çubuğu */}
      {someSelected && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-multiple-line text-sm" style={{ color: '#EF4444' }} />
            <span className="text-sm font-semibold" style={{ color: '#EF4444' }}>{selectedIds.size} kayıt seçildi</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="btn-secondary whitespace-nowrap text-xs">
              <i className="ri-close-line mr-1" />Seçimi Temizle
            </button>
            <button onClick={() => setShowBulkDeleteModal(true)} className="btn-danger whitespace-nowrap text-xs">
              <i className="ri-delete-bin-line mr-1" />{selectedIds.size} Kaydı Sil
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-heart-pulse-line text-3xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Kayıt bulunamadı</p>
          <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Kayıt Ekle</button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid items-center px-4 py-2"
            style={{ gridTemplateColumns: '32px 2fr 1.5fr 1.2fr 1.2fr 1.3fr 1fr 100px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-center">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-4 h-4 cursor-pointer" />
            </div>
            {['PERSONEL', 'FİRMA', 'MUAYENE TARİHİ', 'SONRAKİ MUAYENE', 'DURUM', 'SAĞLIK DURUMU', 'İŞLEMLER'].map(h => (
              <span key={h} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</span>
            ))}
          </div>
          <div className="space-y-1.5 pt-1">
            {filtered.map(m => {
              const p = personeller.find(x => x.id === m.personelId);
              const f = firmalar.find(x => x.id === m.firmaId);
              const days = getDaysUntil(m.sonrakiTarih);
              const dur = getDurumConfig(days);
              const saglikDurumu = (m as unknown as { saglikDurumu?: string }).saglikDurumu;
              const isSelected = selectedIds.has(m.id);
              return (
                <div key={m.id}
                  className="grid items-center px-4 py-3 rounded-xl transition-all"
                  style={{
                    gridTemplateColumns: '32px 2fr 1.5fr 1.2fr 1.2fr 1.3fr 1fr 100px',
                    background: isSelected ? 'rgba(239,68,68,0.04)' : 'var(--bg-card-solid)',
                    border: isSelected ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.15)'; } }}
                  onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-solid)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; } }}
                >
                  <div className="flex items-center justify-center">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(m.id)} className="w-4 h-4 cursor-pointer" />
                  </div>
                  {/* Personel */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}>
                      {(p?.adSoyad || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p?.adSoyad || '—'}</p>
                      {p?.gorev && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{p.gorev}</p>}
                    </div>
                  </div>
                  {/* Firma */}
                  <div className="min-w-0 pr-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap max-w-full truncate"
                      style={{ background: 'rgba(14,165,233,0.08)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.18)' }}>
                      <i className="ri-building-2-line text-[9px] flex-shrink-0" />
                      <span className="truncate">{f?.ad || '—'}</span>
                    </span>
                  </div>
                  {/* Muayene tarihi */}
                  <div>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(m.muayeneTarihi)}</span>
                  </div>
                  {/* Sonraki muayene */}
                  <div>
                    <span className="text-xs font-medium" style={{ color: days < 0 ? '#EF4444' : days <= 30 ? '#F59E0B' : 'var(--text-secondary)' }}>
                      {fmtDate(m.sonrakiTarih)}
                    </span>
                  </div>
                  {/* Durum badge */}
                  <div>
                    {m.sonrakiTarih ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ background: dur.bg, color: dur.color, border: `1px solid ${dur.border}` }}>
                        <i className={`${dur.icon} text-[9px]`} />{dur.label}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>
                  {/* Sağlık durumu */}
                  <div>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{saglikDurumu || '—'}</span>
                  </div>
                  {/* İşlemler */}
                  <div className="flex items-center gap-1 justify-end">
                    <HealthActionBtn icon="ri-edit-line" onClick={() => openEdit(m)} title="Düzenle" />
                    <HealthActionBtn icon="ri-delete-bin-line" onClick={() => setDeleteId(m.id)} title="Sil" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kayıt Ekle/Düzenle Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Kaydı Düzenle' : 'Yeni Kayıt Ekle'} size="md" icon="ri-heart-pulse-line"
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleSave} className="btn-primary whitespace-nowrap"><i className={editId ? 'ri-save-line' : 'ri-add-line'} /> {editId ? 'Güncelle' : 'Ekle'}</button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Firma</label>
            <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))} className="isg-input">
              <option value="">Firma Seçin</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Personel <span style={{ color: '#EF4444' }}>*</span></label>
            <select value={form.personelId} onChange={e => setForm(p => ({ ...p, personelId: e.target.value }))} className="isg-input">
              <option value="">Personel Seçin</option>
              {filteredPersoneller.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Muayene Tarihi <span style={{ color: '#EF4444' }}>*</span></label>
            <input type="date" value={form.muayeneTarihi} onChange={e => setForm(p => ({ ...p, muayeneTarihi: e.target.value }))} className="isg-input" />
          </div>
          <div>
            <label className="form-label">Sonraki Muayene Tarihi <span style={{ color: '#EF4444' }}>*</span></label>
            <input type="date" value={form.sonrakiTarih} onChange={e => setForm(p => ({ ...p, sonrakiTarih: e.target.value }))} className="isg-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Sağlık Durumu <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(opsiyonel)</span></label>
            <input value={form.saglikDurumu} onChange={e => setForm(p => ({ ...p, saglikDurumu: e.target.value }))} placeholder="Örn: Çalışabilir, Kısıtlı..." className="isg-input" maxLength={100} />
          </div>
        </div>
      </Modal>

      {/* Toplu Silme Modal */}
      <Modal open={showBulkDeleteModal} onClose={() => setShowBulkDeleteModal(false)} title="Toplu Sil" size="sm" icon="ri-delete-bin-line"
        footer={<><button onClick={() => setShowBulkDeleteModal(false)} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleBulkDelete} className="btn-danger whitespace-nowrap"><i className="ri-delete-bin-line mr-1" />Evet, {selectedIds.size} Kaydı Sil</button></>}>
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{selectedIds.size} kaydı silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Seçili kayıtlar çöp kutusuna taşınacak. Bu işlem geri alınabilir.</p>
        </div>
      </Modal>

      {/* Silme Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Kaydı Sil" size="sm" icon="ri-delete-bin-line"
        footer={<><button onClick={() => setDeleteId(null)} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleDelete} className="btn-danger whitespace-nowrap">Evet, Sil</button></>}>
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Bu kaydı silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kayıt çöp kutusuna taşınacak.</p>
        </div>
      </Modal>

      {/* Excel Import Önizleme Modal */}
      <Modal open={!!importPreview} onClose={() => setImportPreview(null)} title="Excel İçe Aktarma Önizleme" size="lg" icon="ri-upload-2-line"
        footer={<><button onClick={() => setImportPreview(null)} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleImportConfirm} className="btn-primary whitespace-nowrap" disabled={!importPreview?.some(r => r.matched)}><i className="ri-check-line" /> {importPreview?.filter(r => r.matched).length} Kaydı Aktar</button></>}>
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <i className="ri-information-line" style={{ color: '#60A5FA' }} />
            <p className="text-xs" style={{ color: '#60A5FA' }}>
              {importPreview?.filter(r => r.matched).length} kayıt eşleşti, {importPreview?.filter(r => !r.matched).length} kayıt eşleşmedi (personel bulunamadı).
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--bg-item-border)' }}>
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="text-left">Ad Soyad</th>
                  <th className="text-left">Muayene Tarihi</th>
                  <th className="text-left">Sonraki Muayene</th>
                  <th className="text-left">Durum</th>
                </tr>
              </thead>
              <tbody>
                {importPreview?.map((r, i) => (
                  <tr key={i}>
                    <td><span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.adSoyad}</span></td>
                    <td><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.muayeneTarihi || '—'}</span></td>
                    <td><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.sonrakiTarih || '—'}</span></td>
                    <td>
                      {r.matched ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>Eşleşti</span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>Bulunamadı</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Ana Export: Rol bazlı routing ────────────────────────────────────────────
export default function MuayenelerPage() {
  const { org } = useApp();

  // Gezici Uzman → sadece görüntüleme
  if (org?.osgbRole === 'gezici_uzman') {
    return <GeziciSaglikView />;
  }

  // Diğer tüm roller → tam özellikli sayfa
  return <MuayenelerFullPage />;
}
