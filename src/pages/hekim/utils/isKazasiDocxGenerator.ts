import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, HeightRule,
} from 'docx';

export interface IsKazasiDocxData {
  id?: string;
  personelAd: string;
  personelGorev?: string;
  firmaAd: string;
  kazaTarihi: string;
  kazaSaati?: string;
  kazaYeri?: string;
  kazaTuru?: string;
  kazaAciklamasi?: string;
  yaraliVucutBolgeleri?: string[];
  yaralanmaTuru?: string;
  yaralanmaSiddeti?: string;
  isGunuKaybi?: number;
  hastaneyeKaldirildi?: boolean;
  hastaneAdi?: string;
  tanikBilgileri?: string;
  onlemler?: string;
  durum?: string;
  sgkBildirildi?: boolean;
  sgkBildirimTarihi?: string;
  sgkBildirimNotu?: string;
  besNeden?: { sira: number; neden: string; aciklama: string }[];
  kazaTipi?: string;
  riskSeviyesi?: string;
  doktor?: string;
}

const VUCUT_LABEL: Record<string, string> = {
  bas: 'Baş', boyun: 'Boyun', sag_omuz: 'Sağ Omuz', sol_omuz: 'Sol Omuz',
  gogus: 'Göğüs', sirt: 'Sırt', sag_kol: 'Sağ Kol', sol_kol: 'Sol Kol',
  sag_el: 'Sağ El', sol_el: 'Sol El', karin: 'Karın/Bel',
  sag_kalca: 'Sağ Kalça', sol_kalca: 'Sol Kalça',
  sag_bacak: 'Sağ Bacak', sol_bacak: 'Sol Bacak',
  sag_ayak: 'Sağ Ayak', sol_ayak: 'Sol Ayak',
};

const KAZA_TIPI_MAP: Record<string, string> = {
  is_kazasi: 'İş Kazası',
  ramak_kala: 'Ramak Kala (Near Miss)',
  meslek_hastaligi: 'Meslek Hastalığı',
};

const RISK_MAP: Record<string, string> = {
  dusuk: 'Düşük', orta: 'Orta', yuksek: 'Yüksek', kritik: 'Kritik',
};

const FONT = 'Calibri';
const ACCENT = '1B3A6B';    // koyu lacivert
const ACCENT2 = '2563EB';   // mavi
const LABEL_BG = 'EFF6FF';  // açık mavi
const HEADER_BG = '1B3A6B'; // header bg

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

/* ── Yardımcı: boş satır ── */
const emptyLine = (before = 0, after = 0) => new Paragraph({
  spacing: { before, after },
  children: [],
});

/* ── Yardımcı: bölüm başlığı ── */
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

/* ── Tablo hücresi yardımcısı ── */
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

/* ── Açıklama metin bloğu ── */
function textBlock(text: string): Table {
  return new Table({
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
        height: { value: 600, rule: HeightRule.ATLEAST },
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
                children: [new TextRun({ text: text || '—', size: 22, font: FONT, color: '374151' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/* ── İmza hücresi ── */
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

export async function generateIsKazasiDocx(data: IsKazasiDocxData): Promise<void> {
  const raporNo = `IK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  const bolgeLabels = (data.yaraliVucutBolgeleri ?? []).map(id => VUCUT_LABEL[id] ?? id).join(', ') || '—';
  const besNedenFiltered = (data.besNeden ?? []).filter(n => n.neden);
  const tarihStr = fmtDate(data.kazaTarihi);

  /* ── BAŞLIK TABLOSU (Tutanak formatında) ── */
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
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: 'İŞ KAZASI TUTANAĞI', bold: true, size: 28, font: FONT, color: 'BFD7FF' })],
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
        children: [new TextRun({ text: 'Rapor No', bold: true, size: 18, font: FONT, color: '6B7280' })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: raporNo, bold: true, size: 22, font: FONT, color: ACCENT })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: tarihStr, size: 18, font: FONT, color: '6B7280' })],
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
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('FİRMA / İŞYERİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(data.firmaAd, { size: 20, color: '111827', width: 3600 }),
          makeCell('KAZAZEDE', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(data.personelAd, { size: 20, color: '111827', width: 3600 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('KAZA TARİHİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(fmtDateLong(data.kazaTarihi) + (data.kazaSaati ? ` — ${data.kazaSaati}` : ''), { size: 20, color: '111827', width: 3600 }),
          makeCell('KAZA YERİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(data.kazaYeri || '—', { size: 20, color: '111827', width: 3600 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('KAZA TÜRÜ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(data.kazaTuru || '—', { size: 20, color: '111827', width: 3600 }),
          makeCell('KAZA TİPİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(KAZA_TIPI_MAP[data.kazaTipi ?? ''] || data.kazaTipi || '—', { size: 20, color: '111827', width: 3600 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('RİSK SEVİYESİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(RISK_MAP[data.riskSeviyesi ?? ''] || data.riskSeviyesi || '—', { size: 20, color: '111827', width: 3600 }),
          makeCell('DURUM', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1400, labelCell: true }),
          makeCell(data.durum || '—', { size: 20, color: '111827', width: 3600 }),
        ],
      }),
    ],
  });

  /* ── YARALANMA TABLOSU ── */
  const yaralanmaTable = new Table({
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
          makeCell('YARALANAN BÖLGELER', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(bolgeLabels, { size: 20, color: '111827', width: 3800 }),
          makeCell('YARALANMA TÜRÜ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.yaralanmaTuru || '—', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('YARALANMA ŞİDDETİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.yaralanmaSiddeti || '—', { size: 20, bold: true, color: 'B91C1C', width: 3800 }),
          makeCell('İŞ GÜNÜ KAYBI', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.isGunuKaybi ? `${data.isGunuKaybi} gün` : 'Yok', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('HASTANEYE KALDIRILDI', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.hastaneyeKaldirildi ? 'Evet' : 'Hayır', { size: 20, color: '111827', width: 3800 }),
          makeCell('HASTANE ADI', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.hastaneAdi || '—', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
    ],
  });

  /* ── SGK TABLOSU ── */
  const sgkTable = new Table({
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
          makeCell("SGK'YA BİLDİRİLDİ", { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.sgkBildirildi ? 'Evet' : 'Hayır', { size: 20, color: '111827', width: 3800 }),
          makeCell('BİLDİRİM TARİHİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.sgkBildirimTarihi ? fmtDate(data.sgkBildirimTarihi) : '—', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('BİLDİRİM NOTU / REF NO', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.sgkBildirimNotu || '—', { size: 20, color: '111827', width: 8400, colspan: 3 }),
        ],
      }),
    ],
  });

  /* ── 5 NEDEN TABLOSU ── */
  const besNedenRows = besNedenFiltered.map((item, idx) =>
    new TableRow({
      height: { value: 400, rule: HeightRule.ATLEAST },
      children: [
        makeCell(String(idx + 1), { bold: true, size: 20, color: 'FFFFFF', bg: ACCENT, width: 400, align: AlignmentType.CENTER, labelCell: true }),
        makeCell(item.neden, { size: 20, color: '111827', width: 4600 }),
        makeCell(item.aciklama || '—', { size: 18, color: '64748B', italics: true, width: 4900 }),
      ],
    }),
  );

  /* ── İMZA TABLOSU ── */
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
          makeSignCell('KAZAZEDE', data.personelAd),
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
          makeSignCell('İŞVEREN VEKİLİ', ''),
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
          makeSignCell('İŞYERİ HEKİMİ / ISG UZMANI', data.doktor || ''),
        ],
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [
    /* Header */
    headerTable,
    emptyLine(200, 0),

    /* 1. Genel Bilgiler */
    sectionHeader('1. GENEL BİLGİLER', 0),
    emptyLine(120, 0),
    infoTable,
    emptyLine(200, 0),

    /* 2. Kaza Açıklaması */
    sectionHeader('2. KAZA AÇIKLAMASI', 0),
    emptyLine(120, 0),
    textBlock(data.kazaAciklamasi || '—'),
    emptyLine(200, 0),

    /* 3. Yaralanma */
    sectionHeader('3. YARALANMA BİLGİSİ', 0),
    emptyLine(120, 0),
    yaralanmaTable,
    emptyLine(200, 0),

    /* 4. SGK */
    sectionHeader('4. SGK BİLDİRİMİ', 0),
    emptyLine(120, 0),
    sgkTable,
    emptyLine(200, 0),
  ];

  /* 5. 5 Neden */
  if (besNedenRows.length > 0) {
    children.push(sectionHeader('5. 5 NEDEN KÖK NEDEN ANALİZİ', 0));
    children.push(emptyLine(120, 0));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideH: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideV: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        },
        rows: besNedenRows,
      }),
    );
    children.push(emptyLine(200, 0));
  }

  /* 6. Önlemler */
  children.push(sectionHeader('6. ALINAN ÖNLEMLER', 0));
  children.push(emptyLine(120, 0));
  children.push(textBlock(data.onlemler || 'Belirtilmemiş'));
  children.push(emptyLine(200, 0));

  /* 7. Sonuç & Tanık */
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
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('TANIK BİLGİLERİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.tanikBilgileri || '—', { size: 20, color: '111827', width: 3800 }),
          makeCell('KAYIT DURUMU', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.durum || '—', { size: 20, color: '111827', width: 3000 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          makeCell('HAZIRLAYAN HEKİM', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(data.doktor || 'İşyeri Hekimi', { size: 20, color: '111827', width: 3800 }),
          makeCell('RAPOR TARİHİ', { bold: true, size: 18, color: ACCENT, bg: LABEL_BG, width: 1600, labelCell: true }),
          makeCell(fmtDateLong(new Date().toISOString()), { size: 20, color: '111827', width: 3000 }),
        ],
      }),
    ],
  });

  children.push(sectionHeader('7. SONUÇ VE KAYIT DURUMU', 0));
  children.push(emptyLine(120, 0));
  children.push(sonucTable);
  children.push(emptyLine(200, 0));

  /* İmzalar */
  children.push(sectionHeader('İMZA VE ONAY', 0));
  children.push(emptyLine(160, 0));
  children.push(signatureTable);
  children.push(emptyLine(200, 0));

  /* Footer */
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } },
      children: [
        new TextRun({ text: 'ISG Denetim Sistemi', size: 16, font: FONT, color: '9CA3AF', bold: true }),
        new TextRun({ text: `   ·   ${raporNo}   ·   ${tarihStr}`, size: 16, font: FONT, color: '9CA3AF' }),
      ],
    }),
  );

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
  const dateStr = data.kazaTarihi
    ? new Date(data.kazaTarihi).toLocaleDateString('tr-TR').replace(/\./g, '-')
    : new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  a.download = `IsKazasi-Tutanak-${data.personelAd.replace(/\s+/g, '-')}-${dateStr}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
