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

export default function KoordinatorAtamasiModal({ onClose }: Props) {
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const [projeAdi, setProjeAdi] = useState('');
  const [projeAdresi, setProjeAdresi] = useState('');
  const [sgkSicilNo, setSgkSicilNo] = useState('');
  const [isverenAdi, setIsverenAdi] = useState('');
  const [isverenFirmaAdi, setIsverenFirmaAdi] = useState('');
  const [koordinatorAdi, setKoordinatorAdi] = useState('');
  const [koordinatorTc, setKoordinatorTc] = useState('');
  const [koordinatorFirma, setKoordinatorFirma] = useState('');
  const [wordLoading, setWordLoading] = useState(false);

  const isValid = projeAdi.trim() && projeAdresi.trim() && isverenAdi.trim() && koordinatorAdi.trim();

  /* ─────────────────────────────────────────────────────────── */
  /*  WORD EXPORT                                                */
  /* ─────────────────────────────────────────────────────────── */
  const handleWordExport = async () => {
    setWordLoading(true);
    try {
      const FONT = 'Calibri';
      const ACCENT = '1B3A6B';   // koyu lacivert
      const ACCENT2 = '2563EB';  // mavi
      const HEADER_BG = '1B3A6B';
      const LABEL_BG = 'EFF6FF';

      /* ── Yardımcılar ── */
      const emptyLine = (before = 0, after = 0) =>
        new Paragraph({ spacing: { before, after }, children: [] });

      const sectionHeader = (text: string, before = 280) =>
        new Paragraph({
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

      const noBorder = {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      };

      const thinBorder = {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      };

      /* Bilgi satırı hücresi */
      const labelCell = (text: string) =>
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.SOLID, color: LABEL_BG },
          borders: thinBorder,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text, bold: true, size: 20, font: FONT, color: '374151' }),
              ],
            }),
          ],
        });

      const valueCell = (text: string, colSpan = 1) =>
        new TableCell({
          columnSpan: colSpan,
          verticalAlign: VerticalAlign.CENTER,
          borders: thinBorder,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: text || '', size: 20, font: FONT, color: '1F2937' }),
              ],
            }),
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
              new TextRun({
                text: 'SAĞLIK VE GÜVENLİK KOORDİNATÖRÜ',
                bold: true, size: 28, font: FONT, color: 'FFFFFF', allCaps: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'ATAMA FORMU',
                bold: true, size: 24, font: FONT, color: 'BFD7FF',
              }),
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
            children: [
              new TextRun({ text: 'Doküman No:', size: 16, font: FONT, color: '93C5FD' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({ text: 'İSG-DENETİM10', bold: true, size: 20, font: FONT, color: 'FFFFFF' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({ text: 'Yayın Tarihi: 01.02.2018', size: 16, font: FONT, color: '93C5FD' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Tarih: ${today}`, size: 16, font: FONT, color: 'BFD7FF' }),
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
            children: [titleCell, noCell],
          }),
        ],
      });

      /* ── PROJE BİLGİLERİ TABLOSU ── */
      const projeTable = new Table({
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
          new TableRow({ children: [labelCell('Projenin Adı'), valueCell(projeAdi)] }),
          new TableRow({ children: [labelCell('Projenin Adresi'), valueCell(projeAdresi)] }),
          new TableRow({ children: [labelCell('Projenin SGK Sicil Numarası'), valueCell(sgkSicilNo)] }),
          new TableRow({ children: [labelCell('İşveren / Vekilinin Adı Soyadı'), valueCell(isverenAdi)] }),
        ],
      });

      /* ── AÇIKLAMA PARAGRAFİ ── */
      const aciklamaParagraf = new Paragraph({
        spacing: { before: 240, after: 240 },
        border: {
          left: { style: BorderStyle.THICK, size: 16, color: ACCENT2 },
        },
        indent: { left: 200 },
        children: [
          new TextRun({
            text: '"Yapı İşlerinde Sağlık ve Güvenlik Yönetmeliği\'nin 5. Maddesi" uyarınca yukarıda belirtilen bilgileri verilen projede aşağıda kimlik bilgileri verilen kişi projenin uygulanmasından sorumluluğu dahilindeki görevlerini yürütmek ve uygulamak amacı ile ',
            size: 20, font: FONT, color: '374151', italics: true,
          }),
          new TextRun({
            text: 'Sağlık ve Güvenlik Koordinatörü',
            size: 20, font: FONT, color: ACCENT, bold: true, italics: true,
          }),
          new TextRun({
            text: ' olarak atanmıştır.',
            size: 20, font: FONT, color: '374151', italics: true,
          }),
        ],
      });

      /* ── İŞVEREN İMZA TABLOSU ── */
      const isverenImzaTable = new Table({
        width: { size: 40, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.RIGHT,
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
            children: [
              new TableCell({
                borders: noBorder,
                margins: { top: 120, bottom: 120, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 80 },
                    children: [new TextRun({ text: today, size: 20, font: FONT, color: '374151' })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 400 },
                    children: [new TextRun({ text: 'İMZA', bold: true, size: 20, font: FONT, color: ACCENT })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    border: { top: { style: BorderStyle.SINGLE, size: 6, color: '9CA3AF' } },
                    children: [new TextRun({ text: isverenFirmaAdi || isverenAdi, size: 18, font: FONT, color: '6B7280' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      /* ── KOORDİNATÖR BİLGİLERİ TABLOSU ── */
      const koordinatorTable = new Table({
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
          new TableRow({ children: [labelCell('Adı Soyadı'), valueCell(koordinatorAdi)] }),
          new TableRow({ children: [labelCell('T.C. Kimlik Numarası'), valueCell(koordinatorTc)] }),
          new TableRow({ children: [labelCell('Firması'), valueCell(koordinatorFirma)] }),
        ],
      });

      /* ── KOORDİNATÖR İMZA TABLOSU ── */
      const koordinatorImzaTable = new Table({
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
            children: [
              /* Sol boş alan */
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [new Paragraph({ children: [] })],
              }),
              /* Sağ imza kutusu */
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                },
                margins: { top: 120, bottom: 120, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 60 },
                    children: [
                      new TextRun({ text: koordinatorAdi, bold: true, size: 22, font: FONT, color: ACCENT }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 80 },
                    children: [
                      new TextRun({ text: 'Sağlık ve Güvenlik Koordinatörü', size: 18, font: FONT, color: '6B7280', italics: true }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 400 },
                    children: [new TextRun({ text: 'İMZA', bold: true, size: 20, font: FONT, color: ACCENT })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    border: { top: { style: BorderStyle.SINGLE, size: 6, color: '9CA3AF' } },
                    children: [new TextRun({ text: today, size: 18, font: FONT, color: '6B7280' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      /* ── SON KABUL PARAGRAFİ ── */
      const sonParagraf = new Paragraph({
        spacing: { before: 280, after: 200 },
        border: {
          left: { style: BorderStyle.THICK, size: 16, color: ACCENT2 },
        },
        indent: { left: 200 },
        children: [
          new TextRun({
            text: 'Bilgileri verilen projede projenin hazırlık ve uygulama aşamalarında, sağlık ve güvenlikle ilgili görevleri yapmak amacıyla yapılan görevlendirmeyi kabul ediyorum.',
            size: 20, font: FONT, color: '374151', italics: true,
          }),
        ],
      });

      /* ── FOOTER ── */
      const footerParagraph = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 320, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } },
        children: [
          new TextRun({ text: 'Bu belge ', size: 16, font: FONT, color: '9CA3AF' }),
          new TextRun({ text: 'isgdenetim.com.tr', size: 16, font: FONT, color: ACCENT2, bold: true }),
          new TextRun({ text: ' tarafından oluşturulmuştur.', size: 16, font: FONT, color: '9CA3AF' }),
          new TextRun({ text: `   ·   İSG-DENETİM10   ·   ${today}`, size: 16, font: FONT, color: '9CA3AF' }),
        ],
      });

      /* ── DOKÜMAN ── */
      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
          },
          children: [
            /* 1. Header */
            headerTable,
            emptyLine(200, 0),

            /* 2. Proje Bilgileri */
            sectionHeader('ATAMA YAPILACAK FİRMA VE PROJE BİLGİLERİ', 0),
            emptyLine(120, 0),
            projeTable,
            emptyLine(200, 0),

            /* 3. Açıklama */
            aciklamaParagraf,

            /* 4. İşveren imzası */
            isverenImzaTable,
            emptyLine(200, 0),

            /* 5. Koordinatör Bilgileri */
            sectionHeader('SAĞLIK VE GÜVENLİK KOORDİNATÖRÜNÜN', 0),
            emptyLine(120, 0),
            koordinatorTable,
            emptyLine(200, 0),

            /* 6. Koordinatör imzası */
            koordinatorImzaTable,
            emptyLine(160, 0),

            /* 7. Son kabul metni */
            sonParagraf,

            /* 8. Footer */
            footerParagraph,
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `SGP_Koordinator_Atamasi_${koordinatorAdi || 'Belge'}.docx`);
    } catch (e) {
      console.error('Word export error:', e);
    } finally {
      setWordLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────── */
  /*  RENDER                                                     */
  /* ─────────────────────────────────────────────────────────── */
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: '560px', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <i className="ri-user-star-line text-sm" style={{ color: '#7C3AED' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>SGP Koordinatör Ataması</h2>
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

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Proje Bilgileri */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Proje Bilgileri</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Projenin Adı *</label>
                <input
                  value={projeAdi}
                  onChange={e => setProjeAdi(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Projenin Adresi *</label>
                <input
                  value={projeAdresi}
                  onChange={e => setProjeAdresi(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Projenin SGK Sicil Numarası</label>
                <input
                  value={sgkSicilNo}
                  onChange={e => setSgkSicilNo(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>İşveren / İşveren Vekili Adı Soyadı *</label>
                <input
                  value={isverenAdi}
                  onChange={e => setIsverenAdi(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  İşveren Firma Adı
                  <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>(İmza alanında görünür)</span>
                </label>
                <input
                  value={isverenFirmaAdi}
                  onChange={e => setIsverenFirmaAdi(e.target.value)}
                  placeholder="Firma adı girilmezse işveren adı kullanılır"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>

          {/* Koordinatör Bilgileri */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Sağlık ve Güvenlik Koordinatörü</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Adı Soyadı *</label>
                <input
                  value={koordinatorAdi}
                  onChange={e => setKoordinatorAdi(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>T.C. Kimlik Numarası</label>
                <input
                  value={koordinatorTc}
                  onChange={e => setKoordinatorTc(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Firması</label>
                <input
                  value={koordinatorFirma}
                  onChange={e => setKoordinatorFirma(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>

          {/* Belge önizleme notu */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(27,58,107,0.05)', border: '1px solid rgba(27,58,107,0.15)' }}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(27,58,107,0.1)' }}>
                <i className="ri-file-word-line text-sm" style={{ color: '#1B3A6B' }} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: '#1B3A6B' }}>Oluşturulacak Belge</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  İSG-DENETİM10 numaralı resmi atama formu; proje bilgileri, yasal atama metni, koordinatör bilgileri ve imza alanlarıyla Word formatında oluşturulacaktır.
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
    </div>,
    document.body
  );
}
