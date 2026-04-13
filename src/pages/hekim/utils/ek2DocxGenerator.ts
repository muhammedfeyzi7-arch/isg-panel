import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, HeightRule,
} from 'docx';

export interface EK2DocxData {
  personelAd: string;
  personelGorev?: string;
  firmaAd: string;
  kronikHastaliklar?: string;
  ilacKullanim?: string;
  ameliyatGecmisi?: string;
  tansiyon?: string;
  nabiz?: string;
  gorme?: string;
  isitme?: string;
  sonuc: string;
  aciklama?: string;
  doktor?: string;
  hastane?: string;
  muayeneTarihi?: string;
  sonrakiTarih?: string;
}

const FONT = 'Calibri';
const ACCENT = '1B3A6B';
const ACCENT2 = '2563EB';
const LABEL_BG = 'EFF6FF';
const HEADER_BG = '1B3A6B';

function fmtDate(d?: string): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return d; }
}

function fmtDateLong(d?: string): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

function sonucLabel(s: string): string {
  if (s === 'uygun') return 'Çalışabilir — Uygun';
  if (s === 'kisitli') return 'Kısıtlı Çalışabilir';
  if (s === 'uygun_degil') return 'Çalışamaz — Uygun Değil';
  return s;
}

function sonucColor(s: string): string {
  if (s === 'uygun') return '15803D';
  if (s === 'kisitli') return 'B45309';
  return 'B91C1C';
}

function sonucBg(s: string): string {
  if (s === 'uygun') return 'F0FDF4';
  if (s === 'kisitli') return 'FFFBEB';
  return 'FFF1F2';
}

const emptyLine = (before = 0, after = 0) => new Paragraph({
  spacing: { before, after }, children: [],
});

function sectionHeader(text: string, before = 280): Paragraph {
  return new Paragraph({
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
}

function makeCell(
  text: string,
  opts: {
    bold?: boolean; size?: number; color?: string; bg?: string;
    align?: typeof AlignmentType[keyof typeof AlignmentType];
    width?: number; labelCell?: boolean;
    verticalAlign?: typeof VerticalAlign[keyof typeof VerticalAlign];
    colspan?: number; italics?: boolean;
  } = {},
): TableCell {
  const {
    bold = false, size = 20, color = '1F2937', bg,
    align = AlignmentType.LEFT, width, labelCell = false,
    verticalAlign = VerticalAlign.CENTER, colspan, italics = false,
  } = opts;

  const borderStyle = { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' };

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
        children: [new TextRun({ text: text || '—', bold, size, font: FONT, color, italics })],
      }),
    ],
  });
}

function makeSignCell(title: string, name: string): TableCell {
  return new TableCell({
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
        children: [new TextRun({ text: fmtDate(new Date().toISOString()), size: 18, font: FONT, color: '6B7280' })],
      }),
    ],
  });
}

export async function generateEK2Docx(data: EK2DocxData): Promise<void> {
  const raporNo = `EK2-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

  /* ── BAŞLIK TABLOSU ── */
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
        children: [new TextRun({ text: 'T.C. ÇALIŞMA VE SOSYAL GÜVENLİK BAKANLIĞI', bold: true, size: 20, font: FONT, color: 'FFFFFF' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: 'PERİYODİK MUAYENE FORMU', bold: true, size: 26, font: FONT, color: 'BFD7FF' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: '(İşyeri Hekimi Tarafından Yapılacak Periyodik Muayene — EK-2)', size: 18, font: FONT, color: '93C5FD' })],
      }),
    ],
  });

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
        children: [new TextRun({ text: 'Form No', bold: true, size: 18, font: FONT, color: '6B7280' })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: raporNo, bold: true, size: 22, font: FONT, color: ACCENT })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: fmtDate(data.muayeneTarihi), size: 18, font: FONT, color: '6B7280' })],
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
        children: [titleCell, noCell],
      }),
    ],
  });

  /* ── PERSONEL BİLGİLERİ ── */
  const personelTable = new Table({
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
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('AD SOYAD', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.personelAd, { size: 20, bold: true, color: '111827', width: 3800 }),
          makeCell('GÖREV / ÜNVAN', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.personelGorev || '—', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('ÇALIŞTIĞI FİRMA', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.firmaAd, { size: 20, color: '111827', width: 3800 }),
          makeCell('MUAYENE TARİHİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(fmtDateLong(data.muayeneTarihi), { size: 20, color: '111827', width: 3000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('SONRAKİ MUAYENE', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(fmtDateLong(data.sonrakiTarih), { size: 20, color: '111827', width: 3800 }),
          makeCell('HEKİM', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.doktor || '—', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
    ],
  });

  /* ── SAĞLIK BEYANI ── */
  const saglikTable = new Table({
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
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('KRONİK HASTALIKLAR', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          makeCell(data.kronikHastaliklar || 'Yok / Belirtilmemiş', { size: 20, color: '111827', width: 8000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('KULLANILAN İLAÇLAR', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          makeCell(data.ilacKullanim || 'Yok / Belirtilmemiş', { size: 20, color: '111827', width: 8000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('AMELİYAT GEÇMİŞİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          makeCell(data.ameliyatGecmisi || 'Yok / Belirtilmemiş', { size: 20, color: '111827', width: 8000 }),
        ],
      }),
    ],
  });

  /* ── MUAYENE BULGULARI ── */
  const bulgularTable = new Table({
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
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('TANSİYON (mmHg)', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          makeCell(data.tansiyon || 'Değerlendirilmedi', { size: 20, color: '111827', width: 3000 }),
          makeCell('NABİZ (atım/dk)', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          makeCell(data.nabiz || 'Değerlendirilmedi', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('GÖRME', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          makeCell(data.gorme || 'Değerlendirilmedi', { size: 20, color: '111827', width: 3000 }),
          makeCell('İŞİTME', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          makeCell(data.isitme || 'Değerlendirilmedi', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
    ],
  });

  /* ── MUAYENE SONUCU ── */
  const sonucBgColor = sonucBg(data.sonuc);
  const sonucColorVal = sonucColor(data.sonuc);

  const sonucTable = new Table({
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
      new TableRow({
        height: { value: 600, rule: HeightRule.ATLEAST },
        children: [
          makeCell('MUAYENE KARARI', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          new TableCell({
            width: { size: 8000, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: sonucBgColor },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            },
            children: [
              new Paragraph({
                children: [new TextRun({ text: sonucLabel(data.sonuc), bold: true, size: 26, font: FONT, color: sonucColorVal })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('AÇIKLAMA / KISITLAMALAR', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 2000, labelCell: true }),
          makeCell(data.aciklama || '—', { size: 20, color: '111827', italics: false, width: 8000 }),
        ],
      }),
    ],
  });

  /* ── İMZA ── */
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
          makeSignCell('PERSONEL', data.personelAd),
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
          makeSignCell('İŞYERİ HEKİMİ / MÜHÜR', data.doktor || ''),
        ],
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [
    headerTable,
    emptyLine(200, 0),

    sectionHeader('1. PERSONEL BİLGİLERİ', 0),
    emptyLine(120, 0),
    personelTable,
    emptyLine(200, 0),

    sectionHeader('2. SAĞLIK BEYANI (ANAMNEZ)', 0),
    emptyLine(120, 0),
    saglikTable,
    emptyLine(200, 0),

    sectionHeader('3. MUAYENE BULGULARI', 0),
    emptyLine(120, 0),
    bulgularTable,
    emptyLine(200, 0),

    sectionHeader('4. MUAYENE SONUCU VE DEĞERLENDİRME', 0),
    emptyLine(120, 0),
    sonucTable,
    emptyLine(200, 0),

    sectionHeader('İMZA VE ONAY', 0),
    emptyLine(160, 0),
    signatureTable,
    emptyLine(200, 0),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } },
      children: [
        new TextRun({ text: 'ISG Denetim Sistemi', size: 16, font: FONT, color: '9CA3AF', bold: true }),
        new TextRun({ text: `   ·   ${raporNo}   ·   ${fmtDate(data.muayeneTarihi)}`, size: 16, font: FONT, color: '9CA3AF' }),
        new TextRun({ text: '   ·   6331 sayılı İSG Kanunu kapsamında düzenlenmiştir.', size: 16, font: FONT, color: '9CA3AF' }),
      ],
    }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: {
        page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = data.muayeneTarihi
    ? new Date(data.muayeneTarihi).toLocaleDateString('tr-TR').replace(/\./g, '-')
    : new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  a.download = `EK2-Muayene-${data.personelAd.replace(/\s+/g, '-')}-${dateStr}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
