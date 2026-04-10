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

export default function SaglikGuvenlikPlaniModal({ onClose }: Props) {
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const [firmaAdi, setFirmaAdi] = useState('');
  const [projeAdi, setProjeAdi] = useState('');
  const [projeAdresi, setProjeAdresi] = useState('');
  const [isverenAdi, setIsverenAdi] = useState('');
  const [isgUzmani, setIsgUzmani] = useState('');
  const [isyeriHekimi, setIsyeriHekimi] = useState('');
  const [koordinator, setKoordinator] = useState('');
  const [wordLoading, setWordLoading] = useState(false);

  const isFormValid = firmaAdi.trim().length > 0;

  const handleWordExport = async () => {
    if (!isFormValid) return;
    setWordLoading(true);
    try {
      const FONT = 'Calibri';
      const ACCENT = '1B3A6B';
      const ACCENT2 = '2563EB';
      const HEADER_BG = '1B3A6B';
      const LABEL_BG = 'EFF6FF';

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

      const subHeader = (text: string) =>
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text, bold: true, size: 21, font: FONT, color: ACCENT })],
        });

      const bodyText = (text: string, indent = 0) =>
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: indent },
          children: [new TextRun({ text, size: 19, font: FONT, color: '374151' })],
        });

      const bulletItem = (text: string, indent = 200) =>
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: indent },
          bullet: { level: 0 },
          children: [new TextRun({ text, size: 19, font: FONT, color: '374151' })],
        });

      const boldBullet = (text: string) =>
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 200 },
          bullet: { level: 0 },
          children: [new TextRun({ text, bold: true, size: 19, font: FONT, color: '374151' })],
        });

      const labelCell = (text: string, width = 35) =>
        new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.SOLID, color: LABEL_BG },
          borders: thinBorder,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: FONT, color: '374151' })] })],
        });

      const valueCell = (text: string) =>
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          borders: thinBorder,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: text || '', size: 20, font: FONT, color: '1F2937' })] })],
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
            children: [new TextRun({ text: 'SAĞLIK VE GÜVENLİK PLANI', bold: true, size: 28, font: FONT, color: 'FFFFFF', allCaps: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği Kapsamında', bold: false, size: 18, font: FONT, color: 'BFD7FF' })],
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
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 }, children: [new TextRun({ text: 'Doküman No:', size: 16, font: FONT, color: '93C5FD' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 }, children: [new TextRun({ text: 'İSG-SGP-01', bold: true, size: 20, font: FONT, color: 'FFFFFF' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: 'Yayın Tarihi: 01.01.2024', size: 16, font: FONT, color: '93C5FD' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tarih: ${today}`, size: 16, font: FONT, color: 'BFD7FF' })] }),
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

      /* ── FİRMA BİLGİLERİ TABLOSU ── */
      const bilgiRows = [
        ['Firma / İşyeri Adı', firmaAdi],
        ['Proje Adı', projeAdi],
        ['Proje Adresi', projeAdresi],
        ['İşveren / Proje Sorumlusu', isverenAdi],
        ['İş Güvenliği Uzmanı', isgUzmani],
        ['İşyeri Hekimi', isyeriHekimi],
        ['Sağlık ve Güvenlik Koordinatörü', koordinator],
        ['Düzenlenme Tarihi', today],
      ].filter(([, v]) => v);

      const bilgiTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:     { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          bottom:  { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          left:    { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          right:   { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideH: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideV: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        },
        rows: bilgiRows.map(([label, value]) =>
          new TableRow({ children: [labelCell(label), valueCell(value)] })
        ),
      });

      /* ── İÇİNDEKİLER TABLOSU ── */
      const tocRows = [
        ['1', 'GENEL ESASLAR', '1.1 Amaç, 1.2 Kapsam, 1.3 Tanımlar'],
        ['2', 'SAĞLIK VE GÜVENLİK ORGANİZASYONU', 'Organizasyon yapısı ve sorumluluklar'],
        ['3', 'RİSK ANALİZİ UYGULAMA YÖNTEMLERİ', 'Risk değerlendirme yöntemi'],
        ['4', 'EĞİTİM VE ÇALIŞANLARIN BİLGİLENDİRİLMESİ', 'Eğitim konuları ve programı'],
        ['5', 'SAĞLIK VE İLKYARDIM', '5.1 Genel İlkyardım Bilgileri'],
        ['6', 'ACİL DURUMLAR', '6.1 Ekipler, 6.2 Planlar, 6.3 Eğitim'],
        ['7', 'ÖDÜL VE CEZA UYGULAMALARI', '7.1 Ödül Uygulaması'],
        ['8', 'İŞ KAZASI VE RAMAK KALA (NEARMISS)', 'Raporlama sistemi'],
        ['9', 'İLETİŞİM', 'İletişim yöntemleri'],
        ['10', 'ZİYARETÇİLER', 'Ziyaretçi kuralları'],
        ['11', 'İZLEME, ÖLÇME VE KONTROL PLANI', '11.1 Periyodik Kontroller, 11.2 Teknik Ölçümler'],
        ['12', 'KİŞİSEL KORUYUCU DONANIMLAR', '12.1 KKD Standartları'],
        ['13', 'SAĞLIK VE GÜVENLİK İŞARETLERİ', '13.1-13.5 İşaret türleri'],
        ['14', 'KONTROL FORMLARI VE ÇALIŞMA İZİNLERİ', 'İş izinleri ve kontrol formları'],
        ['15', 'PROJE KAPSAMINDA ALINACAK ÖNLEMLER', '15.1-15.13 Detaylı önlemler'],
      ];

      const tocTable = new Table({
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
              new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: HEADER_BG }, borders: thinBorder, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'No', bold: true, size: 18, font: FONT, color: 'FFFFFF' })] })] }),
              new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: HEADER_BG }, borders: thinBorder, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Bölüm Adı', bold: true, size: 18, font: FONT, color: 'FFFFFF' })] })] }),
              new TableCell({ shading: { type: ShadingType.SOLID, color: HEADER_BG }, borders: thinBorder, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'İçerik', bold: true, size: 18, font: FONT, color: 'FFFFFF' })] })] }),
            ],
          }),
          ...tocRows.map(([no, baslik, icerik]) =>
            new TableRow({
              children: [
                new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, borders: thinBorder, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: no, bold: true, size: 18, font: FONT, color: ACCENT })] })] }),
                new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: thinBorder, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: baslik, bold: true, size: 18, font: FONT, color: '1F2937' })] })] }),
                new TableCell({ borders: thinBorder, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: icerik, size: 18, font: FONT, color: '6B7280' })] })] }),
              ],
            })
          ),
        ],
      });

      /* ── EĞİTİM KONULARI TABLOSU ── */
      const egitimKonulari = [
        ['GENEL KONULAR', ''],
        ['1', 'Çalışma mevzuatı ile ilgili bilgiler'],
        ['2', 'Çalışanların yasal hak ve sorumlulukları'],
        ['3', 'İşyeri temizliği ve düzeni'],
        ['4', 'İş kazası ve meslek hastalığından doğan hukuki sonuçlar'],
        ['SAĞLIK KONULARI', ''],
        ['5', 'Meslek hastalıklarının sebepleri'],
        ['6', 'Hastalıktan korunma prensipleri ve korunma tekniklerinin uygulanması'],
        ['7', 'Biyolojik ve psikososyal risk etmenleri'],
        ['8', 'İlkyardım'],
        ['9', 'Tütün ürünlerinin zararları ve pasif etkilenim'],
        ['TEKNİK KONULAR', ''],
        ['10', 'Kimyasal, fiziksel ve ergonomik risk etmenleri'],
        ['11', 'Elle kaldırma ve taşıma'],
        ['12', 'Parlama, patlama, yangın ve yangından korunma'],
        ['13', 'İş ekipmanlarının güvenli kullanımı'],
        ['14', 'Ekranlı araçlarla çalışma'],
        ['15', 'Elektrik, tehlikeleri, riskleri ve önlemleri'],
        ['16', 'İş kazalarının sebepleri ve korunma prensipleri ile tekniklerinin uygulanması'],
        ['17', 'Güvenlik ve sağlık işaretleri'],
        ['18', 'Kişisel koruyucu donanım kullanımı'],
        ['19', 'İş sağlığı ve güvenliği genel kuralları ve güvenlik kültürü'],
        ['20', 'Tahliye ve kurtarma'],
        ['DİĞER EĞİTİMLER', ''],
        ['21', 'Hijyen eğitimi'],
        ['22', 'İlkyardım eğitimi'],
      ];

      const egitimTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:     { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          bottom:  { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          left:    { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          right:   { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideH: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideV: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        },
        rows: egitimKonulari.map(([no, konu]) => {
          const isHeader = konu === '';
          return new TableRow({
            children: [
              new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
                shading: isHeader ? { type: ShadingType.SOLID, color: '374151' } : { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: isHeader ? '' : no, bold: true, size: 18, font: FONT, color: isHeader ? 'FFFFFF' : ACCENT })] })],
              }),
              new TableCell({
                shading: isHeader ? { type: ShadingType.SOLID, color: '374151' } : undefined,
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: isHeader ? no : konu, bold: isHeader, size: 18, font: FONT, color: isHeader ? 'FFFFFF' : '1F2937' })] })],
              }),
            ],
          });
        }),
      });

      /* ── İZLEME VE ÖLÇME TABLOSU ── */
      const izlemeRows = [
        ['ÖLÇÜMLER', '', ''],
        ['1', 'Gürültü ölçümü', 'Yılda Bir'],
        ['2', 'İç Ortam Toz ölçümü', 'Yılda Bir'],
        ['3', 'İç Ortam gaz ölçümü', 'Yılda Bir'],
        ['4', 'Aydınlatma', 'Yılda Bir'],
        ['ÇEVRESEL ÖLÇÜMLER', '', ''],
        ['1', 'Emisyon ve İmisyon Ölçümleri', '-'],
        ['2', 'Çevresel Gürültü Ölçümleri', '-'],
        ['TEST, KONTROL VE TAHLİLLER', '', ''],
        ['1', 'Elektrik ile çalışan makinelerin topraklama kontrolü', 'Yılda Bir'],
        ['2', 'Elektrik ve Aydınlatma Tesisatı Yeterlilik Kontrolü', 'Yılda Bir'],
        ['3', 'Yangın Söndürme Cihazlarının Kontrolleri', 'Yılda Bir'],
        ['4', 'Yangın/Acil Durum Tatbikatı', 'Yılda Bir'],
        ['EĞİTİM, TOPLANTI, DENETİM VE DİĞER', '', ''],
        ['1', 'İSG Kurulu', 'Her Ay'],
        ['2', 'İSG Eğitimleri', 'Yılda 12 saat'],
        ['3', 'İlkyardım Eğitimleri', '3 yılda bir'],
        ['4', 'ÇSGB Denetimleri', '-'],
        ['5', 'İş Kazaları', '-'],
        ['SAĞLIK', '', ''],
        ['1', 'Akciğer Grafisi', 'Yılda Bir'],
        ['2', 'SFT (Solunum Fonksiyon Testi)', 'Yılda Bir'],
        ['3', 'Odyometre Testi', 'Yılda Bir'],
        ['4', 'Çalışabilir Raporu', 'Yılda Bir'],
        ['5', 'Tetanos', '5 yılda bir'],
        ['6', 'Hemogram', 'Yılda Bir'],
      ];

      const izlemeTable = new Table({
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
              new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: HEADER_BG }, borders: thinBorder, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Sıra', bold: true, size: 18, font: FONT, color: 'FFFFFF' })] })] }),
              new TableCell({ shading: { type: ShadingType.SOLID, color: HEADER_BG }, borders: thinBorder, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'FAALİYET', bold: true, size: 18, font: FONT, color: 'FFFFFF' })] })] }),
              new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: HEADER_BG }, borders: thinBorder, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'Periyot', bold: true, size: 18, font: FONT, color: 'FFFFFF' })] })] }),
            ],
          }),
          ...izlemeRows.map(([no, faaliyet, periyot]) => {
            const isHeader = periyot === '';
            return new TableRow({
              children: [
                new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: isHeader ? { type: ShadingType.SOLID, color: '374151' } : { type: ShadingType.SOLID, color: LABEL_BG }, borders: thinBorder, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: isHeader ? '' : no, bold: true, size: 18, font: FONT, color: isHeader ? 'FFFFFF' : ACCENT })] })] }),
                new TableCell({ shading: isHeader ? { type: ShadingType.SOLID, color: '374151' } : undefined, borders: thinBorder, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: isHeader ? no : faaliyet, bold: isHeader, size: 18, font: FONT, color: isHeader ? 'FFFFFF' : '1F2937' })] })] }),
                new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, shading: isHeader ? { type: ShadingType.SOLID, color: '374151' } : undefined, borders: thinBorder, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: isHeader ? '' : periyot, size: 18, font: FONT, color: '6B7280' })] })] }),
              ],
            });
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
          new TextRun({ text: `   ·   İSG-SGP-01   ·   ${today}`, size: 16, font: FONT, color: '9CA3AF' }),
        ],
      });

      /* ── TÜM DOKÜMAN İÇERİĞİ ── */
      const children: (Paragraph | Table)[] = [
        /* HEADER */
        headerTable,
        emptyLine(200, 0),

        /* FİRMA BİLGİLERİ */
        sectionHeader('FİRMA VE PROJE BİLGİLERİ', 0),
        emptyLine(120, 0),
        bilgiTable,
        emptyLine(200, 0),

        /* AÇIKLAMA */
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { left: { style: BorderStyle.THICK, size: 16, color: ACCENT2 } },
          indent: { left: 200 },
          children: [new TextRun({ text: 'AÇIKLAMA: Bu doküman "Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği" şartları göz önünde bulundurularak hazırlanmıştır.', size: 18, font: FONT, color: '374151', italics: true })],
        }),
        emptyLine(200, 0),

        /* İÇİNDEKİLER */
        sectionHeader('İÇİNDEKİLER', 0),
        emptyLine(120, 0),
        tocTable,
        emptyLine(280, 0),

        /* 1. GENEL ESASLAR */
        sectionHeader('1. GENEL ESASLAR', 0),
        emptyLine(120, 0),
        bodyText('Projenin uygulama safhasında yapı alanında yürütülecek olan faaliyetler dikkate alınmak suretiyle bir İSG Risk Değerlendirme Planı hazırlanmış ve bu plan çerçevesinde işyerinde yapılacak çalışmalar doğrultusunda uygulanacak kuralları belirleyen bir SAĞLIK VE GÜVENLİK PLANI hazırlanmıştır.'),
        emptyLine(80, 0),
        subHeader('1.1 Amaç'),
        bodyText('Bu plan, işyerlerinde sağlık ve güvenlik şartlarının iyileştirilmesi için alınacak önlemleri belirlemek amacıyla hazırlanmıştır:'),
        bulletItem('Uygulanmakta olan Projede Mesleki risklerin önlenmesi, sağlık ve güvenliğin korunması, risk ve kaza faktörlerinin ne şekilde ortadan kaldırılacağı,'),
        bulletItem('Projede görev alacak işçilerin ve temsilcilerinin İş sağlığı ve güvenliği konusunda ne şekilde eğitileceği, tehlikelere karşı nasıl bilgilendirileceği,'),
        bulletItem('Projede görev alacak kişiler arasından yaş, cinsiyet ve özel durumları sebebi ile özel olarak korunması gereken kişilerin çalışma şartları ile ilgili genel prensipler.'),
        emptyLine(80, 0),
        subHeader('1.2 Kapsam'),
        bodyText('Proje yürütümünde İş Sağlığı ve Güvenliği çalışmaları ulusal ve uluslararası İş Sağlığı ve Güvenliği Mevzuatları (kanun, yönetmelik, tebliğ, genelge, vb.) kapsamında yürütülecektir.'),
        emptyLine(80, 0),
        subHeader('1.3 Tanımlar'),
        bodyText('Yapı İşlerinde İş Sağlığı Ve Güvenliği Yönetmeliği — Yayımlandığı Resmi Gazete Tarihi/Sayısı: 05/10/2013-28786'),
        emptyLine(80, 0),
        bodyText('Proje: İşveren tarafından yürütülmekte olan projeye ilişkin yürütülen tüm işleri ifade eder.'),
        bodyText('Proje Sorumlusu: Projenin hazırlanmasından, uygulanmasından ve uygulamanın kontrolünden sorumlu olmak üzere görevlendirilmiş kişiyi ifade eder.'),
        bodyText('Alt işveren: Bir işverenden, işyerinde yürütülen mal veya hizmet üretimine ilişkin yardımcı işlerde veya asıl işin bir bölümünde işletmenin ve işin gereği ile teknolojik nedenlerle uzmanlık gerektiren işlerde iş alan gerçek veya tüzel kişiyi ifade eder.'),
        bodyText('Sağlık ve Güvenlik Koordinatörü: Projenin hazırlık ve uygulama aşamalarında, işveren veya proje sorumlusu tarafından sorumluluk verilen ve bu Yönetmeliğin 10uncu ve 11inci maddelerinde belirtilen sağlık ve güvenlikle ilgili görevleri yapan gerçek veya tüzel kişileri ifade eder.'),
        bodyText('Destek Elemanı: Asli görevinin yanında iş sağlığı ve güvenliği ile ilgili önleme, koruma, tahliye, yangınla mücadele, ilk yardım ve benzeri konularda özel olarak görevlendirilmiş uygun donanım ve yeterli eğitime sahip kişiyi ifade eder.'),
        bodyText('Yapı alanı: Yapı işlerinin yürütüldüğü alanı ifade eder.'),
        bodyText('Risk Değerlendirmesi: Hazırlık safhasında tasarlanmış tehlike ve riskler uygulama safhasında gözden geçirilerek sürekli revize edilir.'),
        emptyLine(280, 0),

        /* 2. SAĞLIK VE GÜVENLİK ORGANİZASYONU */
        sectionHeader('2. SAĞLIK VE GÜVENLİK ORGANİZASYONU'),
        emptyLine(120, 0),
        bodyText('Projede görev yapacak olan sağlık ve güvenlik ekibi aşağıdaki gibi oluşturulmalıdır.'),
        emptyLine(80, 0),
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: 'İŞ SAHİBİ: ', bold: true, size: 20, font: FONT, color: ACCENT }),
            new TextRun({ text: firmaAdi || '___________________', size: 20, font: FONT, color: '1F2937' }),
          ],
        }),
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: 'PROJE YÖNETİMİ: ', bold: true, size: 20, font: FONT, color: ACCENT }),
            new TextRun({ text: '--- tarafından görevlendirilerek sözleşmenin amaçları doğrultusunda, sözleşme kapsamındaki proje yönetimi işlerini yerine getiren firmayı ifade eder.', size: 20, font: FONT, color: '374151' }),
          ],
        }),
        emptyLine(80, 0),
        bodyText('Yapı İşlerinde İş Sağlığı Ve Güvenliği Yönetmeliği — Yayımlandığı Resmi Gazete Tarihi/Sayısı: 05/10/2013-28786'),
        emptyLine(80, 0),
        bodyText('MADDE 4 – (1) Sağlık ve güvenlik koordinatörü: Projenin hazırlık ve uygulama aşamalarında, işveren veya proje sorumlusu tarafından sorumluluk verilen ve Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliğin 10uncu ve 11inci maddelerinde belirtilen sağlık ve güvenlikle ilgili görevleri yapan gerçek veya tüzel kişileri ifade eder.'),
        emptyLine(80, 0),
        bodyText('İş Sağlığı ve Güvenliği Hizmetleri Yönetmeliği — Resmi Gazete Tarihi: 29.12.2012 Resmi Gazete Sayısı: 28512'),
        emptyLine(80, 0),
        bodyText('MADDE 5 – (1) İşveren, işyerlerinde alınması gereken iş sağlığı ve güvenliği tedbirlerinin belirlenmesi ve uygulanmasının izlenmesi, iş kazası ve meslek hastalıklarının önlenmesi, çalışanların ilk yardım ve acil tedavi ile koruyucu sağlık ve güvenlik hizmetlerinin yürütülmesi amacıyla; çalışanları arasından bu Yönetmelikte belirtilen nitelikleri haiz bir veya birden fazla işyeri hekimi, iş güvenliği uzmanı ve diğer sağlık personeli görevlendirir.'),
        emptyLine(80, 0),
        subHeader('İSG Kurulunda Görev Alacak Kişiler'),
        bulletItem('İşveren Vekili (Kurul Başkanı)'),
        bulletItem('İş Güvenliği Uzmanı (Sekreter) (Tam zamanlı)'),
        bulletItem('İşyeri Hekimi'),
        bulletItem('Personel Sorumlusu'),
        bulletItem('Çalışan Temsilcisi'),
        bulletItem('Foremen Temsilcisi'),
        bulletItem('Foremen Temsilcisi Yedeği'),
        bulletItem('Çalışan Temsilcisi Yedeği'),
        bulletItem('Taşeron Üye'),
        bulletItem('Sivil Savunma Uzmanı (Bulunması halinde)'),
        emptyLine(80, 0),
        bodyText('Not: Taşeron sayısı kadar Taşeron Üye ataması yapılması gerekmektedir.'),
        emptyLine(280, 0),

        /* 3. RİSK ANALİZİ */
        sectionHeader('3. RİSK ANALİZİ UYGULAMA YÖNTEMLERİ'),
        emptyLine(120, 0),
        bodyText('İş Sağlığı ve Güvenliği (İSG) Kanunu — Resmi Gazete Tarihi: 20.06.2012 Resmi Gazete Sayısı: 6331'),
        emptyLine(80, 0),
        bodyText('MADDE 4 – (1) İşveren, çalışanların işle ilgili sağlık ve güvenliğini sağlamakla yükümlü olup bu çerçevede; c) Risk değerlendirmesi yapar veya yaptırır.'),
        emptyLine(80, 0),
        bodyText('İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği\'ne (Resmi Gazete Tarihi: 29.12.2012 Resmi Gazete Sayısı: 28512) uygun olarak yapılmış olan şantiyenin risk değerlendirmesi ekte verilmiştir.'),
        emptyLine(280, 0),

        /* 4. EĞİTİM */
        sectionHeader('4. EĞİTİM VE ÇALIŞANLARIN BİLGİLENDİRİLMESİ'),
        emptyLine(120, 0),
        bodyText('Proje yürütümü boyunca çalışanlar aşağıda belirtilen şekilde eğitime tabi tutulacaktır:'),
        bulletItem('İşe giriş Oryantasyon ve Bilgilendirme eğitimleri'),
        new Paragraph({ spacing: { before: 60, after: 60 }, indent: { left: 200 }, children: [new TextRun({ text: 'İŞE GİRİŞ EĞİTİMİ OLMAYAN PERSONEL İŞE BAŞLAYAMAYACAKTIR.', bold: true, size: 19, font: FONT, color: 'DC2626' })] }),
        bulletItem('İşin yürütümünde: İş Başı Eğitimi, Planlı Eğitimler'),
        bulletItem('Uygulamalı ve teorik olarak yapılacaktır.'),
        bulletItem('Eğitime katılan personel kayıt altına alınacaktır.'),
        bulletItem('Verilen her eğitim sonunda eğitim etkinliği değerlendirilecektir ve katılımcılara eğitim katılım sertifikası verilecektir.'),
        bulletItem('Diğer taraftan eğitimin içeriği değişen ve yeni ortaya çıkan risklere uygun olarak yenilenecek ve gerektiğinde periyodik olarak tekrarlanacaktır.'),
        emptyLine(120, 0),
        subHeader('Eğitim Konuları'),
        egitimTable,
        emptyLine(280, 0),

        /* 5. SAĞLIK VE İLKYARDIM */
        sectionHeader('5. SAĞLIK VE İLKYARDIM'),
        emptyLine(120, 0),
        bodyText('Şantiye muayene ve sağlık odası hazırlanacaktır. Sağlık Bakanlığı tarafından yayınlanmış olan İlkyardım Yönetmeliği\'nde istenen araç ve gereçler temin edilecektir.'),
        bulletItem('İŞE GİRİŞ SAĞLIK RAPORU OLMAYAN PERSONEL İŞE BAŞLATILMAYACAKTIR.'),
        bulletItem('Çalışanın en az yılda bir kez sağlık raporunu yenileyecektir.'),
        bulletItem('Sağlık ile ilgili eğitim programları gerçekleştirilecektir.'),
        bulletItem('İlk yardım eğitimi ile ilgili uygulamalar yapılacaktır. Bu kapsamda İlk Yardım Yönetmeliğine göre her 10 çalışandan bir çalışan (1/1) İlk Yardımcı Sertifikası aldırılacaktır. (Çok tehlikeli sınıflarda)'),
        bulletItem('Acil Durum Tatbikatları gerçekleştirilecektir.'),
        emptyLine(80, 0),
        subHeader('5.1 Genel İlkyardım Bilgileri'),
        bodyText('Herhangi bir kaza veya yaşamı tehlikeye düşüren bir durumda, sağlık görevlilerinin yardımı sağlanıncaya kadar, hayatın kurtarılması ya da durumun kötüye gitmesini önleyebilmek amacı ile olay yerinde, tıbbi araç gereç ararmaksızın, mevcut araç ve gereçlerle yapılan ilaçsız uygulamalardır.'),
        emptyLine(80, 0),
        subHeader('İlkyardımın öncelikli amaçları:'),
        bulletItem('Hayati tehlikeyi ortadan kaldırmak'),
        bulletItem('Yaşamsal fonksiyonların sürdürülmesini sağlamak'),
        bulletItem('Hasta/yaralının durumunun kötüleşmesini önlemek'),
        bulletItem('İyileşmeyi kolaylaştırmak'),
        emptyLine(80, 0),
        subHeader('Bildirme:'),
        bodyText('Olay/kaza mümkün olduğu kadar hızlı bir şekilde telefon veya diğer kişiler aracılığı ile gerekli yardım kuruluşlarına bildirilmelidir. Türkiye\'de ilkyardım gerektiren her durumda telefon iletişimleri, 112 acil telefon numarası üzerinden gerçekleştirilir.'),
        emptyLine(80, 0),
        subHeader('112\'nin aranması sırasında dikkat edilmesi gerekenler:'),
        bulletItem('Sakin olunmalı ya da sakin olan bir kişinin araması sağlanmalıdır.'),
        bulletItem('112 merkezi tarafından sorulan sorulara net bir şekilde cevap verilmelidir.'),
        bulletItem('Kesin yer ve adres bilgileri verilirken, olayın olduğu yere yakın bir caddenin ya da çok bilinen bir yerin adı verilmelidir.'),
        bulletItem('Kimin, hangi numaradan aradığı bildirilmelidir.'),
        bulletItem('Hasta/yaralının adı ve olayın tanımı yapılmalıdır.'),
        bulletItem('Hasta/yaralı sayısı ve durumu bildirilmelidir.'),
        bulletItem('112 hattında bilgi alan kişi, gerekli olan tüm bilgileri aldığını söyleyinceye kadar telefon kapatılmamalıdır.'),
        emptyLine(80, 0),
        subHeader('Hayat kurtarma zinciri:'),
        bulletItem('1. Halka - Sağlık kuruluşuna haber verme'),
        bulletItem('2. Halka - Olay yerinde yapılan Temel Yaşam Desteği'),
        bulletItem('3. Halka - Ambulans ekiplerince yapılan müdahale'),
        bulletItem('4. Halka - Hastane acil servisleri'),
        emptyLine(280, 0),

        /* 6. ACİL DURUMLAR */
        sectionHeader('6. ACİL DURUMLAR'),
        emptyLine(120, 0),
        bodyText('Proje Uygulama safhasında yapılan işin yüksek riski ve işin özelliğini ile işyerinde bulunan çalışanların ve diğer kişilerin sayısı dikkate alınarak; iş kazası, deprem, yangın, sabotaj ve sızıntı/dökülme, doğal afet, vb. ile mücadele için gerekli tedbirler alınacaktır.'),
        emptyLine(80, 0),
        subHeader('6.1 Acil Durum Ekipleri'),
        bodyText('Yapı, bina, tesis ve işletmelerden; 10 bağımsız bölümü olan konutlar ile 50 kişiden fazla insan bulunan her türlü yapı, bina, tesis ve işletmelerde aşağıdaki ekipler oluşturulur (Binaların Yangında Korunması Hakkında Yönetmelik Madde 127):'),
        bulletItem('a) Söndürme ekibi'),
        bulletItem('b) Kurtarma ekibi'),
        bulletItem('c) Koruma ekibi'),
        bulletItem('d) İlk yardım ekibi'),
        emptyLine(80, 0),
        bodyText('Söndürme ve kurtarma ekipleri en az 3\'er, koruma ve ilk yardım ekipleri ise en az 2\'şer kişiden oluşur. Her ekipte bir ekip başı bulunur.'),
        emptyLine(80, 0),
        bodyText('İşyerlerinde Acil Durumlar Hakkında Yönetmelik (Resmi Gazete Tarihi/Sayısı: 18.06.2013/28681) — MADDE 11:'),
        bulletItem('Çok tehlikeli sınıfta yer alan işyerlerinde (inşaat işleri bu sınıfta yer almaktadır) 30 çalışana kadar; arama, kurtarma ve tahliye ile yangınla mücadele konularının her biri için uygun donanıma sahip ve özel eğitimli en az birer çalışan destek elemanı olarak görevlendirilir.'),
        bulletItem('İşyerinde bunları aşan sayılarda çalışanın bulunması halinde, her 30\'a kadar çalışan için birer destek elemanı daha görevlendirilir.'),
        emptyLine(80, 0),
        subHeader('6.2 Acil Durum Planları'),
        bodyText('Acil durumlarda personelin yapması gerekenler iş kazası, deprem, yangın ve sabotaj acil durum planlarında belirtilmiştir. Tüm çalışanlar bu planlara uymakla yükümlüdür.'),
        bulletItem('Yangın Acil Durum Eylem Planı'),
        bulletItem('İş Kazası Acil Durum Eylem Planı'),
        bulletItem('Deprem Acil Durum Eylem Planı'),
        bulletItem('Sızıntı Acil Durum Planı'),
        bulletItem('Sel Acil Durum Planı'),
        bulletItem('Sabotaj Acil Durum Eylem Planı'),
        emptyLine(80, 0),
        subHeader('6.3 Eğitim'),
        bodyText('Acil durum müdahale ekiplerine görevleri ile ilgili eğitim verdirilmelidir. Ayrıca hangi söndürme cihaz ve aletlerin, hangi tür yangına karşı kullanılması gerektiği öğretilmelidir. Acil Durum Ekibi yangın, yaralı kurtarma, sabotaj, vb. konularda en az yılda 1 tatbikat yaptırılarak bu eğitim pekiştirilmelidir.'),
        emptyLine(280, 0),

        /* 7. ÖDÜL VE CEZA */
        sectionHeader('7. ÖDÜL VE CEZA UYGULAMALARI'),
        emptyLine(120, 0),
        bodyText('Ceza Uygulamaları Listesinde belirtilmiş olan İSG tedbirlerine uyulmaması halinde Şantiye İş Güvenliği Ekibi tarafından yapılacak tespitler sonucunda uygunsuz çalışanlar ve alt işverenler çalışanları adına sözlü ve yazılı uyarılar yapılacaktır.'),
        emptyLine(80, 0),
        subHeader('7.1 Ödül Uygulaması'),
        bodyText('Ödül Uygulamasına tabi tutulacak personel ve alt işveren "AYIN İSG ELEMANI" ve "AYIN İSG ALT İŞVERENİ" şeklinde seçilecektir.'),
        emptyLine(80, 0),
        subHeader('AYIN İSG ELEMANI kriterleri:'),
        bulletItem('Aylık yapılan çalışmalarda sıfır uygunsuzluk ile İş Sağlığı ve Güvenliği Birimi tarafından sözlü uyarılara ve cezalara maruz kalmamak'),
        bulletItem('Başkalarının ve kendi güvenliğini tehlikeye atacak davranışlarda bulunmamak'),
        bulletItem('Sahada gerçekleşen İş güvenliği uygunsuz koşul ve davranışları İş sağlığı Güvenliği Birimine bildirmek'),
        bulletItem('Ramak Kala vakalarını İş güvenliği birimine bildirmek'),
        bulletItem('Kendisine teslim edilen kişisel koruyucu donanımlarını saha içerisinde eksiksiz ve sürekli kullanmak'),
        bulletItem('İş Güvenliği eğitimlerine eksiksiz katılmak'),
        emptyLine(80, 0),
        subHeader('AYIN İSG ALT İŞVERENİ kriterleri:'),
        bulletItem('Aylık yapılan çalışmalarda en az uygunsuzluk ile İş Güvenliği Birimi tarafından sözlü, yazılı uyarılara ve cezalara en az maruz kalan taşeron'),
        bulletItem('Aylık İş güvenliği Toplantılarına eksiksiz katılacak'),
        bulletItem('Çalışanlarına standartlara uygun kişisel koruyucuları eksiksiz temin etmek'),
        bulletItem('Sahadaki kendi İş Güvenliği çalışmalarını denetlemek ve kurul toplantılarına katılmak için İş Güvenliği Temsilcisini yazılı olarak İş güvenliği birimine atamak'),
        bulletItem('Risk Analizi çalışmaları kapsamında yapılacak çalışmalarda İş Güvenliği Birimine destek olmak'),
        emptyLine(280, 0),

        /* 8. İŞ KAZASI VE RAMAK KALA */
        sectionHeader('8. İŞ KAZASI VE RAMAK KALA (NEARMISS)'),
        emptyLine(120, 0),
        bodyText('İş kazası: İşyerinde veya işin yürütümü nedeniyle meydana gelen, ölüme sebebiyet veren veya vücut bütünlüğünü ruhen ya da bedenen özre uğratan olay. (6331 sayılı iş kanunu)'),
        emptyLine(80, 0),
        bodyText('Kaza ve Ramak Kala bildirimi sistemi, kaza ve ucuz atlatılan, kazaya kıl payı kalan olayların bildirildiği olası kazaların habercisi bir sistemdir. Yönetim sistemi içinde zayıf halkaların, sorunlu kısımların tespit edilmesini sağlayan önleyici bir sistemdir.'),
        emptyLine(80, 0),
        subHeader('Ramak Kala Örnekleri:'),
        bulletItem('Düşmek üzereydim ama düşmedim — bu durum benim için tehlike oluşturdu ve ileride düşmeye neden olabilir.'),
        bulletItem('Yangın çıkacaktı ama yangın olmadı ve ucuz atlattık — ileride yangın çıkabilir, bunun için ramak kala raporları ile önlem alınmalıdır.'),
        emptyLine(280, 0),

        /* 9. İLETİŞİM */
        sectionHeader('9. İLETİŞİM'),
        emptyLine(120, 0),
        bodyText('Proje yürütümünde iletişim telsiz ve cep telefonları ile sağlanacaktır. Acil durumlara ilişkin iletişim numaraları şantiyede tüm çalışanlara duyurulacaktır. Tehlikeli bölgelere ilişkin bilgilendirme işaretleme sistemi ile yapılacaktır.'),
        emptyLine(280, 0),

        /* 10. ZİYARETÇİLER */
        sectionHeader('10. ZİYARETÇİLER'),
        emptyLine(120, 0),
        bodyText('Proje yürütümü boyunca şantiyeye gelecek olan Ziyaretçiler ve üçüncü kişiler için "Ziyaretçi ve Üçüncü Kişiler İş Sağlığı ve Güvenliği Talimatı" tebliğ edilmesiyle birlikte uygun kişisel koruyucu donanım kendilerine giriş ve çıkışlarda bulunan güvenlik tarafından verilmesiyle şantiye içerisinde nezaret edilecektir.'),
        emptyLine(80, 0),
        subHeader('Ziyaretçi ve Üçüncü Kişiler:'),
        bulletItem('Şantiyeye girmeden önce Şantiye Genel İş Sağlığı ve Güvenliği kuralları hakkında bilgilendirilecektir.'),
        bulletItem('Şantiyede gidecekleri yere kadar nezaret edilecektir.'),
        bulletItem('Şantiyede Emniyetli yürüyüş yolunu kullanarak ulaşım sağlanacaktır.'),
        bulletItem('Şantiyede kullanılması gereken KKD\'ler kendilerine verilecektir.'),
        bulletItem('Acil durumlarda yapılması gerekenler kendilerine anlatılacaktır.'),
        emptyLine(280, 0),

        /* 11. İZLEME VE ÖLÇME */
        sectionHeader('11. KONTROL, İZLEME VE ÖLÇME PLANI'),
        emptyLine(120, 0),
        bodyText('İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği\'ne göre Şantiyede kullanılan makine, ekipmanlar ve saha ölçümleri için Periyodik Kontrol Gerektiren Ekipman Listesi ve Planı hazırlanmıştır.'),
        emptyLine(80, 0),
        subHeader('11.1 Kaldırma Makinelerinin (Periyodik Kontrolü) Muayene ve Testleri'),
        bulletItem('Araç Kaldırma Lifti Periyodik Kontrolleri'),
        emptyLine(80, 0),
        subHeader('11.2 Kontrol ve Denetim Amaçlı Teknik Ölçümler'),
        bulletItem('Kontrol ve iyileştirme amaçlı yakma tesisleri baca gazı/brülör ölçümleri'),
        bulletItem('Gürültü ve titreşim kirliliği ölçümleri'),
        bulletItem('Aydınlık (lux) ölçümleri'),
        bulletItem('Topraklama ölçümleri'),
        bulletItem('İşletme içi ortam toz ölçümleri'),
        emptyLine(120, 0),
        subHeader('İzleme ve Ölçme Tablosu'),
        izlemeTable,
        emptyLine(280, 0),

        /* 12. KKD */
        sectionHeader('12. KİŞİSEL KORUYUCU DONANIMLAR'),
        emptyLine(120, 0),
        bodyText('Kişisel Koruyucu Donanımlarla (KKD) ile ilgili hususlar, Kişisel Koruyucu Donanımların İşyerlerinde Kullanılması Hakkında Yönetmeliğe (Resmi Gazete tarihi/sayısı: 02.07.2013/28695) uygun olarak hazırlanmış talimatlara göre verilecek, kullanımı ve kontrolü sağlanacaktır.'),
        emptyLine(80, 0),
        subHeader('12.1 Kişisel Koruyucu Donanım Standartları'),
        boldBullet('Baret:'),
        bodyText('EN 397 standardında genel kullanım için tasarlanmış baret kullanılacak. Projede belirtilen iş kalemlerinde çalışan tüm ekipler tarafından kullanılacaktır. Çalışanlara zimmet formları ile verilecektir.', 400),
        boldBullet('Eldiven:'),
        bodyText('EN 388 Standardında. Projede belirtilen kalıp demir, izolasyon ve diğer düz işlere hareketli kısımları olan el aletleri haricinde tüm işlerinde kullanılmalıdır. EN 374 Kimyasal Madde Eldivenleri, EN 388 Anti Statik-Mekanik İş Eldivenleri, EN 407 Sıcak İş Eldivenleri, EN 420 Genel Amaçlı Eldivenler.', 400),
        boldBullet('İş Ayakkabısı:'),
        bodyText('EN 345, EN 346 Standardında Çelik Burunlu Kaymaz Tabanlı Ayakkabıları Elektrik Ekibi Çalışanları Dışında Herkese Verilmeli. Elektrik Ekibi Çalışanlarına EN 347 Standardında Anti statik Ayakkabı Kullanılmalıdır.', 400),
        boldBullet('Emniyet Kemeri:'),
        bodyText('EN 361 Standardında Paraşüt Tipi Emniyet kemeri ve EN 355 Standardında 1 Adet Ayarlanabilir Şok Emicili Halat ve Güvenlik Halatları Yüksekte Çalışmalarda kullanılmalıdır.', 400),
        boldBullet('Çapak Gözlüğü:'),
        bodyText('EN 166 Standardında Çapak Gözlüğü alınmalı. Beton dökümlerinde ve Hilti, Hızar, Spiral gibi el aletlerini kullananlar tarafından kullanılmalıdır.', 400),
        boldBullet('Solunum Sistemi Koruyucuları:'),
        bodyText('EN 136 Tam Yüz Maskesi, EN 140 Yarım Yüz Maskeleri, EN 141 Gaz Buhar Filtreleri, EN 143 Zerrecik (Partikül) Filtreleri, EN 149 Bakım Gerektirmeyen Maskeler.', 400),
        boldBullet('Kulak Koruyucuları:'),
        bodyText('EN 352-1, EN 352-2, EN 352-3 Standartlarında kulak koruyucuları gürültülü ortamlarda kullanılacaktır.', 400),
        boldBullet('Can Halatları:'),
        bodyText('EN 362 CE 1015 Standardında can halatları iskelelerde, çatılarda kısacası yüksekten düşme riski bulunan tüm bölgelerde çalışanların emniyet kemerini bağlaması için kullanılacaktır.', 400),
        emptyLine(280, 0),

        /* 13. GÜVENLİK İŞARETLERİ */
        sectionHeader('13. SAĞLIK VE GÜVENLİK İŞARETLERİ'),
        emptyLine(120, 0),
        bodyText('Sağlık ve güvenlik işaretleri ile ilgili hususlar Sağlık ve Güvenlik İşaretleri Yönetmeliği (Yayımlandığı Resmi Gazete Tarihi/sayısı: 11.09.2013/28762)\'ne uygun olarak, şantiyemizin giriş ve çıkışlarında, tehlikeli bölgelerin yakınlarında ve sahada kullanılacaktır.'),
        emptyLine(80, 0),
        subHeader('13.1 Yasaklayıcı İşaretler'),
        bodyText('Daire biçiminde, Beyaz zemin üzerine siyah piktogram, kırmızı çerçeve ve diyagonal çizgi (kırmızı kısımlar işaret alanının en az %35\'ini kapsayacaktır).'),
        emptyLine(80, 0),
        subHeader('13.2 Uyarı İşaretleri'),
        bodyText('Üçgen şeklinde, Sarı zemin üzerine siyah piktogram, siyah çerçeve (sarı kısımlar işaret alanının en az %50\'sini kapsayacaktır).'),
        emptyLine(80, 0),
        subHeader('13.3 Emredici İşaretler'),
        bodyText('Daire biçiminde, Mavi zemin üzerine beyaz piktogram (mavi kısımlar işaret alanının en az %50\'sini kapsayacaktır).'),
        emptyLine(80, 0),
        subHeader('13.4 Acil Çıkış ve İlkyardım İşaretleri'),
        bodyText('Dikdörtgen veya kare biçiminde, Yeşil zemin üzerine beyaz piktogram (yeşil kısımlar işaret alanının en az %50\'sini kapsayacaktır).'),
        emptyLine(80, 0),
        subHeader('13.5 Yangınla Mücadele İşaretleri'),
        bodyText('Dikdörtgen veya kare biçiminde, Kırmızı zemin üzerine beyaz piktogram (kırmızı kısımlar işaret alanının en az %50\'sini kapsayacaktır).'),
        emptyLine(280, 0),

        /* 14. KONTROL FORMLARI */
        sectionHeader('14. KONTROL FORMLARI VE ÇALIŞMA İZİNLERİ'),
        emptyLine(120, 0),
        bodyText('Projenin yürütümünde karşılaşılacak risklere ilişkin kontrol formları ve iş izinleri uygulanacaktır. Kontrol formu doldurulmadan ve çalışma izinleri olmadan çalışma başlatılmayacaktır.'),
        emptyLine(80, 0),
        bodyText('Günlük yapılan Saha Denetimlerinde Kontrol Formları uygulanacak ve haftalık olarak İş Sağlığı ve Güvenliği Haftalık Kontrol Formu İSG Sorumlusu tarafından doldurulacaktır.'),
        bulletItem('Kazı İş İzni'),
        bulletItem('Elektrik İş İzni'),
        bulletItem('Gece Çalışma İzni'),
        bulletItem('İş Makinesi Kontrol Formu'),
        bulletItem('Haftalık İSG Kontrol Formu'),
        emptyLine(280, 0),

        /* 15. PROJE KAPSAMINDA ÖNLEMLER */
        sectionHeader('15. PROJE KAPSAMINDA ALINACAK SAĞLIK VE GÜVENLİK ÖNLEMLERİ'),
        emptyLine(120, 0),
        subHeader('15.1 Şantiye Kurulumu'),
        bulletItem('Şantiyenin kurulumu esnasında öncelikle şantiye alanımızın ruhsat sınırları içerisinde kalacak şekilde dışarıdan doğabilecek herhangi bir tehlikeye karşı sınırlandırılması sağlanacaktır.'),
        bulletItem('Şantiyeye asılacak iş güvenliği ve sağlığı ile ilgili uyarı levhalarının çeşidi, sayısı belirlenip temin edilmesine yönelik program hazırlanacaktır.'),
        bulletItem('Şantiye sahasının giriş çıkış noktaları mutlaka belirlenecek ve giriş çıkış noktasına konacak güvenlik görevlileri istihdam edilecektir.'),
        bulletItem('Şantiye kurulumunda yaya yolları şantiye sahası içersinden ayrılarak çalışanlar için güvenli bir geçiş yolları oluşturulacaktır.'),
        emptyLine(80, 0),
        subHeader('15.2 Depolar'),
        bulletItem('Malzemeleri niteliklerine göre uygun yerlerde depo ve istif edilecektir.'),
        bulletItem('Merdivenlere ve çıkış kapıları önüne malzeme, eşya vb. koyulmayacaktır.'),
        bulletItem('Depolarda sigara içilmeyecektir.'),
        bulletItem('Parlayıcı ve yanıcı kimyasal maddelerin bulunduğu depo güneşin ısı ve ışığından korunacak ve iyice havalandırılacaktır.'),
        emptyLine(80, 0),
        subHeader('15.3 Sağlık Faaliyetleri'),
        bulletItem('Personelin tamamı Çalışabilir Sağlık Raporu olmadan kesinlikle işe başlanmayacaktır.'),
        bulletItem('Şantiyede tüm yaralanmalar için bir ilk yardım ekibi ve malzemesi temin edilecek ve hazır bulundurulacaktır.'),
        bulletItem('Periyodik veya periyodik olmayan sağlık kontrol ve muayenesinden geçirilen her personel için bir sağlık sicil kartı tanzim edilecektir.'),
        emptyLine(80, 0),
        subHeader('15.4 Çevre Emniyeti'),
        bulletItem('İnşaat alanının sınırları, yetkisiz ve izinsiz girişleri önlemek amacıyla panellerle kapatılması gerekmektedir.'),
        bulletItem('İnşaat alanı giriş çıkışlarında 24 saat boyunca güvenlik elemanı bulundurulması sağlanmalıdır.'),
        bulletItem('Hafriyat kamyonlarının döküme giderken kesinlikle kasalarının üzerlerinin toprak ve kaya parçalarının düşmesine karşı branda ile kapatılması gereklidir.'),
        emptyLine(80, 0),
        subHeader('15.5 Hava Durumu'),
        bulletItem('İşçiler, sağlık ve güvenliklerini etkileyebilecek uygunsuz hava koşullarından korunacaktır.'),
        bulletItem('Yağmurlu ve fırtınalı havalarda yüksekte çalışmaların (iskele çalışmaları) durdurulması işçi sağlığı ve güvenliği açısından önemlidir.'),
        bulletItem('Yazın çok sıcak havalarda işçilerin su ihtiyacı karşılanmalıdır.'),
        emptyLine(80, 0),
        subHeader('15.6 Gece Çalışmaları ve Aydınlatma'),
        bulletItem('Gece çalışmalarında uygun ve yeterli suni aydınlatma sağlanacaktır.'),
        bulletItem('Gece çalışması yapan personel için şantiyede sağlık memuru bulundurulması ilk yardım açısından önemlidir.'),
        bulletItem('İşçilerin gece çalışma yedi buçuk saati geçemez.'),
        emptyLine(80, 0),
        subHeader('15.7 Hafriyat ve Kazı İşleri'),
        bulletItem('Kazı işlerinin yapılacağı yerlerde; elektrik kabloları, gaz boruları, su yolları, kanalizasyon ve benzeri tesisat bulunup bulunmadığı önceden araştırılacak ve duruma göre gereken tedbirler alınacaktır.'),
        bulletItem('Kazı sırasında zehirli ve boğucu gaz bulunduğu anlaşıldığı hallerde, işçiler, derhal oradan uzaklaştırılacaktır.'),
        bulletItem('1,5 metrede daha derin olan kazı işlerinde, işçilerin inip çıkmaları için yeteri kadar el merdivenleri bulundurulacaktır.'),
        emptyLine(80, 0),
        subHeader('15.8 Beton Dökümü'),
        bulletItem('Beton dökümü sırasında çalışan tüm personelin uygun kişisel koruyucu donanım kullanmaları gerekmektedir.'),
        bulletItem('3 metreden yüksekte yapılan beton dökümlerinde ve döşeme kenarlarında yüksekten düşmeye karşı kenar korkulukları yapılmalı ve vücut tipi emniyet kemeri kullanılması zorunludur.'),
        bulletItem('Beton döküm esnasında kullanılan vibratörün elektrik topraklaması yapılmış olmalıdır.'),
        emptyLine(80, 0),
        subHeader('15.9 Elektrik İşleri'),
        bulletItem('Yeterli iş güvenliği önlemleri alınmadan voltajı ne olursa olsun yüklü elektrik hatları üzerinde ya da bunların yakınında herhangi bir personel çalıştırılmayacaktır.'),
        bulletItem('Elektrikli ekipmanların tamir bakım ve onarımı ehliyetli elektrikçiler tarafından yapılacaktır.'),
        bulletItem('Elektrik tablo ve panoları kilit altında tutulacak, üzerlerinde anahtarlarının nerede ve kimde olduğunu gösteren bilgi levhaları asılacaktır.'),
        emptyLine(80, 0),
        subHeader('15.10 Kimyasal Malzemeler ve Depolanması'),
        bulletItem('Bütün kimyasallar belirlenmiş depolama alanlarında sert zemin üzerinde, sızdırmaz tava içerisinde ve etiketlenerek ayrı depolanır.'),
        bulletItem('Sahada kullanılacak ve depolanacak olan kimyasal malzemeler için Malzeme Güvenlik Formlarında belirtilen güvenlik ve emniyet önlemlerinin alınması sağlanır.'),
        bulletItem('Yanıcı maddeler etiketli, ateşten korunaklı odalarda yönetmeliklere göre saklanır.'),
        emptyLine(80, 0),
        subHeader('15.11 İş Makineleri'),
        bulletItem('İş Makineleri operatör belgesi olmayan personel tarafından kesinlikle kullanılmayacaktır.'),
        bulletItem('Çalışma esnasında operatör kabinine kimse alınmamalıdır.'),
        bulletItem('Kepçe dolu iken altına adam girmesine izin verilmemeli.'),
        bulletItem('Makine bakım ve kontrol kartlarını muntazam tutulmalı. Periyodik bakımlarını bu kartlara göre yaptırılmalıdır.'),
        emptyLine(80, 0),
        subHeader('15.12 Tehlikeli Atık Yönetimi'),
        bulletItem('Tehlikeli Atık ve atık yağ üretimini en az düzeye indirecek şekilde gerekli tedbirler alınmalıdır.'),
        bulletItem('Tehlikeli atıklar ve atık yağlar için şantiyede tehlikeli atık muhafaza yeri oluşturulmalıdır.'),
        bulletItem('Tıbbi atıklar revir/muayene odasında kaynağından ayrı olarak uygun kutuda depolanır.'),
        emptyLine(80, 0),
        subHeader('15.13 Yangın ve Yangınla Mücadele'),
        bulletItem('İnşaat faaliyetlerine başlamadan önce şantiyede iş ve işçi güvenliğini sağlamak amacıyla bir yangından korunma ve acil durum planı hazırlanacak ve uygulamaya konulacaktır.'),
        bulletItem('Acil planda gösterilen mahallere yangın söndürme cihazları ile yangın bidon ve kovaları konulacaktır.'),
        bulletItem('Seyyar yangın söndürme cihazları 6 ayda bir kontrol edilir.'),
        bulletItem('Yanıcı sıvılar kapalı kaplarda veya tanklarda muhafaza edilecektir.'),
        bulletItem('Gerilim altındaki elektrik tesisi ve cihazlarında çıkan yangınlarda, su ve köpük kullanılmayacak, elektriksel olarak yalıtkan tozlu söndürücüler kullanılacaktır.'),
        emptyLine(280, 0),

        /* KAYNAKÇA */
        sectionHeader('KAYNAKÇA'),
        emptyLine(120, 0),
        bulletItem('İş Sağlığı ve Güvenliği (İSG) Kanunu — Resmi Gazete Tarihi: 20.06.2012 Resmi Gazete Sayısı: 6331'),
        bulletItem('İş Sağlığı ve Güvenliği Hizmetleri Yönetmeliği — Resmi Gazete Tarihi: 29.12.2012 Resmi Gazete Sayısı: 28512'),
        bulletItem('Yapı İşlerinde İş Sağlığı Ve Güvenliği Yönetmeliği — Yayımlandığı Resmi Gazete Tarihi/Sayısı: 05.10.2013/28786'),
        bulletItem('İş Sağlığı ve Güvenliği Kurulları Hakkında Yönetmelik — Resmi Gazete Tarihi: 18.01.2013 Sayısı: 28532'),
        bulletItem('Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik — Resmi Gazete Tarihi/Sayısı: 15.05.2013/28648'),
        bulletItem('İlk Yardım Yönetmeliği — Resmi Gazete Tarihi: 22.05.2002 Resmi Gazete Sayısı: 24762 Rev: 2015'),
        bulletItem('İşyerlerinde Acil Durumlar Hakkında Yönetmelik — Resmi Gazete Tarihi/Sayısı: 18.06.2013/28681'),
        bulletItem('Binaların Yangında Korunması Hakkında Yönetmelik'),
        bulletItem('Kişisel Koruyucu Donanımların İşyerlerinde Kullanılması Hakkında Yönetmelik — Resmi Gazete tarihi/sayısı: 02.07.2013/28695'),
        bulletItem('Sağlık ve Güvenlik İşaretleri Yönetmeliği — Yayımlandığı Resmi Gazete Tarihi/sayısı: 11.09.2013/28762'),
        emptyLine(200, 0),

        /* FOOTER */
        footerParagraph,
      ];

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
          },
          children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `SGP_${firmaAdi || 'Plan'}_${today.replace(/\./g, '-')}.docx`);
    } catch (e) {
      console.error('Word export error:', e);
    } finally {
      setWordLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: '560px', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.2)' }}>
              <i className="ri-shield-check-line text-sm" style={{ color: '#059669' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sağlık ve Güvenlik Planı</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Resmi SGP Belgesi — Word Belgesi</p>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Firma ve Proje Bilgileri */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Firma ve Proje Bilgileri</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Firma / İşyeri Adı <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  value={firmaAdi}
                  onChange={e => setFirmaAdi(e.target.value)}
                  placeholder="Firma adını girin"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Proje Adı</label>
                <input
                  value={projeAdi}
                  onChange={e => setProjeAdi(e.target.value)}
                  placeholder="Proje adı"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Proje Adresi</label>
                <input
                  value={projeAdresi}
                  onChange={e => setProjeAdresi(e.target.value)}
                  placeholder="Proje adresi"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>İşveren / Proje Sorumlusu</label>
                <input
                  value={isverenAdi}
                  onChange={e => setIsverenAdi(e.target.value)}
                  placeholder="Ad Soyad"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>

          {/* İSG Ekibi */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>İSG Ekibi</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>İş Güvenliği Uzmanı</label>
                  <input
                    value={isgUzmani}
                    onChange={e => setIsgUzmani(e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>İşyeri Hekimi</label>
                  <input
                    value={isyeriHekimi}
                    onChange={e => setIsyeriHekimi(e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Sağlık ve Güvenlik Koordinatörü</label>
                <input
                  value={koordinator}
                  onChange={e => setKoordinator(e.target.value)}
                  placeholder="Ad Soyad"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>

          {/* Belge notu */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(27,58,107,0.05)', border: '1px solid rgba(27,58,107,0.15)' }}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(27,58,107,0.1)' }}>
                <i className="ri-file-word-line text-sm" style={{ color: '#1B3A6B' }} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: '#1B3A6B' }}>Oluşturulacak Belge</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  İSG-SGP-01 numaralı 15 bölümlü Sağlık ve Güvenlik Planı; tüm yasal referanslar, eğitim tablosu, izleme/ölçme tablosu ve KKD standartlarıyla Word formatında oluşturulacaktır.
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
            disabled={!isFormValid || wordLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{
              background: !isFormValid || wordLoading ? 'rgba(27,58,107,0.4)' : '#1B3A6B',
              color: '#fff',
              opacity: !isFormValid || wordLoading ? 0.6 : 1,
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
