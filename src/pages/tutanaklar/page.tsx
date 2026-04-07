import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun,
  BorderStyle, ShadingType, Table, TableRow, TableCell,
  WidthType, VerticalAlign, HeightRule,
} from 'docx';
import { useApp } from '../../store/AppContext';
import type { Tutanak, TutanakStatus, Firma } from '../../types';
import Modal from '../../components/base/Modal';
import { generateTutanakNo } from '../../store/useStore';
import TutanakDetailModal from './components/TutanakDetailModal';
import { usePermissions } from '../../hooks/usePermissions';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

/* ── Durum renk konfig ──────────────────────────────────────── */
const STS_CONFIG: Record<TutanakStatus, { color: string; bg: string; icon: string }> = {
  'Taslak':     { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-draft-line' },
  'Tamamlandı': { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  icon: 'ri-checkbox-circle-line' },
  'Onaylandı':  { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  icon: 'ri-shield-check-line' },
  'İptal':      { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
};

const emptyForm: Omit<Tutanak, 'id' | 'tutanakNo' | 'olusturmaTarihi' | 'guncellemeTarihi'> = {
  firmaId: '', baslik: '', aciklama: '', tarih: '', durum: 'Taslak',
  olusturanKisi: '', dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', dosyaVeri: '', notlar: '',
};

/* ── Word yardımcıları ──────────────────────────────────────── */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes;
}

function getImageType(mimeType: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('bmp')) return 'bmp';
  return 'jpg';
}

/* ── Tablo hücresi yardımcısı ────────────────────────────────── */
function makeCell(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    color?: string;
    bg?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    width?: number;
    borders?: boolean;
    labelCell?: boolean;
    verticalAlign?: (typeof VerticalAlign)[keyof typeof VerticalAlign];
    colspan?: number;
  } = {},
): TableCell {
  const {
    bold = false, size = 20, color = '1F2937', bg,
    align = AlignmentType.LEFT, width, borders = true,
    labelCell = false, verticalAlign = VerticalAlign.CENTER,
    colspan,
  } = opts;

  const borderStyle = borders
    ? { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' }
    : { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  return new TableCell({
    columnSpan: colspan,
    verticalAlign,
    shading: bg ? { type: ShadingType.SOLID, color: bg } : undefined,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    margins: { top: 80, bottom: 80, left: labelCell ? 120 : 160, right: 160 },
    borders: {
      top: borderStyle, bottom: borderStyle,
      left: borderStyle, right: borderStyle,
    },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({ text, bold, size, font: 'Calibri', color }),
        ],
      }),
    ],
  });
}

/* ── Word Doküman Üretici ────────────────────────────────────── */
async function generateWordDoc(
  tutanak: Tutanak,
  firmaAd: string,
  fileVeri?: string,
  firmaLogo?: string,
): Promise<void> {
  const tarihStr = tutanak.tarih
    ? new Date(tutanak.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';
  const FONT = 'Calibri';
  const ACCENT = '1B3A6B';   // koyu lacivert
  const ACCENT2 = '2563EB';  // mavi
  const LABEL_BG = 'EFF6FF'; // açık mavi arka plan (label hücreleri)
  const HEADER_BG = '1B3A6B';

  /* ── Yardımcı: boş satır ── */
  const emptyLine = (before = 0, after = 0) => new Paragraph({
    spacing: { before, after },
    children: [],
  });

  /* ── Yardımcı: yatay çizgi ── */
  const hrLine = (color = 'D1D5DB', before = 160, after = 160) => new Paragraph({
    spacing: { before, after },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color } },
    children: [],
  });

  /* ── Yardımcı: bölüm başlığı ── */
  const sectionHeader = (text: string, before = 280) => new Paragraph({
    spacing: { before, after: 120 },
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT },
      left: { style: BorderStyle.THICK, size: 24, color: ACCENT2 },
      right: { style: BorderStyle.SINGLE, size: 4, color: ACCENT },
    },
    indent: { left: 160, right: 160 },
    children: [
      new TextRun({ text: '  ' + text, bold: true, size: 22, font: FONT, color: 'FFFFFF', allCaps: true }),
    ],
  });

  /* ── LOGO + BAŞLIK HEADER TABLOSU ── */
  let logoImageRun: ImageRun | null = null;
  if (firmaLogo && firmaLogo.startsWith('data:image')) {
    try {
      const logoData = dataUrlToUint8Array(firmaLogo);
      const logoType = getImageType(firmaLogo.split(';')[0].split(':')[1] || 'image/png');
      logoImageRun = new ImageRun({ data: logoData, transformation: { width: 110, height: 55 }, type: logoType });
    } catch { /* logo yüklenemedi */ }
  }

  /* Logo hücresi */
  const logoCell = new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 2200, type: WidthType.DXA },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: logoImageRun
          ? [logoImageRun]
          : [new TextRun({ text: firmaAd, bold: true, size: 22, font: FONT, color: ACCENT })],
      }),
    ],
  });

  /* Başlık hücresi */
  const titleCell = new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    margins: { top: 160, bottom: 160, left: 200, right: 200 },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({ text: 'İŞ SAĞLIĞI VE GÜVENLİĞİ', bold: true, size: 26, font: FONT, color: 'FFFFFF' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: 'DENETİM TUTANAĞI', bold: true, size: 22, font: FONT, color: 'BFD7FF' }),
        ],
      }),
    ],
  });

  /* Tutanak No hücresi */
  const noCell = new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 2400, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: 'EFF6FF' },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({ text: 'Tutanak No', bold: true, size: 18, font: FONT, color: '6B7280' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({ text: tutanak.tutanakNo, bold: true, size: 24, font: FONT, color: ACCENT }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: tarihStr, size: 18, font: FONT, color: '6B7280' }),
        ],
      }),
    ],
  });

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.THICK, size: 24, color: ACCENT2 },
      bottom: { style: BorderStyle.THICK, size: 24, color: ACCENT2 },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        height: { value: 900, rule: HeightRule.ATLEAST },
        children: [logoCell, titleCell, noCell],
      }),
    ],
  });

  /* ── BİLGİ TABLOSU ── */
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      insideH: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      insideV: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
    },
    rows: [
      /* Satır 1: Firma | Tutanak Başlığı */
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('FİRMA', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(firmaAd, { size: 20, color: '111827', width: 3600 }),
          makeCell('TUTANAK BAŞLIĞI', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(tutanak.baslik, { size: 20, color: '111827', width: 3400 }),
        ],
      }),
      /* Satır 2: Tarih | Oluşturan Kişi */
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('TARİH', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(tarihStr, { size: 20, color: '111827', width: 3600 }),
          makeCell('OLUŞTURANAN KİŞİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(tutanak.olusturanKisi || '—', { size: 20, color: '111827', width: 3400 }),
        ],
      }),
      /* Satır 3: Durum */
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('DURUM', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(tutanak.durum, { size: 20, color: '111827', width: 3600 }),
          makeCell('TUTANAK NO', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(tutanak.tutanakNo, { size: 20, color: ACCENT, bold: true, width: 3400 }),
        ],
      }),
    ],
  });

  /* ── AÇIKLAMA TABLOSU ── */
  const aciklamaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      left: { style: BorderStyle.THICK, size: 20, color: ACCENT2 },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        height: { value: 1200, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: 'F8FAFC' },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              left: { style: BorderStyle.THICK, size: 20, color: ACCENT2 },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: tutanak.aciklama || '—',
                    size: 22, font: FONT, color: '374151',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  /* ── NOTLAR TABLOSU ── */
  const notlarTable = tutanak.notlar
    ? new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' },
          left: { style: BorderStyle.THICK, size: 20, color: 'F59E0B' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' },
          insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
        rows: [
          new TableRow({
            height: { value: 600, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                shading: { type: ShadingType.SOLID, color: 'FFFBEB' },
                margins: { top: 120, bottom: 120, left: 200, right: 200 },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' },
                  left: { style: BorderStyle.THICK, size: 20, color: 'F59E0B' },
                  right: { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' },
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: tutanak.notlar, size: 20, font: FONT, italics: true, color: '78716C' }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    : null;

  /* ── EK GÖRSEL ── */
  const fotoParagraflar: (Paragraph | Table)[] = [];
  const hasPhoto = fileVeri && tutanak.dosyaTipi?.startsWith('image/');
  if (hasPhoto && fileVeri) {
    try {
      const imgData = dataUrlToUint8Array(fileVeri);
      const imgType = getImageType(tutanak.dosyaTipi || 'image/jpeg');
      fotoParagraflar.push(
        sectionHeader('EK GÖRSEL / FOTOĞRAF'),
        emptyLine(120, 0),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [new ImageRun({ data: imgData, transformation: { width: 480, height: 340 }, type: imgType })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({ text: tutanak.dosyaAdi || 'Ek Görsel', size: 18, font: FONT, italics: true, color: '6B7280' }),
          ],
        }),
      );
    } catch {
      fotoParagraflar.push(
        sectionHeader('EK DOSYA'),
        emptyLine(80, 0),
        new Paragraph({
          children: [
            new TextRun({ text: `Ek Dosya: ${tutanak.dosyaAdi || 'dosya eklenmiştir'}`, size: 20, font: FONT, italics: true, color: '6B7280' }),
          ],
        }),
      );
    }
  } else if (tutanak.dosyaAdi && !hasPhoto) {
    fotoParagraflar.push(
      sectionHeader('EK DOSYA'),
      emptyLine(80, 0),
      new Paragraph({
        children: [
          new TextRun({ text: `Ek Dosya: ${tutanak.dosyaAdi}`, size: 20, font: FONT, italics: true, color: '6B7280' }),
        ],
      }),
    );
  }

  /* ── İMZA TABLOSU ── */
  const makeSignCell = (title: string, name: string) => new TableCell({
    verticalAlign: VerticalAlign.TOP,
    shading: { type: ShadingType.SOLID, color: 'F9FAFB' },
    margins: { top: 200, bottom: 200, left: 200, right: 200 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: title, bold: true, size: 20, font: FONT, color: ACCENT, allCaps: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: name || '—', size: 20, font: FONT, color: '374151' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } },
        children: [new TextRun({ text: 'İmza', size: 18, font: FONT, color: '9CA3AF', italics: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: tarihStr, size: 18, font: FONT, color: '6B7280' })],
      }),
    ],
  });

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        height: { value: 1400, rule: HeightRule.ATLEAST },
        children: [
          makeSignCell('DENETÇİ', tutanak.olusturanKisi || ''),
          /* boşluk hücresi */
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
            children: [new Paragraph({ children: [] })],
          }),
          makeSignCell('ONAYLAYAN', ''),
        ],
      }),
    ],
  });

  /* ── FOOTER ── */
  const footerParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 0 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } },
    children: [
      new TextRun({ text: 'ISG Denetim Sistemi', size: 16, font: FONT, color: '9CA3AF', bold: true }),
      new TextRun({ text: `   ·   ${tutanak.tutanakNo}   ·   ${tarihStr}`, size: 16, font: FONT, color: '9CA3AF' }),
    ],
  });

  /* ── DOKÜMAN ── */
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: {
        page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } },
      },
      children: [
        /* 1. Header tablosu (logo + başlık + no) */
        headerTable,
        emptyLine(200, 0),

        /* 2. Bilgi tablosu */
        sectionHeader('GENEL BİLGİLER', 0),
        emptyLine(120, 0),
        infoTable,
        emptyLine(200, 0),

        /* 3. Açıklama */
        sectionHeader('AÇIKLAMA / TUTANAK DETAYI', 0),
        emptyLine(120, 0),
        aciklamaTable,
        emptyLine(200, 0),

        /* 4. Notlar (varsa) */
        ...(notlarTable ? [
          sectionHeader('NOTLAR', 0),
          emptyLine(120, 0),
          notlarTable,
          emptyLine(200, 0),
        ] : []),

        /* 5. Ek dosya/görsel (varsa) */
        ...(fotoParagraflar.length > 0 ? [
          emptyLine(0, 0),
          ...fotoParagraflar,
          emptyLine(200, 0),
        ] : []),

        /* 6. İmza */
        sectionHeader('İMZA VE ONAY', 0),
        emptyLine(160, 0),
        signatureTable,
        emptyLine(200, 0),

        /* 7. Footer */
        footerParagraph,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Tutanak-${tutanak.tutanakNo}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ── Ana Bileşen ───────────────────────────────────────────── */
export default function TutanaklarPage() {
  const {
    tutanaklar, firmalar, currentUser,
    addTutanak, updateTutanak, deleteTutanak,
    addToast, quickCreate, setQuickCreate, org, refreshData, dataLoading,
  } = useApp();
  const { canEdit, canCreate, canDelete, isReadOnly } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true);
    try { await refreshData(); addToast('Veriler güncellendi.', 'success'); }
    finally { setRefreshing(false); }
  };

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [wordLoading, setWordLoading] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Tutanak, 'id' | 'tutanakNo' | 'olusturmaTarihi' | 'guncellemeTarihi'>>(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  // Toplu silme state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const viewTutanak = useMemo(() => tutanaklar.find(t => t.id === viewId) ?? null, [tutanaklar, viewId]);

  // Sadece aktif (silinmemiş) firmalar
  const aktivFirmalar = firmalar.filter(f => !f.silinmis);

  useEffect(() => {
    if (quickCreate === 'tutanaklar') {
      setEditId(null);
      setForm({ ...emptyForm, olusturanKisi: currentUser.ad });
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate, currentUser.ad]);

  const filtered = useMemo(() => tutanaklar
    .filter(t => {
      if (t.silinmis) return false;
      const firma = firmalar.find(f => f.id === t.firmaId);
      const q = search.toLowerCase();
      return (
        (!q || t.baslik.toLowerCase().includes(q) || t.tutanakNo.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false))
        && (!firmaFilter || t.firmaId === firmaFilter)
        && (!statusFilter || t.durum === statusFilter)
      );
    })
    .sort((a, b) => {
      const ta = a.olusturmaTarihi ?? '';
      const tb = b.olusturmaTarihi ?? '';
      return tb.localeCompare(ta);
    }), [tutanaklar, firmalar, search, firmaFilter, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every(t => selected.has(t.id));
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(t => t.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkDelete = () => {
    selected.forEach(id => deleteTutanak(id));
    addToast(`${selected.size} tutanak silindi.`, 'info');
    setSelected(new Set());
    setBulkDeleteConfirm(false);
  };

  const stats = useMemo(() => {
    const aktif = tutanaklar.filter(t => !t.silinmis);
    return {
      total: aktif.length,
      taslak: aktif.filter(t => t.durum === 'Taslak').length,
      tamamlandi: aktif.filter(t => t.durum === 'Tamamlandı').length,
      onaylandi: aktif.filter(t => t.durum === 'Onaylandı').length,
    };
  }, [tutanaklar]);

  /* ── Modal açma/kapama ──────────────────────────────────── */
  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm, olusturanKisi: currentUser.ad });
    setShowModal(true);
  };

  const openEdit = (t: Tutanak) => {
    setEditId(t.id);
    setForm({
      firmaId: t.firmaId, baslik: t.baslik, aciklama: t.aciklama, tarih: t.tarih,
      durum: t.durum, olusturanKisi: t.olusturanKisi,
      dosyaAdi: t.dosyaAdi || '', dosyaBoyutu: t.dosyaBoyutu || 0,
      dosyaTipi: t.dosyaTipi || '', dosyaVeri: '', notlar: t.notlar,
    });
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  /* ── Form işlemleri ─────────────────────────────────────── */
  const sf = (field: keyof typeof form, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // FIX 4: useRef lock to prevent double-click duplicate submissions
  const submittingRef = useRef<boolean>(false);

  // AI Tutanak Oluşturma
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiKisaAciklama, setAiKisaAciklama] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiOlustur = async () => {
    if (!aiKisaAciklama.trim()) { addToast('Lütfen kısa bir açıklama girin.', 'error'); return; }
    setAiLoading(true);
    try {
      const firmaAdi = aktivFirmalar.find(f => f.id === form.firmaId)?.ad || '';
      const res = await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/openai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          mode: 'tutanak',
          data: { kisaAciklama: aiKisaAciklama, firmaAdi, tarih: form.tarih },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Hata');
      const { baslik, aciklama, notlar } = json.data;
      setForm(prev => ({
        ...prev,
        baslik: baslik || prev.baslik,
        aciklama: aciklama || prev.aciklama,
        notlar: notlar || prev.notlar,
      }));
      setAiModalOpen(false);
      setAiKisaAciklama('');
      addToast('Tutanak AI tarafından oluşturuldu!', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(`AI hatası: ${msg}`, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    setPendingFile(file);
    setForm(prev => ({
      ...prev,
      dosyaAdi: file.name,
      dosyaBoyutu: file.size,
      dosyaTipi: file.type,
    }));
  };

  const handleSave = async () => {
    if (!form.baslik.trim()) { addToast('Başlık zorunludur.', 'error'); return; }
    if (!form.firmaId)       { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!form.aciklama.trim()) { addToast('Açıklama zorunludur.', 'error'); return; }
    // FIX 4: Immediate ref lock — prevents double-click before state update
    if (submittingRef.current) return;
    submittingRef.current = true;

    const { uploadFileToStorage } = await import('@/utils/fileUpload');
    const orgId = org?.id ?? 'unknown';

    try {
      if (editId) {
        // Düzenleme: önce dosya yükle (varsa), sonra güncelle
        let dosyaUrl: string | undefined;
        if (pendingFile) {
          dosyaUrl = await uploadFileToStorage(pendingFile, orgId, 'tutanak', editId) ?? undefined;
          if (!dosyaUrl) {
            addToast('Dosya yüklenemedi. Lütfen tekrar deneyin.', 'error');
            return;
          }
        }
        updateTutanak(editId, { ...form, ...(dosyaUrl ? { dosyaUrl } : {}) });
        addToast('Tutanak güncellendi.', 'success');
      } else {
        // Yeni kayıt: önce kayıt oluştur, sonra dosya yükle (varsa)
        const tutanakNo = generateTutanakNo(tutanaklar);
        
        // Create record first — addTutanak is async (RPC call)
        const newTutanak = await addTutanak({ ...form, tutanakNo });
        if (!newTutanak?.id) {
          addToast('Tutanak oluşturulurken hata oluştu.', 'error');
          return;
        }
        
        // Then upload file with the actual record ID
        if (pendingFile) {
          const dosyaUrl = await uploadFileToStorage(pendingFile, orgId, 'tutanak', newTutanak.id) ?? undefined;
          if (dosyaUrl) {
            updateTutanak(newTutanak.id, { dosyaUrl });
          } else {
            addToast('Dosya yüklenemedi.', 'error');
          }
        }
        
        addToast(`Tutanak oluşturuldu: ${tutanakNo}`, 'success');
      }
      setPendingFile(null);
      closeModal();
    } finally {
      submittingRef.current = false;
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTutanak(deleteId);
    addToast('Tutanak silindi.', 'success');
    setDeleteId(null);
    // Eğer silinen tutanak detay modalında açıksa kapat
    if (viewId === deleteId) setViewId(null);
  };

  /* ── Dosya indirme ──────────────────────────────────────── */
  const handleFileDownload = async (t: Tutanak) => {
    if (!t.dosyaUrl) { addToast('Bu tutanak için yüklenmiş dosya bulunamadı.', 'error'); return; }
    try {
      const resolvedUrl = await getSignedUrlFromPath(t.dosyaUrl);
      if (!resolvedUrl) { addToast('Dosya erişim linki alınamadı.', 'error'); return; }
      const res = await fetch(resolvedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = t.dosyaAdi || 'tutanak-eki';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast(`"${t.dosyaAdi}" indiriliyor...`, 'success');
    } catch { addToast('Dosya indirilemedi.', 'error'); }
  };

  /* ── Dosya verisini al (Storage URL — tüm cihazlarda çalışır) ── */
  const resolveFileVeri = async (t: Tutanak): Promise<string | undefined> => {
    if (!t.dosyaUrl) return undefined;
    try {
      const resolvedUrl = await getSignedUrlFromPath(t.dosyaUrl);
      if (!resolvedUrl) return undefined;
      const res = await fetch(resolvedUrl);
      if (res.ok) {
        const blob = await res.blob();
        return new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(undefined as unknown as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch { /* ignore */ }
    return undefined;
  };

  const handleWordDownload = async (t: Tutanak) => {
    setWordLoading(t.id);
    try {
      const firma = firmalar.find(f => f.id === t.firmaId);
      const fileVeri = await resolveFileVeri(t);
      // Firma logosu artık firma.logoUrl'den gelir (Storage URL)
      const firmaLogoUrl = (firma as Firma & { logoUrl?: string })?.logoUrl;
      let firmaLogoVeri: string | undefined;
      if (firmaLogoUrl) {
        try {
          const res = await fetch(firmaLogoUrl);
          if (res.ok) {
            const blob = await res.blob();
            firmaLogoVeri = await new Promise<string>(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
        } catch { /* logo yüklenemedi */ }
      }
      await generateWordDoc(t, firma?.ad || '—', fileVeri, firmaLogoVeri);
      addToast(`Tutanak-${t.tutanakNo}.docx indiriliyor...`, 'success');
    } catch {
      addToast('Word belgesi oluşturulurken hata oluştu.', 'error');
    } finally {
      setWordLoading(null);
    }
  };

  /* ── İnput ortak stil sınıfı ─────────────────────────────── */
  const inp = 'isg-input w-full';

  return (
    <div className="space-y-5">
      {/* Read-only Banner */}
      {isReadOnly && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)' }}>
          <i className="ri-search-eye-line flex-shrink-0" style={{ color: '#06B6D4' }} />
          <p className="text-sm" style={{ color: '#06B6D4' }}>
            <strong>Denetçi Modu:</strong> Tutanaklar yalnızca görüntüleme amaçlıdır. Değişiklik yapma yetkiniz bulunmamaktadır.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tutanaklar</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Firma bazlı tutanakları yönetin ve Word belgesi oluşturun
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button onClick={handleRefresh} disabled={refreshing || dataLoading} className="btn-secondary whitespace-nowrap">
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          {canCreate && (
            <button onClick={openAdd} className="btn-primary whitespace-nowrap">
              <i className="ri-add-line" /> Yeni Tutanak
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Tutanak', value: stats.total,      icon: 'ri-article-line',         color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Taslak',         value: stats.taslak,     icon: 'ri-draft-line',            color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
          { label: 'Tamamlandı',     value: stats.tamamlandi, icon: 'ri-checkbox-circle-line',  color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Onaylandı',      value: stats.onaylandi,  icon: 'ri-shield-check-line',     color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
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
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tutanak no, başlık veya firma ara..."
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
          {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '140px' }}
        >
          <option value="">Tüm Durumlar</option>
          {(Object.keys(STS_CONFIG) as TutanakStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(search || firmaFilter || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); }}
            className="btn-secondary whitespace-nowrap"
          >
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Toplu seçim aksiyonları */}
      {selected.size > 0 && canDelete && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="text-sm font-semibold" style={{ color: '#F87171' }}>{selected.size} tutanak seçildi</span>
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

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-article-line text-3xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Tutanak kaydı bulunamadı</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>Yeni tutanak oluşturmak için butonu kullanın</p>
          {canCreate && <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Yeni Tutanak</button>}
        </div>
      ) : (
        <div className="isg-card rounded-xl overflow-hidden">
          {/* Mobil kart görünümü */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filtered.map(t => {
              const firma = firmalar.find(f => f.id === t.firmaId);
              const stc = STS_CONFIG[t.durum] ?? { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-question-line' };
              return (
                <div key={t.id} className="p-4" style={{ background: selected.has(t.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                  <div className="flex items-start gap-3">
                    {canDelete && (
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} className="cursor-pointer mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-bold" style={{ color: '#60A5FA' }}>{t.tutanakNo}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap" style={{ background: stc.bg, color: stc.color }}>
                          <i className={stc.icon} />{t.durum}
                        </span>
                      </div>
                      <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>{t.baslik}</p>
                      {t.aciklama && (
                        <p className="text-xs mb-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{t.aciklama}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {firma && <span><i className="ri-building-2-line mr-1" />{firma.ad}</span>}
                        {t.tarih && <span><i className="ri-calendar-line mr-1" />{new Date(t.tarih).toLocaleDateString('tr-TR')}</span>}
                        {t.olusturanKisi && <span><i className="ri-user-line mr-1" />{t.olusturanKisi}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 justify-end flex-wrap">
                    {t.dosyaAdi && (
                      <button onClick={() => handleFileDownload(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>
                        <i className="ri-attachment-2" />Dosya
                      </button>
                    )}
                    <button onClick={() => setViewId(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <i className="ri-eye-line" />Görüntüle
                    </button>
                    {canEdit && (
                      <button onClick={() => openEdit(t)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                        <i className="ri-edit-line text-sm" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeleteId(t.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    )}
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
                  <th className="text-left">Tutanak No</th>
                  <th className="text-left">Başlık</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden lg:table-cell">Tarih</th>
                  <th className="text-left">Durum</th>
                  <th className="text-left hidden lg:table-cell">Oluşturan</th>
                  <th className="text-left hidden md:table-cell">Ek Dosya</th>
                  <th className="text-right w-36">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const firma = firmalar.find(f => f.id === t.firmaId);
                  const stc = STS_CONFIG[t.durum] ?? { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-question-line' };
                  return (
                    <tr key={t.id} style={{ background: selected.has(t.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                      {canDelete && (
                        <td className="text-center">
                          <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} className="cursor-pointer" />
                        </td>
                      )}
                      <td>
                        <span className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>
                          {t.tutanakNo}
                        </span>
                      </td>
                      <td>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.baslik}</p>
                        {t.aciklama && (
                          <p className="text-xs mt-0.5 truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                            {t.aciklama}
                          </p>
                        )}
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firma?.ad || '—'}</span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {t.tarih ? new Date(t.tarih).toLocaleDateString('tr-TR') : '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{ background: stc.bg, color: stc.color }}
                        >
                          <i className={stc.icon} />{t.durum}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.olusturanKisi || '—'}</span>
                      </td>
                      <td className="hidden md:table-cell">
                        {t.dosyaAdi ? (
                          <button
                            onClick={() => handleFileDownload(t)}
                            className="flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all hover:gap-2 whitespace-nowrap"
                            style={{ color: '#34D399' }}
                          >
                            <i className="ri-attachment-2 text-sm" />
                            <span className="max-w-[70px] truncate">{t.dosyaAdi}</span>
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          <button
                            onClick={() => setViewId(t.id)}
                            title="Tutanağı Görüntüle / İndir"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                          >
                            <i className="ri-eye-line" />
                            <span className="hidden lg:inline">Görüntüle</span>
                          </button>
                          {canEdit && <TableBtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(t)} title="Düzenle" />}
                          {canDelete && <TableBtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteId(t.id)} title="Sil" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Form Modal ─────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editId ? 'Tutanak Düzenle' : 'Yeni Tutanak Oluştur'}
        size="lg"
        icon="ri-article-line"
        footer={
          <>
            <button onClick={closeModal} className="btn-secondary whitespace-nowrap">İptal</button>
            {!editId && (
              <button
                onClick={() => setAiModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                <i className="ri-sparkling-line" /> AI ile Oluştur
              </button>
            )}
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editId ? 'ri-save-line' : 'ri-add-line'} />
              {editId ? 'Güncelle' : 'Oluştur'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Otomatik tutanak no bilgisi */}
          {!editId && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <i className="ri-barcode-line flex-shrink-0" style={{ color: '#60A5FA' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tutanak numarası otomatik üretilir</p>
                <p className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>
                  {generateTutanakNo(tutanaklar)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Başlık */}
            <div className="sm:col-span-2">
              <label className="form-label">Başlık *</label>
              <input
                value={form.baslik}
                onChange={e => sf('baslik', e.target.value)}
                placeholder="Tutanak başlığı..."
                className={inp}
              />
            </div>

            {/* Firma */}
            <div>
              <label className="form-label">Firma *</label>
              <select
                value={form.firmaId}
                onChange={e => sf('firmaId', e.target.value)}
                className={inp}
              >
                <option value="">Firma Seçin</option>
                {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
              </select>
              {aktivFirmalar.length === 0 && (
                <p className="text-xs mt-1" style={{ color: '#F59E0B' }}>
                  Önce firma eklemeniz gerekmektedir.
                </p>
              )}
            </div>

            {/* Tarih */}
            <div>
              <label className="form-label">Tutanak Tarihi</label>
              <input
                type="date"
                value={form.tarih}
                onChange={e => sf('tarih', e.target.value)}
                className={inp}
              />
            </div>

            {/* Oluşturan Kişi */}
            <div>
              <label className="form-label">Oluşturan Kişi</label>
              <input
                value={form.olusturanKisi}
                onChange={e => sf('olusturanKisi', e.target.value)}
                placeholder="Ad Soyad"
                className={inp}
              />
            </div>

            {/* Durum */}
            <div>
              <label className="form-label">Durum</label>
              <select
                value={form.durum}
                onChange={e => sf('durum', e.target.value as TutanakStatus)}
                className={inp}
              >
                {(Object.keys(STS_CONFIG) as TutanakStatus[]).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                Yeni tutanaklar varsayılan olarak <strong>Taslak</strong> oluşturulur
              </p>
            </div>

            {/* Açıklama */}
            <div className="sm:col-span-2">
              <label className="form-label">Açıklama *</label>
              <textarea
                value={form.aciklama}
                onChange={e => sf('aciklama', e.target.value)}
                placeholder="Tutanak detayları ve açıklaması..."
                rows={4}
                maxLength={500}
                className={`${inp} resize-y`}
              />
              <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-faint)' }}>
                {form.aciklama.length}/500
              </p>
            </div>

            {/* Dosya Yükleme */}
            <div className="sm:col-span-2">
              <label className="form-label">Ek Dosya / Görsel (PDF / JPG / PNG)</label>
              <div
                className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
                style={{ border: '2px dashed var(--border-subtle)', background: 'var(--bg-item)' }}
                onClick={() => fileRef.current?.click()}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
                  e.currentTarget.style.background = 'rgba(59,130,246,0.04)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--bg-item)';
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}
              >
                {form.dosyaAdi ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.12)' }}>
                      <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.dosyaAdi}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {form.dosyaBoyutu ? `${(form.dosyaBoyutu / 1024).toFixed(1)} KB` : ''}
                        {' — Değiştirmek için tıklayın'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <i className="ri-upload-cloud-2-line text-2xl mb-2" style={{ color: 'var(--text-faint)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                      Dosya sürükleyin veya tıklayın
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>PDF, JPG, PNG • Maks. 5MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => handleFileChange(e.target.files?.[0])}
              />
            </div>

            {/* İndirme bilgi notu */}
            <div className="sm:col-span-2">
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                <i className="ri-download-line mt-0.5 flex-shrink-0" style={{ color: '#3B82F6' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Kayıt oluşturduktan sonra{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>Görüntüle</strong>{' '}
                  butonuna tıklayarak tutanağı önizleyebilir ve{' '}
                  <strong style={{ color: '#3B82F6' }}>Word (.docx)</strong>{' '}
                  formatında indirebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── AI Tutanak Oluşturma Modal ── */}
      <Modal
        open={aiModalOpen}
        onClose={() => { setAiModalOpen(false); setAiKisaAciklama(''); }}
        title="AI ile Tutanak Oluştur"
        size="sm"
        icon="ri-sparkling-line"
        footer={
          <>
            <button onClick={() => { setAiModalOpen(false); setAiKisaAciklama(''); }} className="btn-secondary whitespace-nowrap">İptal</button>
            <button
              onClick={handleAiOlustur}
              disabled={aiLoading || !aiKisaAciklama.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }}
            >
              {aiLoading
                ? <><i className="ri-loader-4-line animate-spin" /> Oluşturuluyor...</>
                : <><i className="ri-sparkling-line" /> Tutanak Oluştur</>
              }
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.2)' }}>
            <i className="ri-sparkling-line mt-0.5 flex-shrink-0" style={{ color: '#A5B4FC' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#A5B4FC' }}>Nasıl çalışır?</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Kısa bir açıklama gir, AI otomatik olarak tutanak başlığı, detaylı açıklama ve notları oluştursun. İstersen sonradan düzenleyebilirsin.
              </p>
            </div>
          </div>
          <div>
            <label className="form-label">Kısa Açıklama *</label>
            <textarea
              value={aiKisaAciklama}
              onChange={e => setAiKisaAciklama(e.target.value)}
              placeholder="Örn: Depo alanında yangın tüplerinin süresi dolmuş, çalışanlar kişisel koruyucu ekipman kullanmıyor..."
              rows={4}
              maxLength={300}
              className="isg-input resize-none"
              autoFocus
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-faint)' }}>{aiKisaAciklama.length}/300</p>
          </div>
          {form.firmaId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <i className="ri-building-2-line" style={{ color: '#34D399' }} />
              <span style={{ color: 'var(--text-muted)' }}>Firma: <strong style={{ color: '#34D399' }}>{aktivFirmalar.find(f => f.id === form.firmaId)?.ad}</strong></span>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Silme Onay Modal ──────────────────────────────── */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Tutanağı Sil"
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
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            Bu tutanağı silmek istediğinizden emin misiniz?
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Tutanak çöp kutusuna taşınacak, oradan geri yükleyebilirsiniz.
          </p>
        </div>
      </Modal>

      {/* ── Toplu Silme Onay Modal ── */}
      <Modal
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        title="Toplu Silme Onayı"
        size="sm"
        icon="ri-delete-bin-2-line"
        footer={
          <>
            <button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleBulkDelete} className="btn-danger whitespace-nowrap">
              <i className="ri-delete-bin-line" /> {selected.size} Tutanağı Sil
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            <strong>{selected.size}</strong> tutanak çöp kutusuna taşınacak.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Çöp kutusundan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      {/* ── Tutanak Detay / Önizleme Modal ─────────────────── */}
      <TutanakDetailModal
        tutanak={viewTutanak}
        firma={viewTutanak ? firmalar.find(f => f.id === viewTutanak.firmaId) : undefined}
        dosyaVeri={viewTutanak ? (viewTutanak.dosyaUrl || viewTutanak.dosyaVeri) : undefined}
        onClose={() => setViewId(null)}
        onEdit={(t) => { setViewId(null); openEdit(t); }}
        onWordDownload={handleWordDownload}
        wordLoading={wordLoading}
        canEdit={canEdit}
      />
    </div>
  );
}

/* ── Tablo aksiyon butonu ──────────────────────────────────── */
function TableBtn({ icon, color, onClick, title }: {
  icon: string; color: string; onClick: () => void; title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hover:scale-110"
      style={{ color: '#475569' }}
      onMouseEnter={e => {
        e.currentTarget.style.color = color;
        e.currentTarget.style.background = `${color}18`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = '#475569';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <i className={`${icon} text-sm`} />
    </button>
  );
}
