import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, BorderStyle, ShadingType,
  WidthType, VerticalAlign, HeightRule,
} from 'docx';
import { saveAs } from 'file-saver';

interface Props {
  onClose: () => void;
}

type EkipTuru = 'kurtarma' | 'tahliye' | 'sondurme' | 'ilkYardim';

interface Personel {
  id: number;
  adSoyad: string;
  tc: string;
  telefon: string;
}

interface EkipData {
  label: string;
  color: string;
  icon: string;
  personeller: Personel[];
}

const EKIP_TURLERI: Record<EkipTuru, { label: string; color: string; icon: string }> = {
  kurtarma:  { label: 'Kurtarma Ekibi',       color: '#D97706', icon: 'ri-shield-user-line' },
  tahliye:   { label: 'Tahliye Ekibi',         color: '#EA580C', icon: 'ri-run-line' },
  sondurme:  { label: 'Söndürme Ekibi',        color: '#DC2626', icon: 'ri-fire-line' },
  ilkYardim: { label: 'İlk Yardım Ekibi',      color: '#059669', icon: 'ri-heart-pulse-line' },
};

let nextId = 1;

export default function AcilDurumEkipleriModal({ onClose }: Props) {
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const [firmaAdi, setFirmaAdi] = useState('');
  const [wordLoading, setWordLoading] = useState(false);

  // Ekip verileri
  const [ekipler, setEkipler] = useState<Record<EkipTuru, EkipData>>({
    kurtarma:  { ...EKIP_TURLERI.kurtarma,  personeller: [] },
    tahliye:   { ...EKIP_TURLERI.tahliye,   personeller: [] },
    sondurme:  { ...EKIP_TURLERI.sondurme,  personeller: [] },
    ilkYardim: { ...EKIP_TURLERI.ilkYardim, personeller: [] },
  });

  // Yeni personel ekleme formu
  const [seciliEkip, setSeciliEkip] = useState<EkipTuru>('kurtarma');
  const [yeniAd, setYeniAd] = useState('');
  const [yeniTc, setYeniTc] = useState('');
  const [yeniTelefon, setYeniTelefon] = useState('');
  const [formError, setFormError] = useState('');

  const handlePersonelEkle = () => {
    if (!yeniAd.trim()) { setFormError('Adı Soyadı zorunludur.'); return; }
    setFormError('');
    const yeni: Personel = { id: nextId++, adSoyad: yeniAd.trim(), tc: yeniTc.trim(), telefon: yeniTelefon.trim() };
    setEkipler(prev => ({
      ...prev,
      [seciliEkip]: { ...prev[seciliEkip], personeller: [...prev[seciliEkip].personeller, yeni] },
    }));
    setYeniAd('');
    setYeniTc('');
    setYeniTelefon('');
  };

  const handlePersonelSil = (ekip: EkipTuru, id: number) => {
    setEkipler(prev => ({
      ...prev,
      [ekip]: { ...prev[ekip], personeller: prev[ekip].personeller.filter(p => p.id !== id) },
    }));
  };

  const toplamPersonel = Object.values(ekipler).reduce((acc, e) => acc + e.personeller.length, 0);
  const isValid = firmaAdi.trim() && toplamPersonel > 0;

  /* ─────────────────────────────────────────────────────────── */
  /*  WORD EXPORT                                                */
  /* ─────────────────────────────────────────────────────────── */
  const handleWordExport = async () => {
    setWordLoading(true);
    try {
      const FONT = 'Calibri';
      const ACCENT = '1B3A6B';
      const ACCENT2 = '2563EB';
      const HEADER_BG = '1B3A6B';
      const LABEL_BG = 'EFF6FF';
      const TABLE_HEADER_BG = '1B3A6B';

      const noBorder = {
        top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      };

      const thinBorder = {
        top:    { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        left:   { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        right:  { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      };

      const emptyLine = (before = 0, after = 0) =>
        new Paragraph({ spacing: { before, after }, children: [] });

      const sectionHeader = (text: string, before = 280) =>
        new Paragraph({
          spacing: { before, after: 120 },
          shading: { type: ShadingType.SOLID, color: HEADER_BG },
          border: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: ACCENT },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT },
            left:   { style: BorderStyle.THICK,  size: 24, color: ACCENT2 },
            right:  { style: BorderStyle.SINGLE, size: 4, color: ACCENT },
          },
          indent: { left: 160, right: 160 },
          children: [
            new TextRun({ text: '  ' + text, bold: true, size: 22, font: FONT, color: 'FFFFFF', allCaps: true }),
          ],
        });

      /* ── HEADER TABLOSU ── */
      const titleCell = new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.SOLID, color: HEADER_BG },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        borders: noBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({ text: 'ACİL DURUM EKİPLERİ', bold: true, size: 28, font: FONT, color: 'FFFFFF', allCaps: true }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'ATAMA FORMU', bold: true, size: 24, font: FONT, color: 'BFD7FF' }),
            ],
          }),
        ],
      });

      const noCell = new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        width: { size: 2600, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: '1E3A5F' },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        borders: noBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [new TextRun({ text: 'Doküman No:', size: 16, font: FONT, color: '93C5FD' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [new TextRun({ text: 'İSG-FR-06', bold: true, size: 20, font: FONT, color: 'FFFFFF' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({ text: 'Yayın Tarihi: 01.02.2018', size: 16, font: FONT, color: '93C5FD' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Tarih: ${today}`, size: 16, font: FONT, color: 'BFD7FF' })],
          }),
        ],
      });

      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:     { style: BorderStyle.THICK, size: 24, color: ACCENT2 },
          bottom:  { style: BorderStyle.THICK, size: 24, color: ACCENT2 },
          left:    { style: BorderStyle.NONE,  size: 0,  color: 'FFFFFF' },
          right:   { style: BorderStyle.NONE,  size: 0,  color: 'FFFFFF' },
          insideH: { style: BorderStyle.NONE,  size: 0,  color: 'FFFFFF' },
          insideV: { style: BorderStyle.NONE,  size: 0,  color: 'FFFFFF' },
        },
        rows: [
          new TableRow({
            height: { value: 900, rule: HeightRule.ATLEAST },
            children: [titleCell, noCell],
          }),
        ],
      });

      /* ── FİRMA BİLGİSİ TABLOSU ── */
      const firmaTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:     { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          bottom:  { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          left:    { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          right:   { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideH: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideV: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'Firma / İşyeri Adı', bold: true, size: 20, font: FONT, color: '374151' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: firmaAdi, size: 20, font: FONT, color: '1F2937' })] })],
              }),
            ],
          }),
        ],
      });

      /* ── YASAL METİN PARAGRAFLARI ── */
      const yasalMetinParagraflari: Paragraph[] = [
        // Firma adı + tarafından satırı
        new Paragraph({
          spacing: { before: 200, after: 80 },
          border: { left: { style: BorderStyle.THICK, size: 16, color: ACCENT2 } },
          indent: { left: 200 },
          children: [
            new TextRun({ text: firmaAdi, bold: true, size: 20, font: FONT, color: ACCENT }),
            new TextRun({ text: ' tarafından;', size: 20, font: FONT, color: '374151' }),
          ],
        }),
        // Madde başlığı
        new Paragraph({
          spacing: { before: 120, after: 80 },
          indent: { left: 200 },
          children: [
            new TextRun({ text: 'Madde-11 Acil durum ekipleri ve goreleri', bold: true, size: 20, font: FONT, color: ACCENT }),
          ],
        }),
        // (1)
        new Paragraph({
          spacing: { before: 80, after: 60 },
          indent: { left: 200 },
          children: [
            new TextRun({ text: '(1) İşveren; işyerlerinde aşağıda yer alan acil durum ekiplerini oluşturur:', size: 19, font: FONT, color: '374151' }),
          ],
        }),
        new Paragraph({ spacing: { before: 40, after: 20 }, indent: { left: 400 }, children: [new TextRun({ text: 'a) Söndürme ekibi,', size: 19, font: FONT, color: '374151' })] }),
        new Paragraph({ spacing: { before: 20, after: 20 }, indent: { left: 400 }, children: [new TextRun({ text: 'b) Kurtarma ekibi,', size: 19, font: FONT, color: '374151' })] }),
        new Paragraph({ spacing: { before: 20, after: 20 }, indent: { left: 400 }, children: [new TextRun({ text: 'c) Koruma ekibi,', size: 19, font: FONT, color: '374151' })] }),
        new Paragraph({ spacing: { before: 20, after: 60 }, indent: { left: 400 }, children: [new TextRun({ text: '\u00e7) İlkyardım ekibi.', size: 19, font: FONT, color: '374151' })] }),
        // (2)
        new Paragraph({
          spacing: { before: 80, after: 60 },
          indent: { left: 200 },
          children: [
            new TextRun({ text: '(2) Birinci fıkrada yer alan ekiplerin goreleri aşağıda belirtilmiştir:', size: 19, font: FONT, color: '374151' }),
          ],
        }),
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { left: 400 },
          children: [new TextRun({ text: 'a) Söndürme ekibi; işyerinde çıkabilecek yangınlara derhal müdahale ederek mümkünse yangını kontrol altına almak, yangının genişlemesini önlemek ve söndürme faaliyetlerini yürütmek,', size: 19, font: FONT, color: '374151' })],
        }),
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { left: 400 },
          children: [new TextRun({ text: 'b) Kurtarma ekibi; işyerinde acil durum sonrası, çalışanları, ziyaretçileri ve diğer kişileri arama ve kurtarma işlerini gerçekleştirmek,', size: 19, font: FONT, color: '374151' })],
        }),
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { left: 400 },
          children: [new TextRun({ text: 'c) Koruma ekibi; acil durum nedeniyle ortaya çıkması muhtemel panik ve kargaşayı önlemek, acil durum ekipleri arasındaki koordinasyonu sağlamak ve işyerinde güvenliğin sağlanmasına katkıda bulunmak,', size: 19, font: FONT, color: '374151' })],
        }),
        new Paragraph({
          spacing: { before: 40, after: 60 },
          indent: { left: 400 },
          children: [new TextRun({ text: '\u00e7) İlkyardım ekibi; acil durum sonrası yaralanan kişilere ilk müdahaleyi yapmak, sağlık kuruluşlarına sevk edilmesini sağlamak.', size: 19, font: FONT, color: '374151' })],
        }),
        // (3)
        new Paragraph({
          spacing: { before: 80, after: 60 },
          indent: { left: 200 },
          children: [
            new TextRun({ text: '(3) İşyerinde birinci fıkrada belirtilen ekipler, işyerinin büyüklüğü, tehlike sınıfı ve çalışan sayısına göre aşağıdaki şekilde oluşturulur:', size: 19, font: FONT, color: '374151' }),
          ],
        }),
        new Paragraph({ spacing: { before: 40, after: 20 }, indent: { left: 400 }, children: [new TextRun({ text: 'a) Az tehlikeli sınıfta yer alan işyerlerinde her 50 çalışana kadar,', size: 19, font: FONT, color: '374151' })] }),
        new Paragraph({ spacing: { before: 20, after: 20 }, indent: { left: 400 }, children: [new TextRun({ text: 'b) Tehlikeli sınıfta yer alan işyerlerinde her 40 çalışana kadar,', size: 19, font: FONT, color: '374151' })] }),
        new Paragraph({ spacing: { before: 20, after: 40 }, indent: { left: 400 }, children: [new TextRun({ text: 'c) Çok tehlikeli sınıfta yer alan işyerlerinde her 30 çalışana kadar,', size: 19, font: FONT, color: '374151' })] }),
        new Paragraph({
          spacing: { before: 20, after: 60 },
          indent: { left: 200 },
          children: [new TextRun({ text: 'uygun donanıma sahip ve özel eğitim almış en az bir çalışan destek elemanı olarak görevlendirilir.', size: 19, font: FONT, color: '374151' })],
        }),
        // (4)
        new Paragraph({
          spacing: { before: 80, after: 60 },
          indent: { left: 200 },
          children: [
            new TextRun({ text: '(4) İşyerlerinde, işveren tarafından, çalışanlar arasından seçilecek yeterli sayıda destek elemanı görevlendirilir. Görevlendirilen destek elemanları; işyerinin tehlike sınıfına göre yukarıda belirtilen sayılarda olur.', size: 19, font: FONT, color: '374151' }),
          ],
        }),
        // (5)
        new Paragraph({
          spacing: { before: 80, after: 160 },
          indent: { left: 200 },
          children: [
            new TextRun({ text: '(5) İlkyardım, iş sağlığı ve güvenliği ile ilgili mevzuata uygun olarak, gerekli eğitimleri almış kişiler tarafından yürütülür.', size: 19, font: FONT, color: '374151' }),
          ],
        }),
      ];

      /* ── EKİP TABLOLARI ── */
      const ekipSiralari: EkipTuru[] = ['kurtarma', 'tahliye', 'sondurme', 'ilkYardim'];

      const buildEkipTable = (ekipKey: EkipTuru) => {
        const ekip = ekipler[ekipKey];

        // Tablo başlık satırı
        const headerRow = new TableRow({
          height: { value: 400, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              columnSpan: 4,
              verticalAlign: VerticalAlign.CENTER,
              shading: { type: ShadingType.SOLID, color: TABLE_HEADER_BG },
              borders: thinBorder,
              margins: { top: 80, bottom: 80, left: 160, right: 160 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: ekip.label.toUpperCase(), bold: true, size: 22, font: FONT, color: 'FFFFFF', allCaps: true }),
                  ],
                }),
              ],
            }),
          ],
        });

        // Sütun başlıkları
        const colHeader = (text: string, width: number) =>
          new TableCell({
            width: { size: width, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.SOLID, color: 'E8EEF7' },
            borders: thinBorder,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text, bold: true, size: 18, font: FONT, color: '374151' })],
              }),
            ],
          });

        const colHeaderRow = new TableRow({
          children: [
            colHeader('Sıra No', 10),
            colHeader('Adı Soyadı', 35),
            colHeader('T.C. Kimlik No', 30),
            colHeader('Telefon No', 25),
          ],
        });

        // Personel satırları
        const personelRows = ekip.personeller.map((p, idx) =>
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(idx + 1), size: 18, font: FONT, color: '374151' })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 35, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: p.adSoyad, size: 18, font: FONT, color: '1F2937' })] })],
              }),
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: p.tc || '', size: 18, font: FONT, color: '374151' })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: p.telefon || '', size: 18, font: FONT, color: '374151' })],
                  }),
                ],
              }),
            ],
          })
        );

        // Boş satır ekle (en az 3 satır görünsün)
        const minRows = 3;
        const emptyRows = Array.from({ length: Math.max(0, minRows - ekip.personeller.length) }, (_, idx) =>
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(ekip.personeller.length + idx + 1), size: 18, font: FONT, color: 'D1D5DB' })],
                  }),
                ],
              }),
              new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [] })] }),
              new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [] })] }),
              new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [] })] }),
            ],
          })
        );

        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top:     { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            bottom:  { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            left:    { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            right:   { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            insideH: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
            insideV: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          },
          rows: [headerRow, colHeaderRow, ...personelRows, ...emptyRows],
        });
      };

      /* ── FOOTER ── */
      const footerParagraph = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 320, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } },
        children: [
          new TextRun({ text: 'Bu belge ', size: 16, font: FONT, color: '9CA3AF' }),
          new TextRun({ text: 'isgdenetim.com.tr', size: 16, font: FONT, color: ACCENT2, bold: true }),
          new TextRun({ text: ' tarafından oluşturulmuştur.', size: 16, font: FONT, color: '9CA3AF' }),
          new TextRun({ text: `   ·   İSG-FR-06   ·   ${today}`, size: 16, font: FONT, color: '9CA3AF' }),
        ],
      });

      /* ── DOKÜMAN ── */
      const children: (Paragraph | Table)[] = [
        headerTable,
        emptyLine(200, 0),
        sectionHeader('FİRMA BİLGİLERİ', 0),
        emptyLine(120, 0),
        firmaTable,
        ...yasalMetinParagraflari,
      ];

      ekipSiralari.forEach((key, idx) => {
        children.push(sectionHeader(ekipler[key].label.toUpperCase(), idx === 0 ? 0 : 280));
        children.push(emptyLine(120, 0));
        children.push(buildEkipTable(key));
        children.push(emptyLine(160, 0));
      });

      children.push(footerParagraph);

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
          },
          children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Acil_Durum_Ekipleri_${firmaAdi || 'Belge'}.docx`);
    } catch (e) {
      console.error('Word export error:', e);
    } finally {
      setWordLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────── */
  /*  RENDER                                                     */
  /* ─────────────────────────────────────────────────────────── */
  const seciliEkipInfo = EKIP_TURLERI[seciliEkip];

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: '680px', maxHeight: '92vh', background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)' }}>
              <i className="ri-team-line text-sm" style={{ color: '#D97706' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Acil Durum Ekipleri Atama Formu</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Resmi Atama Formu — Word Belgesi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)' }}
          >
            <i className="ri-close-line text-sm" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Firma Adı */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Firma / İşyeri Adı *</label>
            <input
              value={firmaAdi}
              onChange={e => setFirmaAdi(e.target.value)}
              placeholder="Firma adını girin"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Personel Ekleme Formu */}
          <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Personel Ekle</p>

            {/* Ekip Seçimi */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Ekip Seçin</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(EKIP_TURLERI) as [EkipTuru, typeof EKIP_TURLERI[EkipTuru]][]).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setSeciliEkip(key)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all text-left"
                    style={{
                      background: seciliEkip === key ? `${info.color}15` : 'var(--bg-card)',
                      border: `1px solid ${seciliEkip === key ? info.color + '50' : 'var(--border-main)'}`,
                      color: seciliEkip === key ? info.color : 'var(--text-muted)',
                    }}
                  >
                    <i className={`${info.icon} text-sm`} />
                    {info.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Personel Bilgileri */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Adı Soyadı *</label>
                <input
                  value={yeniAd}
                  onChange={e => setYeniAd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePersonelEkle()}
                  placeholder="Ad Soyad"
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>T.C. Kimlik No</label>
                <input
                  value={yeniTc}
                  onChange={e => setYeniTc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePersonelEkle()}
                  placeholder="12345678901"
                  maxLength={11}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Telefon No</label>
                <input
                  value={yeniTelefon}
                  onChange={e => setYeniTelefon(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePersonelEkle()}
                  placeholder="05XX XXX XX XX"
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs" style={{ color: '#DC2626' }}>{formError}</p>
            )}

            <button
              onClick={handlePersonelEkle}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
              style={{ background: seciliEkipInfo.color, color: '#fff' }}
            >
              <i className="ri-user-add-line" />
              {seciliEkipInfo.label}&apos;ne Ekle
            </button>
          </div>

          {/* Ekip Listeleri */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Eklenen Personeller {toplamPersonel > 0 && <span style={{ color: 'var(--text-primary)' }}>({toplamPersonel} kişi)</span>}
            </p>

            {(Object.entries(ekipler) as [EkipTuru, EkipData][]).map(([key, ekip]) => (
              <div key={key} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                {/* Ekip Başlık */}
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: `${ekip.color}12`, borderBottom: ekip.personeller.length > 0 ? '1px solid var(--border-main)' : 'none' }}
                >
                  <div className="flex items-center gap-2">
                    <i className={`${ekip.icon} text-sm`} style={{ color: ekip.color }} />
                    <span className="text-xs font-semibold" style={{ color: ekip.color }}>{ekip.label}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${ekip.color}20`, color: ekip.color }}
                  >
                    {ekip.personeller.length} kişi
                  </span>
                </div>

                {/* Personel Listesi */}
                {ekip.personeller.length > 0 ? (
                  <div>
                    {/* Tablo Başlık */}
                    <div className="grid grid-cols-12 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--bg-app)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-main)' }}>
                      <div className="col-span-1">#</div>
                      <div className="col-span-4">Adı Soyadı</div>
                      <div className="col-span-4">T.C. Kimlik No</div>
                      <div className="col-span-2">Telefon</div>
                      <div className="col-span-1"></div>
                    </div>
                    {ekip.personeller.map((p, idx) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-12 px-4 py-2 items-center text-xs"
                        style={{ borderBottom: idx < ekip.personeller.length - 1 ? '1px solid var(--border-main)' : 'none', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-app)' }}
                      >
                        <div className="col-span-1 font-semibold" style={{ color: ekip.color }}>{idx + 1}</div>
                        <div className="col-span-4 font-medium" style={{ color: 'var(--text-primary)' }}>{p.adSoyad}</div>
                        <div className="col-span-4" style={{ color: 'var(--text-muted)' }}>{p.tc || '—'}</div>
                        <div className="col-span-2" style={{ color: 'var(--text-muted)' }}>{p.telefon || '—'}</div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => handlePersonelSil(key, p.id)}
                            className="w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-all"
                            style={{ color: '#DC2626' }}
                          >
                            <i className="ri-close-line text-xs" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Henüz personel eklenmedi
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Belge Notu */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(27,58,107,0.05)', border: '1px solid rgba(27,58,107,0.15)' }}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(27,58,107,0.1)' }}>
                <i className="ri-file-word-line text-sm" style={{ color: '#1B3A6B' }} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: '#1B3A6B' }}>Oluşturulacak Belge</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  İSG-FR-06 numaralı resmi atama formu; firma bilgileri ve 4 ekip (Kurtarma, Tahliye, Söndürme, İlk Yardım) personel listeleriyle Word formatında oluşturulacaktır.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border-main)', background: 'var(--bg-app)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}
          >
            İptal
          </button>
          <div className="flex items-center gap-3">
            {toplamPersonel > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {toplamPersonel} personel eklendi
              </span>
            )}
            <button
              onClick={handleWordExport}
              disabled={!isValid || wordLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              style={{
                background: !isValid || wordLoading ? 'rgba(27,58,107,0.4)' : '#1B3A6B',
                color: '#fff',
                opacity: !isValid || wordLoading ? 0.6 : 1,
              }}
            >
              {wordLoading
                ? <><i className="ri-loader-4-line animate-spin" /> Oluşturuluyor...</>
                : <><i className="ri-file-word-line" /> Word Olarak İndir</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
