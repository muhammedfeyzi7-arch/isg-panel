import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { usePermissions } from '../../hooks/usePermissions';
import Modal from '../../components/base/Modal';
import QrModal from './components/QrModal';
import type { Ekipman, EkipmanStatus } from '../../types';
import XLSXStyle from 'xlsx-js-style';
import { uploadFileToStorage, downloadFromUrl, validateFile, getSignedUrlFromPath } from '@/utils/fileUpload';

const EKIPMAN_TURLERI = [
  'İş Makinesi', 'Kaldırma Ekipmanı', 'Basınçlı Kap', 'Elektrikli Ekipman',
  'İskele / Platform', 'Koruyucu Donanım', 'Yangın Söndürücü', 'İlk Yardım Kiti',
  'Ölçüm Aleti', 'El Aleti', 'Diğer',
];

function parseTrDate(d: string): string {
  // Converts DD.MM.YYYY or DD/MM/YYYY to YYYY-MM-DD
  const parts = d.split(/[./]/);
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  // Already ISO
  if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d;
  return '';
}

function exportEkipmanToExcel(ekipmanlar: Ekipman[], firmalar: { id: string; ad: string }[]): void {
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const aktif = ekipmanlar.filter(e => !e.silinmis);
  const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');

  const uygunSayisi = aktif.filter(e => e.durum === 'Uygun').length;
  const uygunDegil = aktif.filter(e => e.durum === 'Uygun Değil').length;
  const bakimda = aktif.filter(e => e.durum === 'Bakımda').length;
  const hurda = aktif.filter(e => e.durum === 'Hurda').length;
  const yaklasan = aktif.filter(e => {
    if (!e.sonrakiKontrolTarihi) return false;
    const diff = Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - today.getTime()) / 86400000);
    return diff >= 0 && diff <= 3;
  }).length;
  const gecikmis = aktif.filter(e => {
    if (!e.sonrakiKontrolTarihi) return false;
    return new Date(e.sonrakiKontrolTarihi) < today;
  }).length;

  // ── Stil tanımları ──
  const HEADER_BG = '1E293B';
  const HEADER_FG = 'FFFFFF';
  const TITLE_BG = '0F172A';
  const ROW_ALT = 'F1F5F9';
  const ROW_NORMAL = 'FFFFFF';
  const BORDER_COLOR = 'CBD5E1';
  const SUMMARY_BG = 'EFF6FF';
  const SUMMARY_FG = '1E40AF';

  const thinBorder = {
    top: { style: 'thin', color: { rgb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { rgb: BORDER_COLOR } },
    left: { style: 'thin', color: { rgb: BORDER_COLOR } },
    right: { style: 'thin', color: { rgb: BORDER_COLOR } },
  };
  const medBorder = {
    top: { style: 'medium', color: { rgb: '94A3B8' } },
    bottom: { style: 'medium', color: { rgb: '94A3B8' } },
    left: { style: 'medium', color: { rgb: '94A3B8' } },
    right: { style: 'medium', color: { rgb: '94A3B8' } },
  };

  const titleS = { font: { bold: true, sz: 13, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: TITLE_BG } }, alignment: { horizontal: 'left', vertical: 'center' }, border: medBorder };
  const headerS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: HEADER_BG } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinBorder };
  const subHeaderS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: '334155' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinBorder };
  const cellS = (ri: number, align: 'left' | 'center' | 'right' = 'left') => ({ font: { sz: 10, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: ri % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, alignment: { horizontal: align, vertical: 'center', wrapText: true }, border: thinBorder });
  const numS = (ri: number) => ({ font: { sz: 10, color: { rgb: '64748B' }, name: 'Calibri' }, fill: { fgColor: { rgb: ri % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinBorder });
  const sumLabelS = { font: { bold: true, sz: 10, color: { rgb: SUMMARY_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: SUMMARY_BG } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thinBorder };
  const sumValS = { font: { bold: true, sz: 11, color: { rgb: SUMMARY_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: SUMMARY_BG } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinBorder };
  const totalS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: '334155' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: medBorder };

  const statusS = (s: string) => {
    const sl = s.toLowerCase();
    let fg = '64748B'; let bg = 'F1F5F9';
    if (sl === 'uygun' || sl === 'zamanında') { fg = '16A34A'; bg = 'DCFCE7'; }
    else if (sl.includes('değil') || sl.includes('gecikmiş') || sl.includes('geçti')) { fg = 'DC2626'; bg = 'FEE2E2'; }
    else if (sl.includes('kaldı') || sl.includes('yaklaşan') || sl === 'bugün') { fg = 'D97706'; bg = 'FEF3C7'; }
    else if (sl === 'bakımda') { fg = 'EA580C'; bg = 'FFEDD5'; }
    else if (sl === 'hurda') { fg = '64748B'; bg = 'F1F5F9'; }
    return { font: { bold: true, sz: 10, color: { rgb: fg }, name: 'Calibri' }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinBorder };
  };

  const wb = XLSXStyle.utils.book_new();

  // ── Sayfa 1: Ekipman Listesi ──
  const COLS1 = ['#', 'Ekipman Adı', 'Ekipman Türü', 'Firma', 'Bulunduğu Alan', 'Marka', 'Model', 'Seri No', 'Son Kontrol', 'Sonraki Kontrol', 'Kontrol Durumu', 'Ekipman Durumu', 'Belge', 'Açıklama'];
  const dataRows1 = aktif.map((e, idx) => {
    const firma = firmalar.find(f => f.id === e.firmaId);
    let kontrolDurumu = '-';
    if (e.sonrakiKontrolTarihi) {
      const diff = Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - today.getTime()) / 86400000);
      if (diff < 0) kontrolDurumu = 'GECİKMİŞ';
      else if (diff === 0) kontrolDurumu = 'BUGÜN';
      else if (diff <= 3) kontrolDurumu = `${diff} gün kaldı`;
      else kontrolDurumu = 'Zamanında';
    }
    return [idx + 1, e.ad || '-', e.tur || '-', firma?.ad || '-', e.bulunduguAlan || '-', e.marka || '-', e.model || '-', e.seriNo || '-', fmtDate(e.sonKontrolTarihi), fmtDate(e.sonrakiKontrolTarihi), kontrolDurumu, e.durum || '-', e.belgeMevcut ? 'Evet' : 'Hayır', e.aciklama || '-'];
  });

  // Özet satırları
  const summaryRows = [
    [`ISG EKİPMAN KONTROL RAPORU — ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`],
    ['Toplam', 'Uygun', 'Uygun Değil', 'Bakımda', 'Hurda', 'Yaklaşan (≤30 gün)', 'Gecikmiş'],
    [aktif.length, uygunSayisi, uygunDegil, bakimda, hurda, yaklasan, gecikmis],
    COLS1,
    ...dataRows1,
  ];

  const ws1 = XLSXStyle.utils.aoa_to_sheet(summaryRows);

  // Başlık birleştir
  if (!ws1['!merges']) ws1['!merges'] = [];
  ws1['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS1.length - 1 } });

  // Stilleri uygula
  summaryRows.forEach((row, ri) => {
    (row as (string | number)[]).forEach((val, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws1[addr]) ws1[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
      let s: object = cellS(ri - 4);
      if (ri === 0) s = titleS;
      else if (ri === 1) s = subHeaderS;
      else if (ri === 2) s = sumValS;
      else if (ri === 3) s = headerS;
      else {
        // Veri satırları
        const dataRi = ri - 4;
        if (ci === 0) s = numS(dataRi);
        else if (ci === 10) s = statusS(String(val ?? ''));  // Kontrol Durumu
        else if (ci === 11) s = statusS(String(val ?? '')); // Ekipman Durumu
        else if (ci === 12) s = { ...cellS(dataRi, 'center'), font: { sz: 10, color: { rgb: String(val) === 'Evet' ? '16A34A' : 'DC2626' }, bold: true, name: 'Calibri' }, fill: { fgColor: { rgb: String(val) === 'Evet' ? 'DCFCE7' : 'FEE2E2' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinBorder };
        else s = cellS(dataRi, ci >= 8 ? 'center' : 'left');
      }
      (ws1[addr] as XLSXStyle.CellObject).s = s;
    });
  });

  ws1['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 20 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 36 }];
  if (!ws1['!rows']) ws1['!rows'] = [];
  (ws1['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 30 };
  (ws1['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
  (ws1['!rows'] as XLSXStyle.RowInfo[])[2] = { hpt: 22 };
  (ws1['!rows'] as XLSXStyle.RowInfo[])[3] = { hpt: 24 };
  XLSXStyle.utils.book_append_sheet(wb, ws1, 'Ekipman Listesi');

  // ── Sayfa 2: Durum Özeti ──
  const ozet2Rows = [
    ['EKİPMAN DURUM ÖZETİ'],
    ['Durum', 'Adet', 'Oran (%)'],
    ['Uygun', uygunSayisi, aktif.length ? +((uygunSayisi / aktif.length) * 100).toFixed(1) : 0],
    ['Uygun Değil', uygunDegil, aktif.length ? +((uygunDegil / aktif.length) * 100).toFixed(1) : 0],
    ['Bakımda', bakimda, aktif.length ? +((bakimda / aktif.length) * 100).toFixed(1) : 0],
    ['Hurda', hurda, aktif.length ? +((hurda / aktif.length) * 100).toFixed(1) : 0],
    ['TOPLAM', aktif.length, 100],
    [],
    ['KONTROL TAKVİMİ'],
    ['Durum', 'Adet'],
    ['Zamanında', aktif.length - yaklasan - gecikmis],
    ['Yaklaşan (≤30 gün)', yaklasan],
    ['Gecikmiş', gecikmis],
    [],
    ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR')],
  ];
  const ws2 = XLSXStyle.utils.aoa_to_sheet(ozet2Rows);
  if (!ws2['!merges']) ws2['!merges'] = [];
  ws2['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } });
  ws2['!merges'].push({ s: { r: 8, c: 0 }, e: { r: 8, c: 2 } });
  ozet2Rows.forEach((row, ri) => {
    (row as (string | number)[]).forEach((val, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws2[addr]) ws2[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
      let s: object = cellS(ri);
      if (ri === 0 || ri === 8) s = titleS;
      else if (ri === 1 || ri === 9) s = headerS;
      else if (ri === 6) s = totalS;
      else if (ri >= 2 && ri <= 5) {
        if (ci === 0) s = statusS(String(val ?? ''));
        else s = { ...cellS(ri - 2, 'center'), font: { bold: true, sz: 11, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: ri % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, border: thinBorder };
      } else if (ri >= 10 && ri <= 12) {
        if (ci === 0) s = statusS(String(val ?? ''));
        else s = { ...cellS(ri - 10, 'center'), font: { bold: true, sz: 11, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: ri % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, border: thinBorder };
      } else if (ri === 14) s = sumLabelS;
      (ws2[addr] as XLSXStyle.CellObject).s = s;
    });
  });
  ws2['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }];
  if (!ws2['!rows']) ws2['!rows'] = [];
  (ws2['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 };
  (ws2['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
  (ws2['!rows'] as XLSXStyle.RowInfo[])[8] = { hpt: 28 };
  (ws2['!rows'] as XLSXStyle.RowInfo[])[9] = { hpt: 22 };
  XLSXStyle.utils.book_append_sheet(wb, ws2, 'Durum Özeti');

  // ── Sayfa 3: Kritik Kontroller ──
  const kritikler = aktif
    .filter(e => { if (!e.sonrakiKontrolTarihi) return false; const diff = Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - today.getTime()) / 86400000); return diff <= 3; })
    .sort((a, b) => new Date(a.sonrakiKontrolTarihi).getTime() - new Date(b.sonrakiKontrolTarihi).getTime());

  const COLS3 = ['Ekipman Adı', 'Tür', 'Firma', 'Kontrol Tarihi', 'Kalan Süre', 'Durum'];
  const kritikData = kritikler.map(e => {
    const firma = firmalar.find(f => f.id === e.firmaId);
    const diff = Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - today.getTime()) / 86400000);
    return [e.ad, e.tur || '-', firma?.ad || '-', fmtDate(e.sonrakiKontrolTarihi), diff < 0 ? `${Math.abs(diff)} gün gecikmiş` : diff === 0 ? 'BUGÜN' : `${diff} gün kaldı`, e.durum];
  });
  const ws3Rows = [
    ['YAKLAŞAN & GECİKMİŞ KONTROLLER'],
    COLS3,
    ...(kritikData.length > 0 ? kritikData : [['Yaklaşan veya gecikmiş kontrol bulunmuyor.', '', '', '', '', '']]),
  ];
  const ws3 = XLSXStyle.utils.aoa_to_sheet(ws3Rows);
  if (!ws3['!merges']) ws3['!merges'] = [];
  ws3['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS3.length - 1 } });
  ws3Rows.forEach((row, ri) => {
    (row as (string | number)[]).forEach((val, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws3[addr]) ws3[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
      let s: object = cellS(ri - 2);
      if (ri === 0) s = titleS;
      else if (ri === 1) s = headerS;
      else {
        const dataRi = ri - 2;
        if (ci === 4) s = statusS(String(val ?? ''));
        else if (ci === 5) s = statusS(String(val ?? ''));
        else if (ci === 3) s = cellS(dataRi, 'center');
        else s = cellS(dataRi);
      }
      (ws3[addr] as XLSXStyle.CellObject).s = s;
    });
  });
  ws3['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 24 }, { wch: 16 }, { wch: 22 }, { wch: 16 }];
  if (!ws3['!rows']) ws3['!rows'] = [];
  (ws3['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 };
  (ws3['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
  XLSXStyle.utils.book_append_sheet(wb, ws3, 'Kritik Kontroller');

  const xlsxData = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${new Date().toLocaleDateString('tr-TR')} Ekipman Kontrol Raporu.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadEkipmanTemplate(): void {
  const HEADER_BG = '1E293B'; const HEADER_FG = 'FFFFFF'; const BC = 'CBD5E1';
  const thinB = { top: { style: 'thin', color: { rgb: BC } }, bottom: { style: 'thin', color: { rgb: BC } }, left: { style: 'thin', color: { rgb: BC } }, right: { style: 'thin', color: { rgb: BC } } };
  const headerS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: HEADER_BG } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thinB };
  const cellS = { font: { sz: 10, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: thinB };
  const noteS = { font: { sz: 9, color: { rgb: '64748B' }, italic: true, name: 'Calibri' }, fill: { fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: thinB };

  const headers = ['Ekipman Adı', 'Ekipman Türü', 'Firma Adı', 'Bulunduğu Alan', 'Seri No', 'Marka', 'Model', 'Son Kontrol (GG.AA.YYYY)', 'Sonraki Kontrol (GG.AA.YYYY)', 'Durum', 'Açıklama'];
  const example = ['Forklift', 'İş Makinesi', 'Örnek Firma A.S.', 'Depo', 'SN-001', 'Toyota', 'Model-X', '15.01.2025', '15.07.2025', 'Uygun', 'Yillik bakim yapildi'];
  const notlar = [
    ['NOTLAR:', '', '', '', '', '', '', '', '', '', ''],
    ['1. Tarih formati: GG.AA.YYYY (ornek: 15.01.2025)', '', '', '', '', '', '', '', '', '', ''],
    ['2. Durum degerleri: Uygun / Uygun Degil / Bakimda / Hurda', '', '', '', '', '', '', '', '', '', ''],
    ['3. Firma adi sistemdeki kayitla birebir eslesmelidir', '', '', '', '', '', '', '', '', '', ''],
  ];

  const wb = XLSXStyle.utils.book_new();
  const ws = XLSXStyle.utils.aoa_to_sheet([headers, example, ...notlar]);

  // Stilleri uygula
  headers.forEach((_, ci) => {
    const hAddr = XLSXStyle.utils.encode_cell({ r: 0, c: ci });
    const eAddr = XLSXStyle.utils.encode_cell({ r: 1, c: ci });
    if (ws[hAddr]) (ws[hAddr] as XLSXStyle.CellObject).s = headerS;
    if (ws[eAddr]) (ws[eAddr] as XLSXStyle.CellObject).s = cellS;
  });

  // Not satırları
  notlar.forEach((row, ri) => {
    row.forEach((_, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri + 2, c: ci });
      if (ws[addr]) (ws[addr] as XLSXStyle.CellObject).s = noteS;
    });
  });

  // Birleştirmeler
  if (!ws['!merges']) ws['!merges'] = [];
  notlar.forEach((_, ri) => {
    ws['!merges']!.push({ s: { r: ri + 2, c: 0 }, e: { r: ri + 2, c: headers.length - 1 } });
  });

  ws['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 30 }];
  if (!ws['!rows']) ws['!rows'] = [];
  (ws['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 };
  (ws['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };

  XLSXStyle.utils.book_append_sheet(wb, ws, 'Ekipman Sablonu');
  const xlsxData = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${new Date().toLocaleDateString('tr-TR')} Ekipman Şablonu.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const STATUS_CONFIG: Record<EkipmanStatus, { label: string; color: string; bg: string; icon: string }> = {
  'Uygun': { label: 'Uygun', color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
  'Uygun Değil': { label: 'Uygun Değil', color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
  'Bakımda': { label: 'Bakımda', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'ri-time-line' },
  'Hurda': { label: 'Hurda', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-delete-bin-line' },
};

const defaultForm: Omit<Ekipman, 'id' | 'olusturmaTarihi'> = {
  ad: '',
  tur: '',
  firmaId: '',
  bulunduguAlan: '',
  seriNo: '',
  marka: '',
  model: '',
  sonKontrolTarihi: '',
  sonrakiKontrolTarihi: '',
  durum: 'Uygun',
  aciklama: '',
  belgeMevcut: false,
  dosyaAdi: '',
  dosyaBoyutu: 0,
  dosyaTipi: '',
  dosyaVeri: '',
  notlar: '',
};

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function EkipmanlarPage() {
  const { ekipmanlar, firmalar, addEkipman, updateEkipman, deleteEkipman, addToast, quickCreate, setQuickCreate, org, refreshData, dataLoading } = useApp();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Ekipman, 'id' | 'olusturmaTarihi'>>(defaultForm);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ row: number; ad: string; status: 'ok' | 'error'; message: string }[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [qrEkipman, setQrEkipman] = useState<Ekipman | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Toplu silme state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const handleRefresh = async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true);
    try { await refreshData(); addToast('Veriler güncellendi.', 'success'); }
    finally { setRefreshing(false); }
  };

  useEffect(() => {
    if (quickCreate === 'ekipmanlar') {
      setEditId(null);
      setForm(defaultForm);
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  // Bildirimden gelen kayıt açma
  useEffect(() => {
    const handleOpenRecord = (e: Event) => {
      const detail = (e as CustomEvent).detail as { module: string; recordId: string };
      if (detail.module !== 'ekipmanlar') return;
      const ekipman = ekipmanlar.find(ek => ek.id === detail.recordId);
      if (ekipman) { setEditId(ekipman.id); setForm(ekipman as typeof defaultForm); setShowModal(true); }
    };
    window.addEventListener('isg_open_record', handleOpenRecord);
    try {
      const saved = localStorage.getItem('isg_open_record');
      if (saved) {
        const { module, recordId, ts } = JSON.parse(saved);
        if (module === 'ekipmanlar' && recordId && Date.now() - ts < 5000) {
          const ekipman = ekipmanlar.find(ek => ek.id === recordId);
          if (ekipman) { setEditId(ekipman.id); setForm(ekipman as typeof defaultForm); setShowModal(true); localStorage.removeItem('isg_open_record'); }
        }
      }
    } catch { /* ignore */ }
    return () => window.removeEventListener('isg_open_record', handleOpenRecord);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ekipmanlar]);

  const filtered = useMemo(() => {
    return ekipmanlar
      .filter(e => {
        if (e.silinmis) return false;
        const firma = firmalar.find(f => f.id === e.firmaId);
        const q = search.toLowerCase();
        const matchSearch = !q ||
          e.ad.toLowerCase().includes(q) ||
          e.tur.toLowerCase().includes(q) ||
          e.seriNo.toLowerCase().includes(q) ||
          (firma?.ad.toLowerCase().includes(q) ?? false);
        const matchFirma = !firmaFilter || e.firmaId === firmaFilter;
        const matchStatus = !statusFilter || e.durum === statusFilter;
        return matchSearch && matchFirma && matchStatus;
      })
      .sort((a, b) => {
        const ta = a.olusturmaTarihi ?? '';
        const tb = b.olusturmaTarihi ?? '';
        return tb.localeCompare(ta);
      });
  }, [ekipmanlar, firmalar, search, firmaFilter, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(e => e.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkDelete = () => {
    selected.forEach(id => deleteEkipman(id));
    addToast(`${selected.size} ekipman silindi.`, 'info');
    setSelected(new Set());
    setBulkDeleteConfirm(false);
  };

  const aktifEkipmanlar = useMemo(() => ekipmanlar.filter(e => !e.silinmis), [ekipmanlar]);

  // Bir ekipmanın gerçek efektif durumunu hesapla:
  // Eğer kontrol tarihi geçmişse ve durum Uygun ise → otomatik Uygun Değil
  const getEffectiveDurum = (ekipman: Ekipman): EkipmanStatus => {
    if (ekipman.durum !== 'Uygun') return ekipman.durum;
    if (!ekipman.sonrakiKontrolTarihi) return ekipman.durum;
    const days = getDaysUntil(ekipman.sonrakiKontrolTarihi);
    if (days < 0) return 'Uygun Değil';
    return ekipman.durum;
  };

  const stats = useMemo(() => {
    const total = aktifEkipmanlar.length;
    const uygun = aktifEkipmanlar.filter(e => getEffectiveDurum(e) === 'Uygun').length;
    const uygunDegil = aktifEkipmanlar.filter(e => getEffectiveDurum(e) === 'Uygun Değil').length;
    const yaklasan = aktifEkipmanlar.filter(e => {
      if (getEffectiveDurum(e) === 'Uygun Değil') return false;
      const days = getDaysUntil(e.sonrakiKontrolTarihi);
      return days >= 0 && days <= 3;
    }).length;
    return { total, uygun, uygunDegil, yaklasan };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktifEkipmanlar]);

  const openAdd = () => {
    setEditId(null);
    setForm(defaultForm);
    setPendingFile(null);
    setShowModal(true);
  };

  const openEdit = (ekipman: Ekipman) => {
    setEditId(ekipman.id);
    setPendingFile(null);
    setForm({
      ad: ekipman.ad, tur: ekipman.tur, firmaId: ekipman.firmaId,
      bulunduguAlan: ekipman.bulunduguAlan, seriNo: ekipman.seriNo,
      marka: ekipman.marka, model: ekipman.model,
      sonKontrolTarihi: ekipman.sonKontrolTarihi, sonrakiKontrolTarihi: ekipman.sonrakiKontrolTarihi,
      durum: ekipman.durum, aciklama: ekipman.aciklama, belgeMevcut: ekipman.belgeMevcut,
      dosyaAdi: ekipman.dosyaAdi || '', dosyaBoyutu: ekipman.dosyaBoyutu || 0,
      dosyaTipi: ekipman.dosyaTipi || '', dosyaVeri: '', notlar: ekipman.notlar,
    });
    setShowModal(true);
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const err = validateFile(file, 10);
    if (err) { addToast(err, 'error'); return; }
    setPendingFile(file);
    setForm(prev => ({ ...prev, dosyaAdi: file.name, dosyaBoyutu: file.size, dosyaTipi: file.type }));
  };

  const handleFileDownload = async (ekipman: Ekipman) => {
    if (ekipman.dosyaUrl) {
      // dosyaUrl filePath veya signed URL olabilir — her iki durumu destekle
      const resolvedUrl = await getSignedUrlFromPath(ekipman.dosyaUrl);
      if (resolvedUrl) {
        const ok = await downloadFromUrl(resolvedUrl, ekipman.dosyaAdi || 'ekipman-belgesi');
        if (ok) { addToast(`"${ekipman.dosyaAdi}" indiriliyor...`, 'success'); return; }
      }
    }
    addToast('Bu ekipman için yüklenmiş belge bulunamadı.', 'error');
  };

  const handleSave = async () => {
    if (!form.ad.trim()) { addToast('Ekipman adı zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!form.tur) { addToast('Ekipman türü zorunludur.', 'error'); return; }

    const orgId = org?.id ?? 'unknown';
    setUploading(true);

    try {
      if (editId) {
        // Düzenleme: dosya varsa önce yükle
        if (pendingFile) {
          const url = await uploadFileToStorage(pendingFile, orgId, 'ekipman', editId);
          if (!url) {
            addToast('Dosya yüklenemedi. Lütfen tekrar deneyin.', 'error');
            return;
          }
          updateEkipman(editId, { ...form, dosyaUrl: url });
        } else {
          updateEkipman(editId, form);
        }
        addToast('Ekipman başarıyla güncellendi.', 'success');
      } else {
        // Yeni kayıt: dosya varsa önce yükle, sonra kayıt oluştur
        if (pendingFile) {
          const tempId = crypto.randomUUID();
          const url = await uploadFileToStorage(pendingFile, orgId, 'ekipman', tempId);
          if (!url) {
            addToast('Dosya yüklenemedi. Ekipman kaydı oluşturulmadı.', 'error');
            return;
          }
          addEkipman({ ...form, dosyaUrl: url });
        } else {
          addEkipman(form);
        }
        addToast('Ekipman başarıyla eklendi.', 'success');
      }
      setPendingFile(null);
      setShowModal(false);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteEkipman(deleteId);
    // QR modal açıksa ve silinen ekipmansa kapat
    if (qrEkipman?.id === deleteId) setQrEkipman(null);
    addToast('Ekipman silindi.', 'success');
    setDeleteId(null);
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      addToast('Lütfen .xlsx, .xls veya .csv uzantılı dosya seçin.', 'error');
      return;
    }
    setImportFile(file);

    // Önizleme için ilk 5 satırı parse et
    try {
      const { parseImportFile } = await import('../../utils/importParser');
      const { rows: dataRows, validCount } = await parseImportFile(file);

      // Header satırını ayrıca oku
      const XLSX = (await import('xlsx-js-style')).default;
      const rawBuffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(rawBuffer), { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
      const headerRow = (allRows[0] as unknown[]).map(h => String(h ?? '').trim());

      // Header bazlı kolon eşleştirme — Türkçe normalize ile
      const normHPrev = (s: string) => s.trim().toLowerCase()
        .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
        .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
        .replace(/Ü/g, 'u').replace(/ü/g, 'u')
        .replace(/Ş/g, 's').replace(/ş/g, 's')
        .replace(/Ö/g, 'o').replace(/ö/g, 'o')
        .replace(/Ç/g, 'c').replace(/ç/g, 'c')
        .replace(/\s+/g, ' ');

      const normalizedHeadersPrev = headerRow.map(normHPrev);

      const colMap: Record<string, number> = {};
      const findColPrev = (keywords: string[]): number => {
        for (const kw of keywords) {
          const normKw = normHPrev(kw);
          const exactIdx = normalizedHeadersPrev.findIndex(h => h === normKw);
          if (exactIdx >= 0) return exactIdx;
          const partialIdx = normalizedHeadersPrev.findIndex(h => h.includes(normKw) || normKw.includes(h));
          if (partialIdx >= 0) return partialIdx;
        }
        return -1;
      };

      colMap['ad'] = findColPrev(['ekipman adi', 'ekipman ad']);
      colMap['tur'] = findColPrev(['ekipman turu', 'ekipman tur', 'tur', 'cesit']);
      colMap['firma'] = findColPrev(['firma adi', 'firma ad', 'firma']);

      const getCell = (row: string[], key: string): string => {
        const idx = colMap[key];
        return idx >= 0 ? (row[idx] ?? '').trim() : '';
      };

      const preview = dataRows.slice(0, 5).map((row, i) => {
        const ad = getCell(row, 'ad');
        const firma = getCell(row, 'firma');
        const hasError = !ad || !firma;
        return {
          row: i + 2,
          ad: ad || '(Boş)',
          status: (hasError ? 'error' : 'ok') as 'ok' | 'error',
          message: hasError ? `Eksik: ${!ad ? 'Ekipman Adı ' : ''}${!firma ? 'Firma Adı' : ''}` : 'Hazır',
        };
      });

      setImportPreview(preview);
      addToast(`${validCount} satır tespit edildi. İlk 5 satır önizlemede.`, 'info');
    } catch (err) {
      console.error('[Preview] Hata:', err);
      addToast('Dosya önizlemesi yapılamadı.', 'warning');
    }
  };

  const handleImport = async () => {
    if (!importFile) { addToast('Lütfen bir dosya seçin.', 'error'); return; }
    setImporting(true);
    try {
      // Global utility: boş satırları ve not satırlarını otomatik filtreler
      const { parseImportFile } = await import('../../utils/importParser');
      const { rows: dataRows, validCount } = await parseImportFile(importFile);

      if (validCount === 0) {
        addToast('Dosyada geçerli veri bulunamadı. Boş satırlar ve not satırları otomatik atlandı.', 'warning');
        setImporting(false);
        setShowImport(false);
        return;
      }

      // Header satırını ayrıca oku — kolon eşleştirme için
      const XLSX = (await import('xlsx-js-style')).default;
      const rawBuffer = await importFile.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(rawBuffer), { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
      const headerRow = (allRows[0] as unknown[]).map(h => String(h ?? '').trim());

      // Header bazlı kolon eşleştirme — Türkçe normalize ile
      const normH = (s: string) => s.trim().toLowerCase()
        .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
        .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
        .replace(/Ü/g, 'u').replace(/ü/g, 'u')
        .replace(/Ş/g, 's').replace(/ş/g, 's')
        .replace(/Ö/g, 'o').replace(/ö/g, 'o')
        .replace(/Ç/g, 'c').replace(/ç/g, 'c')
        .replace(/\s+/g, ' ');

      const normalizedHeaders = headerRow.map(normH);

      const importColMap: Record<string, number> = {};

      const findCol = (keywords: string[]): number => {
        for (const kw of keywords) {
          const normKw = normH(kw);
          // Önce tam eşleşme dene
          const exactIdx = normalizedHeaders.findIndex(h => h === normKw);
          if (exactIdx >= 0) return exactIdx;
          // Sonra içerme dene
          const partialIdx = normalizedHeaders.findIndex(h => h.includes(normKw) || normKw.includes(h));
          if (partialIdx >= 0) return partialIdx;
        }
        return -1;
      };

      // Şablondaki başlıklarla birebir eşleşen keyword'ler (öncelik sırasına göre)
      importColMap['ad'] = findCol(['ekipman adi', 'ekipman ad']);
      importColMap['tur'] = findCol(['ekipman turu', 'ekipman tur', 'tur', 'cesit']);
      importColMap['firma'] = findCol(['firma adi', 'firma ad', 'firma']);
      importColMap['alan'] = findCol(['bulundugu alan', 'alan', 'lokasyon', 'bolge']);
      importColMap['seriNo'] = findCol(['seri no', 'serino', 'seri numarasi', 'serial']);
      importColMap['marka'] = findCol(['marka', 'brand', 'uretici']);
      importColMap['model'] = findCol(['model']);
      importColMap['sonKontrol'] = findCol(['son kontrol', 'sonkontrol']);
      importColMap['sonrakiKontrol'] = findCol(['sonraki kontrol', 'sonrakikontrol', 'gelecek kontrol']);
      importColMap['durum'] = findCol(['durum', 'status']);
      importColMap['aciklama'] = findCol(['aciklama', 'acikl', 'not ']);

      // Zorunlu kolon kontrolü
      if (importColMap['ad'] < 0) {
        addToast('"Ekipman Adı" kolonu bulunamadı. Lütfen şablonu kontrol edin.', 'error');
        return;
      }

      const getCell = (row: string[], key: string): string => {
        const idx = importColMap[key];
        return idx >= 0 ? (row[idx] ?? '').trim() : '';
      };

      let count = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2; // Header = 1, data = 2+

        const ad = getCell(row, 'ad');
        if (!ad) {
          errors.push(`Satır ${rowNum}: Ekipman adı boş`);
          continue;
        }

        const firmaAd = getCell(row, 'firma');
        if (!firmaAd) {
          errors.push(`Satır ${rowNum}: Firma adı boş`);
          continue;
        }

        const normFirma = (s: string) => s.trim().toLowerCase()
          .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
          .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
          .replace(/Ü/g, 'u').replace(/ü/g, 'u')
          .replace(/Ş/g, 's').replace(/ş/g, 's')
          .replace(/Ö/g, 'o').replace(/ö/g, 'o')
          .replace(/Ç/g, 'c').replace(/ç/g, 'c')
          .replace(/[.\-,;:'"()[\]/\\&@#!?]/g, ' ')
          .replace(/\s+/g, ' ').trim();

        const normFirmaAd = normFirma(firmaAd);
        const aktivFirmalar = firmalar.filter(f => !f.silinmis);

        // 1. Birebir normalize eşleşme
        let firma = aktivFirmalar.find(f => normFirma(f.ad) === normFirmaAd);
        // 2. Kısmi içerme eşleşmesi
        if (!firma) firma = aktivFirmalar.find(f => normFirma(f.ad).includes(normFirmaAd) || normFirmaAd.includes(normFirma(f.ad)));
        // 3. Token bazlı eşleşme
        if (!firma) {
          const inputTokens = normFirmaAd.split(' ').filter(t => t.length >= 2);
          if (inputTokens.length > 0) {
            const scored = aktivFirmalar.map(f => {
              const fTokens = normFirma(f.ad).split(' ').filter(t => t.length >= 2);
              const matched = inputTokens.filter(t => fTokens.includes(t)).length;
              return { f, score: matched / Math.max(inputTokens.length, fTokens.length, 1) };
            }).filter(x => x.score >= 0.4).sort((a, b) => b.score - a.score);
            if (scored.length > 0) firma = scored[0].f;
          }
        }

        if (!firma) {
          const firmaListesi = aktivFirmalar.slice(0, 5).map(f => `"${f.ad}"`).join(', ');
          errors.push(`Satır ${rowNum}: "${firmaAd}" firması bulunamadı. Sistemdeki firmalar: ${firmaListesi}`);
          continue;
        }

        // Durum normalize et — Türkçe karakter uyumu
        const durumRaw = getCell(row, 'durum');
        const normDurum = (s: string) => s.trim().toLowerCase()
          .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
          .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
          .replace(/Ü/g, 'u').replace(/ü/g, 'u')
          .replace(/Ş/g, 's').replace(/ş/g, 's')
          .replace(/Ö/g, 'o').replace(/ö/g, 'o')
          .replace(/Ç/g, 'c').replace(/ç/g, 'c');
        let durumTyped: EkipmanStatus = 'Uygun';
        const nd = normDurum(durumRaw);
        if (nd.includes('degil') || nd.includes('değil') || nd.includes('uygun d')) durumTyped = 'Uygun Değil';
        else if (nd.includes('bakim') || nd.includes('bakım')) durumTyped = 'Bakımda';
        else if (nd.includes('hurda')) durumTyped = 'Hurda';
        else if (nd.includes('uygun')) durumTyped = 'Uygun';

        // Ekipman türü normalize et
        const turRaw = getCell(row, 'tur');
        const normTur = normDurum(turRaw); // aynı normalize fonksiyonu
        const turMatch = EKIPMAN_TURLERI.find(t => normDurum(t) === normTur || normDurum(t).includes(normTur) || normTur.includes(normDurum(t)));
        const turFinal = turMatch || (turRaw.trim() ? turRaw.trim() : '');

        addEkipman({
          ad,
          tur: turFinal,
          firmaId: firma.id,
          bulunduguAlan: getCell(row, 'alan') || '',
          seriNo: getCell(row, 'seriNo') || '',
          marka: getCell(row, 'marka') || '',
          model: getCell(row, 'model') || '',
          sonKontrolTarihi: parseTrDate(getCell(row, 'sonKontrol')),
          sonrakiKontrolTarihi: parseTrDate(getCell(row, 'sonrakiKontrol')),
          durum: durumTyped,
          aciklama: getCell(row, 'aciklama') || '',
          belgeMevcut: false,
          dosyaAdi: '',
          dosyaBoyutu: 0,
          dosyaTipi: '',
          dosyaVeri: '',
          notlar: '',
        });
        count++;
      }

      if (count > 0) addToast(`${count} ekipman başarıyla içe aktarıldı.`, 'success');
      if (errors.length > 0) addToast(`${errors.length} satırda hata oluştu.`, 'warning');

      setShowImport(false);
      setImportFile(null);
      setImportPreview(null);
    } catch (err) {
      console.error('[Import] Hata:', err);
      addToast('Dosya okunurken hata oluştu.', 'error');
    } finally {
      setImporting(false);
    }
  };

  // inputStyle replaced by .isg-input CSS class

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Ekipman</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Ekipman kayıtlarını ve kontrol durumlarını yönetin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button onClick={handleRefresh} disabled={refreshing || dataLoading} className="btn-secondary whitespace-nowrap">
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          <button onClick={() => exportEkipmanToExcel(ekipmanlar, firmalar)} className="btn-secondary whitespace-nowrap">
            <i className="ri-file-excel-2-line mr-1" />Excel Raporu İndir
          </button>
          {canCreate && (
            <button onClick={() => setShowImport(true)} className="btn-secondary whitespace-nowrap">
              <i className="ri-upload-2-line mr-1" />Excel İçe Aktar
            </button>
          )}
          {canCreate && (
            <button onClick={openAdd} className="btn-primary whitespace-nowrap self-start sm:self-auto">
              <i className="ri-add-line text-base" />
              Ekipman Ekle
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Ekipman', value: stats.total, icon: 'ri-tools-line', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
          { label: 'Uygun', value: stats.uygun, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Uygun Değil', value: stats.uygunDegil, icon: 'ri-close-circle-line', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
          { label: 'Yaklaşan Kontrol', value: stats.yaklasan, icon: 'ri-time-line', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="isg-card rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ekipman adı, tür veya seri no ara..."
            className="isg-input pl-9"
          />
        </div>
        <select
          value={firmaFilter}
          onChange={e => setFirmaFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="">Tüm Durumlar</option>
          {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || firmaFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Toplu seçim aksiyonları */}
      {selected.size > 0 && canDelete && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="text-sm font-semibold" style={{ color: '#F87171' }}>{selected.size} ekipman seçildi</span>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <i className="ri-delete-bin-line" /> Seçilenleri Sil
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ml-auto" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>
            Seçimi Kaldır
          </button>
        </div>
      )}

      {/* Table */}
      <div className="isg-card rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <i className="ri-tools-line text-3xl" style={{ color: '#3B82F6' }} />
            </div>
            <p className="font-semibold text-slate-400 text-base">Ekipman kaydı bulunamadı</p>
            <p className="text-sm mt-2" style={{ color: '#475569' }}>Yeni ekipman eklemek için "Ekipman Ekle" butonunu kullanın</p>
            <button onClick={openAdd} className="btn-primary mt-5">
              <i className="ri-add-line" /> Ekipman Ekle
            </button>
          </div>
        ) : (
          <>
          {/* Mobil kart görünümü */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filtered.map(ekipman => {
              const firma = firmalar.find(f => f.id === ekipman.firmaId);
              const effectiveDurum = getEffectiveDurum(ekipman);
              const sc = STATUS_CONFIG[effectiveDurum] ?? { label: effectiveDurum, color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-question-line' };
              const days = getDaysUntil(ekipman.sonrakiKontrolTarihi);
              const isUrgent = days >= 0 && days <= 3;
              const isOverdue = days < 0;
              return (
                <div key={ekipman.id} className="p-4" style={{ background: selected.has(ekipman.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                  <div className="flex items-start gap-3">
                    {canDelete && (
                      <input type="checkbox" checked={selected.has(ekipman.id)} onChange={() => toggleOne(ekipman.id)} className="cursor-pointer mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ekipman.ad}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>
                          <i className={sc.icon} />{sc.label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ekipman.tur || '—'} {firma ? `· ${firma.ad}` : ''}</p>
                      {ekipman.marka && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{ekipman.marka} {ekipman.model}</p>}
                      {ekipman.sonrakiKontrolTarihi && (
                        <p className={`text-xs mt-1 font-medium ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : ''}`} style={!isOverdue && !isUrgent ? { color: 'var(--text-muted)' } : {}}>
                          Kontrol: {new Date(ekipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR')}
                          {isOverdue && ' — Gecikmiş!'}
                          {isUrgent && !isOverdue && ` — ${days} gün kaldı`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-2">
                    {ekipman.dosyaUrl && (
                      <button onClick={() => handleFileDownload(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }} title="İndir"><i className="ri-download-2-line text-sm" /></button>
                    )}
                    <button onClick={() => setQrEkipman(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7' }} title="QR"><i className="ri-qr-code-line text-sm" /></button>
                    {canEdit && <button onClick={() => openEdit(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }} title="Düzenle"><i className="ri-edit-line text-sm" /></button>}
                    {canDelete && <button onClick={() => setDeleteId(ekipman.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} title="Sil"><i className="ri-delete-bin-line text-sm" /></button>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Masaüstü tablo görünümü */}
          <div className="hidden md:block overflow-x-auto">
            <table className="table-premium w-full">

              <thead>
                <tr>
                  {canDelete && (
                    <th className="w-10 text-center">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                    </th>
                  )}
                  <th>Ekipman Adı</th>
                  <th>Tür</th>
                  <th>Firma</th>
                  <th>Bulunduğu Alan</th>
                  <th>Seri No</th>
                  <th>Son Kontrol</th>
                  <th>Sonraki Kontrol</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ekipman => {
                  const firma = firmalar.find(f => f.id === ekipman.firmaId);
                  const effectiveDurum = getEffectiveDurum(ekipman);
                  const sc = STATUS_CONFIG[effectiveDurum] ?? { label: effectiveDurum, color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-question-line' };
                  const days = getDaysUntil(ekipman.sonrakiKontrolTarihi);
                  const isUrgent = days >= 0 && days <= 3;
                  const isOverdue = days < 0;
                  // Dosya durumu: dosyaAdi var ama dosyaUrl yoksa "yüklenemedi"
                  const hasFileError = ekipman.dosyaAdi && !ekipman.dosyaUrl;
                  return (
                    <tr key={ekipman.id} style={{ background: selected.has(ekipman.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                      {canDelete && (
                        <td className="text-center">
                          <input type="checkbox" checked={selected.has(ekipman.id)} onChange={() => toggleOne(ekipman.id)} className="cursor-pointer" />
                        </td>
                      )}
                      <td>
                        <div>
                          <p className="font-semibold text-slate-200 text-sm">{ekipman.ad}</p>
                          {ekipman.marka && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{ekipman.marka} {ekipman.model}</p>}
                        </div>
                      </td>
                      <td>
                        <span className="text-sm text-slate-400">{ekipman.tur || '—'}</span>
                      </td>
                      <td>
                        <span className="text-sm text-slate-300">{firma?.ad || '—'}</span>
                      </td>
                      <td>
                        <span className="text-sm text-slate-400">{ekipman.bulunduguAlan || '—'}</span>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-slate-500">{ekipman.seriNo || '—'}</span>
                      </td>
                      <td>
                        <span className="text-sm text-slate-400">
                          {ekipman.sonKontrolTarihi ? new Date(ekipman.sonKontrolTarihi).toLocaleDateString('tr-TR') : '—'}
                        </span>
                      </td>
                      <td>
                        {effectiveDurum === 'Uygun Değil' ? (
                          /* Uygun Değil: tarih hesaplama yapma, kritik uyarı göster */
                          <div className="flex items-center gap-1.5">
                            <div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse whitespace-nowrap"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                                <i className="ri-error-warning-fill mr-1" />KRİTİK
                              </span>
                              {isOverdue && ekipman.sonrakiKontrolTarihi && (
                                <p className="text-[10px] text-red-500 mt-0.5">
                                  {new Date(ekipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR')} — {Math.abs(days)} gün gecikmiş
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className={`text-sm ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-slate-400'}`}>
                              {ekipman.sonrakiKontrolTarihi ? new Date(ekipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR') : '—'}
                            </span>
                            {isOverdue && <p className="text-[10px] text-red-500 mt-0.5">Gecikmiş!</p>}
                            {isUrgent && !isOverdue && <p className="text-[10px] text-yellow-500 mt-0.5">{days} gün kaldı</p>}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          <i className={sc.icon} />
                          {sc.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {hasFileError && (
                            <button
                              onClick={() => openEdit(ekipman)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-pointer transition-all whitespace-nowrap"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
                              title="Dosya yüklenmemiş — düzenleyerek ekleyin"
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                            >
                              <i className="ri-upload-2-line" />Belge Ekle
                            </button>
                          )}
                          {ekipman.dosyaUrl && (
                            <button onClick={async () => {
                              const url = await getSignedUrlFromPath(ekipman.dosyaUrl!);
                              if (url) {
                                const a = document.createElement('a');
                                a.href = url;
                                a.target = '_blank';
                                a.rel = 'noopener noreferrer';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              } else {
                                addToast('Belge erişim linki alınamadı.', 'error');
                              }
                            }} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(96,165,250,0.1)', color: '#60A5FA' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.1)'; }} title="Belgeyi Görüntüle"><i className="ri-eye-line text-sm" /></button>
                          )}
                          {ekipman.dosyaUrl && (
                            <button onClick={() => handleFileDownload(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; }} title="Belgeyi İndir"><i className="ri-download-2-line text-sm" /></button>
                          )}
                          <button onClick={() => setQrEkipman(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }} title="QR Kod"><i className="ri-qr-code-line text-sm" /></button>
                          {canEdit && (
                            <button onClick={() => openEdit(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }} title="Düzenle"><i className="ri-edit-line text-sm" /></button>
                          )}
                          {canDelete && (
                            <button onClick={() => setDeleteId(ekipman.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }} title="Sil"><i className="ri-delete-bin-line text-sm" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { if (!uploading) setShowModal(false); }}
        title={editId ? 'Ekipman Düzenle' : 'Yeni Ekipman Ekle'}
        size="lg"
        icon="ri-tools-line"
        footer={
          <>
            <button onClick={() => { if (!uploading) setShowModal(false); }} disabled={uploading} className="btn-secondary whitespace-nowrap disabled:opacity-50">İptal</button>
            <button onClick={handleSave} disabled={uploading} className="btn-primary whitespace-nowrap disabled:opacity-50">
              {uploading ? (
                <><i className="ri-loader-4-line animate-spin" /> Yükleniyor...</>
              ) : (
                <><i className={editId ? 'ri-save-line' : 'ri-add-line'} />{editId ? 'Güncelle' : 'Ekle'}</>
              )}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Ekipman Adı */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Ekipman Adı *</label>
            <input
              value={form.ad}
              onChange={e => setForm(p => ({ ...p, ad: e.target.value }))}
              placeholder="Örn: Forklift, Kompresör, Yangın Söndürücü..."
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Ekipman Türü */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Ekipman Türü *</label>
            <select
              value={form.tur}
              onChange={e => setForm(p => ({ ...p, tur: e.target.value }))}
              className="isg-input cursor-pointer"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              <option value="">Tür Seçin</option>
              {EKIPMAN_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Firma */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Firma *</label>
            <select
              value={form.firmaId}
              onChange={e => setForm(p => ({ ...p, firmaId: e.target.value }))}
              className="isg-input cursor-pointer"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              <option value="">Firma Seçin</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>

          {/* Bulunduğu Alan */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Bulunduğu Alan</label>
            <input
              value={form.bulunduguAlan}
              onChange={e => setForm(p => ({ ...p, bulunduguAlan: e.target.value }))}
              placeholder="Depo, Üretim Alanı, Ofis..."
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Seri No */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Seri Numarası</label>
            <input
              value={form.seriNo}
              onChange={e => setForm(p => ({ ...p, seriNo: e.target.value }))}
              placeholder="SN-001234"
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Marka */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Marka</label>
            <input
              value={form.marka}
              onChange={e => setForm(p => ({ ...p, marka: e.target.value }))}
              placeholder="Toyota, Bosch, Atlas Copco..."
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Model</label>
            <input
              value={form.model}
              onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
              placeholder="Model adı veya kodu"
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Son Kontrol Tarihi */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Son Kontrol Tarihi</label>
            <input
              type="date"
              value={form.sonKontrolTarihi}
              onChange={e => setForm(p => ({ ...p, sonKontrolTarihi: e.target.value }))}
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Sonraki Kontrol Tarihi */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Sonraki Kontrol Tarihi</label>
            <input
              type="date"
              value={form.sonrakiKontrolTarihi}
              onChange={e => setForm(p => ({ ...p, sonrakiKontrolTarihi: e.target.value }))}
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Durum */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Durum</label>
            <select
              value={form.durum}
              onChange={e => setForm(p => ({ ...p, durum: e.target.value as Ekipman['durum'] }))}
              className="isg-input cursor-pointer"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Belge */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Belge Mevcut mu?</label>
            <div className="flex items-center gap-4 mt-2">
              {[true, false].map(v => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.belgeMevcut === v} onChange={() => setForm(p => ({ ...p, belgeMevcut: v, ...(v === false ? { dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', dosyaVeri: '' } : {}) }))} className="cursor-pointer" style={{ accentColor: '#3B82F6' }} />
                  <span className="text-sm text-slate-300">{v ? 'Evet' : 'Hayır'}</span>
                </label>
              ))}
            </div>
            {form.belgeMevcut && (
              <div className="mt-3">
                <div
                  className="rounded-xl p-4 text-center cursor-pointer transition-all duration-200"
                  style={{ border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
                  onClick={() => fileRef.current?.click()}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'; e.currentTarget.style.background = 'rgba(52,211,153,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}
                >
                  {form.dosyaAdi ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                        <i className="ri-file-check-line text-lg" style={{ color: '#10B981' }} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-slate-200">{form.dosyaAdi}</p>
                        <p className="text-xs mt-1" style={{ color: '#475569' }}>{form.dosyaBoyutu ? `${(form.dosyaBoyutu / 1024).toFixed(1)} KB` : ''} — Değiştirmek için tıklayın</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <i className="ri-upload-cloud-2-line text-2xl mb-1.5" style={{ color: '#334155' }} />
                      <p className="text-sm font-medium text-slate-400">Belgeyi sürükleyin veya tıklayın</p>
                      <p className="text-xs mt-1" style={{ color: '#334155' }}>PDF, JPG, PNG • Maks. 50MB</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFileChange(e.target.files?.[0])} />
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Açıklama</label>
            <textarea
              value={form.aciklama}
              onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))}
              placeholder="Ekipman hakkında açıklama veya notlar..."
              rows={3}
              maxLength={500}
              className="isg-input" style={{ resize: 'vertical' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Ekipmanı Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleDelete} className="btn-danger whitespace-nowrap">Evet, Sil</button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu ekipmanı silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Ekipman çöp kutusuna taşınacak, oradan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      {/* Toplu Silme Onay Modal */}
      <Modal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        title="Toplu Silme Onayı"
        size="sm"
        icon="ri-delete-bin-2-line"
        footer={
          <>
            <button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleBulkDelete} className="btn-danger whitespace-nowrap">
              <i className="ri-delete-bin-line" /> {selected.size} Ekipmanı Sil
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            <strong>{selected.size}</strong> ekipman çöp kutusuna taşınacak.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Çöp kutusundan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      {/* QR Modal */}
      <QrModal ekipman={qrEkipman} onClose={() => setQrEkipman(null)} />

      {/* Import Modal */}
      <Modal isOpen={showImport} onClose={() => { setShowImport(false); setImportFile(null); setImportPreview(null); }} title="Excel / CSV İçe Aktar" size="md" icon="ri-upload-2-line"
        footer={
          <>
            <button onClick={downloadEkipmanTemplate} className="btn-secondary whitespace-nowrap"><i className="ri-download-line mr-1" />Şablon İndir</button>
            <button onClick={() => { setShowImport(false); setImportFile(null); setImportPreview(null); }} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleImport} disabled={!importFile || importing} className="btn-primary whitespace-nowrap disabled:opacity-50">
              <i className="ri-check-line mr-1" />{importing ? 'Aktarılıyor...' : 'İçe Aktar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl p-3.5" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#60A5FA' }}>Kullanım Kılavuzu</p>
            <ul className="text-xs space-y-1" style={{ color: '#94A3B8' }}>
              <li>• Önce <strong style={{ color: '#60A5FA' }}>Şablon İndir</strong> ile Excel şablonunu indirin</li>
              <li>• Şablonu doldurun (Excel veya CSV olarak kaydedin)</li>
              <li>• Durum değerleri: Uygun / Uygun Değil / Bakımda / Hurda</li>
              <li>• Tarih formatı: GG.AA.YYYY (örn: 15.03.2025)</li>
              <li>• Firma adı sistemdeki firma adıyla birebir eslesmeli</li>
            </ul>
          </div>

          {!importFile ? (
            <div
              className="rounded-xl p-6 text-center cursor-pointer transition-all"
              style={{ border: '2px dashed var(--border-main)', background: 'var(--bg-item)' }}
              onClick={() => importFileRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-main)'; }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); void handleImportFile(e.dataTransfer.files[0]); }}
            >
              <i className="ri-file-excel-2-line text-3xl mb-2" style={{ color: '#475569' }} />
              <p className="text-sm font-medium" style={{ color: '#64748B' }}>Excel/CSV dosyanızı sürükleyin veya tıklayın</p>
              <p className="text-xs mt-1" style={{ color: '#334155' }}>.xlsx, .xls veya .csv formatı desteklenir</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <i className="ri-file-check-line text-xl" style={{ color: '#34D399' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#34D399' }}>{importFile.name}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{importPreview ? `Önizleme: ${importPreview.length} satır` : 'Yükleniyor...'}</p>
                </div>
                <button onClick={() => { setImportFile(null); setImportPreview(null); }} className="text-xs px-2 py-1 rounded" style={{ color: '#EF4444' }}>Kaldır</button>
              </div>

              {importPreview && importPreview.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--bg-item)' }}>
                        <th className="px-3 py-2 text-left">Satır</th>
                        <th className="px-3 py-2 text-left">Ekipman</th>
                        <th className="px-3 py-2 text-left">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((p, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-main)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{p.row}</td>
                          <td className="px-3 py-2">{p.ad}</td>
                          <td className="px-3 py-2">
                            <span style={{ color: p.status === 'ok' ? '#34D399' : '#EF4444' }}>
                              {p.status === 'ok' ? <i className="ri-check-line" /> : <i className="ri-close-line" />} {p.message}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); e.target.value = ''; }} />
        </div>
      </Modal>
    </div>
  );
}
