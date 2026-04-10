import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, BorderStyle, ShadingType,
  WidthType, VerticalAlign, HeightRule, PageBreak,
} from 'docx';
import { saveAs } from 'file-saver';

interface Props {
  onClose: () => void;
}

interface FormData {
  firmaAdi: string;
  santiyeAdi: string;
  santiyeAdresi: string;
  hazirlanmaTarihi: string;
  gecerlilikTarihi: string;
  isgUzmaniAdi: string;
  acilDurumSorumlusuAdi: string;
  acilDurumSorumlusuTelefon: string;
  isgUzmaniTelefon: string;
  calisanSayisi: string;
  tehlikeSinifi: string;
}

const TEHLIKE_SINIFLARI = ['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'];

export default function AcilDurumEylemPlaniModal({ onClose }: Props) {
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const twoYearsLater = new Date();
  twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
  const twoYearsStr = twoYearsLater.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const [wordLoading, setWordLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    firmaAdi: '',
    santiyeAdi: '',
    santiyeAdresi: '',
    hazirlanmaTarihi: today,
    gecerlilikTarihi: twoYearsStr,
    isgUzmaniAdi: '',
    acilDurumSorumlusuAdi: '',
    acilDurumSorumlusuTelefon: '',
    isgUzmaniTelefon: '',
    calisanSayisi: '',
    tehlikeSinifi: 'Çok Tehlikeli',
  });

  const set = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const isValid = form.firmaAdi.trim() && form.santiyeAdresi.trim() && form.isgUzmaniAdi.trim() && form.acilDurumSorumlusuAdi.trim();

  /* ─────────────────────────────────────────────────────────── */
  /*  WORD EXPORT                                                */
  /* ─────────────────────────────────────────────────────────── */
  const handleWordExport = async () => {
    setWordLoading(true);
    try {
      const FONT = 'Times New Roman';
      const ACCENT = '1B3A6B';
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

      const boldPara = (text: string, before = 120, after = 80, size = 20) =>
        new Paragraph({
          spacing: { before, after },
          children: [new TextRun({ text, bold: true, size, font: FONT, color: '1F2937' })],
        });

      const normalPara = (text: string, before = 60, after = 60, indent = 0, size = 19) =>
        new Paragraph({
          spacing: { before, after },
          indent: indent ? { left: indent } : undefined,
          children: [new TextRun({ text, size, font: FONT, color: '374151' })],
        });

      const bulletPara = (text: string, indent = 360) =>
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { left: indent },
          bullet: { level: 0 },
          children: [new TextRun({ text, size: 19, font: FONT, color: '374151' })],
        });

      /* ── HEADER TABLOSU ── */
      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:     { style: BorderStyle.THICK, size: 24, color: ACCENT },
          bottom:  { style: BorderStyle.THICK, size: 24, color: ACCENT },
          left:    { style: BorderStyle.NONE,  size: 0,  color: 'FFFFFF' },
          right:   { style: BorderStyle.NONE,  size: 0,  color: 'FFFFFF' },
          insideH: { style: BorderStyle.NONE,  size: 0,  color: 'FFFFFF' },
          insideV: { style: BorderStyle.SINGLE, size: 4, color: '3B82F6' },
        },
        rows: [
          new TableRow({
            height: { value: 1000, rule: HeightRule.ATLEAST },
            children: [
              // Sol: Firma adı
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: HEADER_BG },
                margins: { top: 160, bottom: 160, left: 240, right: 240 },
                borders: noBorder,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 60 },
                    children: [
                      new TextRun({ text: form.firmaAdi || 'FİRMA ADI', bold: true, size: 24, font: FONT, color: 'FFFFFF', allCaps: true }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: form.santiyeAdi || '', size: 18, font: FONT, color: 'BFD7FF' }),
                    ],
                  }),
                ],
              }),
              // Orta: Başlık
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                width: { size: 3500, type: WidthType.DXA },
                shading: { type: ShadingType.SOLID, color: '0F2A52' },
                margins: { top: 160, bottom: 160, left: 200, right: 200 },
                borders: noBorder,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 60 },
                    children: [
                      new TextRun({ text: 'ACİL DURUM PLANI', bold: true, size: 28, font: FONT, color: 'FFFFFF', allCaps: true }),
                    ],
                  }),
                ],
              }),
              // Sağ: Doküman bilgileri
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                width: { size: 2400, type: WidthType.DXA },
                shading: { type: ShadingType.SOLID, color: '1E3A5F' },
                margins: { top: 120, bottom: 120, left: 160, right: 160 },
                borders: noBorder,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 40 },
                    children: [new TextRun({ text: 'Doküman No:', size: 16, font: FONT, color: '93C5FD' })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 60 },
                    children: [new TextRun({ text: 'ADEP-EM-01', bold: true, size: 20, font: FONT, color: 'FFFFFF' })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 40 },
                    children: [new TextRun({ text: `İlk Yayın: ${form.hazirlanmaTarihi}`, size: 15, font: FONT, color: '93C5FD' })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 40 },
                    children: [new TextRun({ text: `Geçerlilik: ${form.gecerlilikTarihi}`, size: 15, font: FONT, color: 'BFD7FF' })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: 'Revizyon No: 00/--', size: 15, font: FONT, color: '93C5FD' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      /* ── SANTİYE BİLGİSİ ── */
      const santiyeTable = new Table({
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
                children: [new Paragraph({ children: [new TextRun({ text: 'Şantiye / Proje Adı', bold: true, size: 19, font: FONT, color: '374151' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: form.santiyeAdi || '', size: 19, font: FONT, color: '1F2937' })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'Şantiye Adresi', bold: true, size: 19, font: FONT, color: '374151' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: form.santiyeAdresi, size: 19, font: FONT, color: '1F2937' })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'Hazırlanma Tarihi', bold: true, size: 19, font: FONT, color: '374151' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: form.hazirlanmaTarihi, size: 19, font: FONT, color: '1F2937' })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'Geçerlilik Tarihi', bold: true, size: 19, font: FONT, color: '374151' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: form.gecerlilikTarihi, size: 19, font: FONT, color: '1F2937' })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'Çalışan Sayısı', bold: true, size: 19, font: FONT, color: '374151' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: form.calisanSayisi || '', size: 19, font: FONT, color: '1F2937' })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'Tehlike Sınıfı', bold: true, size: 19, font: FONT, color: '374151' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: form.tehlikeSinifi, size: 19, font: FONT, color: '1F2937' })] })],
              }),
            ],
          }),
        ],
      });

      /* ── BÖLÜM BAŞLIĞI ── */
      const sectionHeader = (no: string, title: string) =>
        new Paragraph({
          spacing: { before: 280, after: 120 },
          shading: { type: ShadingType.SOLID, color: HEADER_BG },
          border: {
            left: { style: BorderStyle.THICK, size: 24, color: '3B82F6' },
          },
          indent: { left: 0 },
          children: [
            new TextRun({ text: `  ${no}. ${title}`, bold: true, size: 22, font: FONT, color: 'FFFFFF', allCaps: true }),
          ],
        });

      /* ── İMZA TABLOSU ── */
      const signatureTable = new Table({
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
          // Başlık satırı
          new TableRow({
            children: [
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'HAZIRLAYAN', bold: true, size: 19, font: FONT, color: ACCENT })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ACİL DURUM SORUMLUSU', bold: true, size: 19, font: FONT, color: ACCENT })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.SOLID, color: LABEL_BG },
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'İŞVEREN', bold: true, size: 19, font: FONT, color: ACCENT })] })],
              }),
            ],
          }),
          // Unvan satırı
          new TableRow({
            children: [
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'İş Güvenliği Uzmanı', size: 18, font: FONT, color: '6B7280', italics: true })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Acil Durum Sorumlusu', size: 18, font: FONT, color: '6B7280', italics: true })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'İşveren / Vekili', size: 18, font: FONT, color: '6B7280', italics: true })] })],
              }),
            ],
          }),
          // Ad soyad satırı
          new TableRow({
            children: [
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.isgUzmaniAdi, bold: true, size: 20, font: FONT, color: '1F2937' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.acilDurumSorumlusuAdi, bold: true, size: 20, font: FONT, color: '1F2937' })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.firmaAdi, bold: true, size: 20, font: FONT, color: '1F2937' })] })],
              }),
            ],
          }),
          // İmza alanı
          new TableRow({
            height: { value: 1200, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                verticalAlign: VerticalAlign.BOTTOM,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'İmza', size: 17, font: FONT, color: 'D1D5DB', italics: true })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.BOTTOM,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'İmza', size: 17, font: FONT, color: 'D1D5DB', italics: true })] })],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.BOTTOM,
                borders: thinBorder,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Kaşe / İmza', size: 17, font: FONT, color: 'D1D5DB', italics: true })] })],
              }),
            ],
          }),
        ],
      });

      /* ── DOKÜMAN İÇERİĞİ ── */
      const children: (Paragraph | Table)[] = [
        headerTable,
        emptyLine(200, 0),
        santiyeTable,
        emptyLine(200, 0),

        // 1. GENEL ESASLAR
        sectionHeader('1', 'GENEL ESASLAR'),
        normalPara('Acil Durum: İşletme içi veya işletme dışı nedenlerden kaynaklanabilen ve ortaya çıktığında çalışanları, çevreyi, üretimi ve tesisleri kalıcı veya geçici olarak zarara uğratan, etkileri hemen veya daha sonra ortaya çıkabilen planlanmamış olaylardır. Etki alanına göre küçük veya büyük acil durum olarak sınıflandırılır.', 80, 60),
        normalPara('Olası felaketlere karşı hazırlıklı ve organize olmak, önceliklerin ve kritik süreçlerin belirlendiği, değişimlerin takip edildiği, detaylı ve organize bir iş devamlılığı planına sahip olmayı gerektirmektedir. Aşağıdaki durumlar, yönetimin acil müdahalesini ve olayı kontrol altına alıp sonlandırmak için gerekli kaynakların olaya dahil edilmesini gerektiren durumlardır.', 60, 60),
        boldPara('İşletmede olması muhtemel acil durumlar:', 80, 40),
        bulletPara('A, B, C, D sınıfı yangınlar'),
        bulletPara('Tabii afetler; Deprem, Sel baskını, Büyük ölçekli kazalar, Fırtına'),
        bulletPara('Yaygın şiddet hareketleri belirtilerinin ortaya çıkması; Terör olayları, Sabotaj, Kanunsuz grev, lokavt ve işi bırakma eylemleri'),
        bulletPara('Tehlikeli ve salgın hastalıklar'),
        bulletPara('Kimyasal madde kazaları'),
        bulletPara('Parlama, patlama'),
        bulletPara('İş kazaları'),
        bulletPara('Çevre kuruluşlarda meydana gelen olaylar'),
        normalPara('Acil durum planı, tüm işyerleri için tasarım veya kuruluş aşamasından başlamak üzere acil durumların belirlenmesi, bunların olumsuz etkilerini önleyici ve sınırlandırıcı tedbirlerin alınması, görevlendirilecek kişilerin belirlenmesi, acil durum müdahale ve tahliye yöntemlerinin oluşturulması, dokümantasyon, tatbikat ve acil durum planının yenilenmesi aşamaları izlenerek hazırlanır.', 80, 60),

        // 2. AMAÇ
        sectionHeader('2', 'AMAÇ'),
        normalPara(`${form.firmaAdi} unvanlı işyerinde acil durum planlarının hazırlanması ile önleme, koruma, tahliye, yangınla mücadele, ilkyardım ve benzeri konularda yapılması gereken çalışmalar ile bu durumların güvenli olarak yönetilmesi ve bu konularda görevlendirilecek çalışanların belirlenmesi amaçlanmaktadır.`, 80, 60),

        // 3. KAPSAM
        sectionHeader('3', 'KAPSAM'),
        normalPara(`Risk değerlendirmesi sonuçları, yangın, tehlikeli kimyasal maddelerden kaynaklanan yayılım ve patlama ihtimali, ilkyardım ve tahliye gerektirecek olaylar, doğal afetlerin meydana gelme ihtimali, sabotaj ihtimali, terör ve çevresel olaylarda ${form.firmaAdi}, her ne nedenden olursa olsun acil durum da sahada bulunanlarla işbirliği yapılması kararı altına alınan; Özel veya Tüzel Kişiliği olan Kamu Kurum ve Kuruluşları ile Özel Kurum veya Kuruluşlar bu plan kapsamı dahilindedir.`, 80, 60),

        // 4. DAYANAK
        sectionHeader('4', 'DAYANAK'),
        normalPara('İş Sağlığı ve Güvenliği Kanununun 11 inci, 12 nci ve 30 uncu maddelerine dayanılarak 18.06.2013 Tarih ve 28681 Sayılı Resmi Gazete\'de yayınlanmış olan İşyerlerinde Acil Durumlar Hakkında Yönetmelik hükümlerine göre hazırlanmıştır.', 80, 60),

        // 5. UYGULAMA
        sectionHeader('5', 'UYGULAMA'),
        normalPara(`${form.firmaAdi} unvanlı işyerinde meydana gelen acil durumlarda; Acil Durum Öncesi, Acil Durum Sırasında, Acil Durum Sonrasında olmak üzere, işletme içi kaynakların kullanılması ve yönetilmesi, topluluk içi kaynakların kullanılması ve yönetilmesi, topluluk dışı kaynakların kullanılması ve yönetilmesi için uygulamaların doğru şekilde yapılmasına yol göstermektir. Planın uygulanması ${form.firmaAdi} sorumluluğundadır.`, 80, 60),

        // 6. TANIMLAR
        sectionHeader('6', 'TANIMLAR'),
        boldPara('Acil Durum:', 80, 20),
        normalPara('İşyerinin tamamında veya bir kısmında meydana gelebilecek yangın, patlama, tehlikeli kimyasal maddelerden kaynaklanan yayılım, doğal afet gibi acil müdahale, mücadele, ilkyardım veya tahliye gerektiren olaylardır.', 0, 60),
        boldPara('Acil Durum Planı:', 60, 20),
        normalPara('İşyerlerinde meydana gelebilecek acil durumlarda yapılacak iş ve işlemler dahil bilgilerin ve uygulamaya yönelik eylemlerin yer aldığı plandır.', 0, 60),
        boldPara('Acil Durum Yönetimi:', 60, 20),
        normalPara('Acil durum ortaya çıktığında, personel, malzeme-donanım ile Acil durum plan ve uygulamalarının yönetimidir.', 0, 60),
        boldPara('Tehlike:', 60, 20),
        normalPara('Zarar, hasar veya yaralanma yaratabilme potansiyelidir.', 0, 60),
        boldPara('Risk:', 60, 20),
        normalPara('Tehlikenin açığa çıkma olasılığı ve verebileceği zarar, hasar veya yaralanmanın şiddetini önceden görebilmektir.', 0, 60),
        boldPara('Kaza:', 60, 20),
        normalPara('Ölüme, hastalığa, yaralanmaya, hasara veya diğer kayıplara sebebiyet veren istenmeyen olaylardır.', 0, 60),
        boldPara('Tahliye:', 60, 20),
        normalPara('Malzeme, donanım ve personelin risk veya afet bölgesinden güvenli olarak uzaklaştırılması.', 0, 60),
        boldPara('İlkyardım:', 60, 20),
        normalPara('Herhangi bir nedenle tehlikeli duruma girmiş olan, hastalanan veya kazaya uğrayan bir kişiye durumunun daha kötüye gitmesini önlemek üzere olay yerinde yapılan tıbbi olmayan geçici müdahaledir.', 0, 60),
        boldPara('Güvenli Yer:', 60, 20),
        normalPara('Acil durumların olumsuz sonuçlarından çalışanların etkilenmeyeceği mesafede veya korumakta belirlenen yerdir.', 0, 80),

        // 7. ORGANİZASYON VE EKİPLER
        sectionHeader('7', 'ORGANİZASYON VE EKİPLER'),
        normalPara(`İşyerlerinde tehlike sınıflarını tespit eden Tebliğde belirlenmiş olan ${form.tehlikeSinifi} sınıfta yer alan işyerlerinde; yangınla mücadele, koruma, kurtarma ve ilkyardım konularının her biri için uygun donanıma sahip ve özel eğitimli en az birer çalışan destek elemanı olarak görevlendirilir.`, 80, 60),
        normalPara('İşveren tarafından acil durumlarda ekipler arası gerekli koordinasyonu sağlamak üzere çalışanları arasından bir sorumlu görevlendirilir.', 60, 60),
        boldPara('Acil Durum Sorumlusu:', 80, 20),
        normalPara(`${form.acilDurumSorumlusuAdi} — İşyerinde işveren tarafından görevlendirilen ve acil durumlardan kaynaklanan risk ve etkileri en aza indirmek için tedbirlerin alınması ve aldırılmasını sağlayacak organizasyonu kuran ve organizasyon kapsamında yürütülen faaliyet ve ekiplerden sorumlu olan kişidir.`, 0, 80),

        // 8. ACİL DURUM ÖNCESİ TEDBİRLER
        sectionHeader('8', 'ACİL DURUM ÖNCESİNDE ALINMASI GEREKEN ÖNLEYİCİ VE SINIRLANDIRICI TEDBİRLER'),
        normalPara('Acil durum sırasında bilinçli davranabilmek, kayıpları en az düzeyde tutmak, güvenliği artırmak için ciddi önlemler almak gereklidir. Bunun için de riskler gerçekleşmeden önce bazı çalışmalar yapılmalıdır.', 80, 60),
        boldPara('8.1. İşaretlemeler', 80, 40),
        normalPara('Makine-donanım, tehlike kaynakları, risk noktaları ve yürüme-tahliye yollarının renk kodlarına uygun olarak işaretlemesi ve boyanması yapılır.', 0, 60),
        boldPara('8.2. Alarm Sistemi Kurulması', 80, 40),
        normalPara('İşletmeye, mutlaka Acil Durum halinde üretimi durdurma, işyerini tahliye etme, gerekiyorsa sığınak veya toplanma noktalarına personeli yönlendirme, her türlü Acil Durumu haber verme amacıyla sesli, ışıklı alarm ve ikaz sistemi kurulur.', 0, 60),
        boldPara('8.3. Periyodik Bakım Programları', 80, 40),
        normalPara('İşletmede, her türlü makine ve donanım için bir periyodik bakım kartı hazırlanır. Yasalarda adı geçen makine ve donanım için yasal süreler içinde ilgili birimlere periyodik muayeneler ve bakımlar yaptırılır.', 0, 60),
        bulletPara('Motopomplar: En az 6 ayda bir defa kontrol edilecek'),
        bulletPara('Lastikli Hortumlar: En geç 3 ayda bir defa kontrol edilecek'),
        bulletPara('Seyyar Yangın Tüpleri: En az 6 ayda bir defa kontrol edilecek'),
        bulletPara('Buhar ve Sıcak Su Kazanları: Yılda 1 defa periyodik olarak kontrol'),
        bulletPara('Basınçlı Kaplar: Periyodik olarak yılda 1 defa kontrol'),
        bulletPara('Hava Kompresörleri: Periyodik olarak kontrol edilecek'),
        bulletPara('Aydınlatma Devresi: Bir yılı geçmeyen süreler içinde kontrol ve bakım'),
        boldPara('8.4. Çalışanların Bilgilendirilmesi ve Eğitim', 80, 40),
        normalPara('Tüm çalışanlara acil durum planları ile arama, kurtarma ve tahliye, yangınla mücadele, ilkyardım konularında görevlendirilen kişiler hakkında bilgilendirilir. İşe yeni alınan çalışana, iş sağlığı ve güvenliği eğitimlerine ilave olarak acil durum planları ile ilgili bilgilendirme yapılır.', 0, 80),

        // 9. ACİL DURUM SIRASINDA VE SONRASINDA
        sectionHeader('9', 'ACİL DURUM SIRASINDA VE SONRASINDA UYULMASI GEREKENLER'),
        boldPara('Belirlenen Acil Durumlar:', 80, 40),
        bulletPara('1. Yangın'),
        bulletPara('2. Deprem'),
        bulletPara('3. Sel'),
        bulletPara('4. Fırtına'),
        bulletPara('5. Anız Yangınları'),
        bulletPara('6. Sabotaj'),
        bulletPara('7. Yaralanma'),
        bulletPara('8. Savaş'),
        bulletPara('9. Elektrik Çarpması'),
        bulletPara('10. Uzuv Kopması'),
        bulletPara('11. Zehirlenmeler'),
        bulletPara('12. İş Kazası'),
        bulletPara('13. Yüksekte Çalışma - Yüksekten Düşme Sonucu Askıda Kalma'),

        boldPara('9.1. Yangın Durumu ve Talimatı', 120, 60),
        normalPara('Sahada herhangi bir yangın çıkması durumunda, yangını ilk gören en az üç kere yüksek sesle "YANGIN VAR" diye bağıracak, ikaz düğmeleri ile acil durum ikaz sistemi çalıştırılacak ve kurtarma ekibi organizasyonuyla işyeri dolaşılarak olayın tüm personele duyurulması sağlanacaktır. Yangın büyüklüğüne göre gerekli hallerde İTFAİYE (TLF: 112)\'ye haber verilecektir. İşveren durumdan haberdar edilecektir.', 0, 60),
        normalPara('Yangın esnasında Yangın Acil Durum Planına göre hareket edilecektir. Her ne olursa olsun ilk düşünce kendi can güvenliğini almak ve yakınında bulunan makine veya ekipmanın enerjisini keserek önceden belirlenmiş ve işyerinde duyurulmuş olan acil çıkış yollarını kullanarak panik yapmadan "Acil Durum Toplanma Noktası"na gidilmesi olacaktır.', 60, 80),

        boldPara('9.2. Deprem Durumu ve Talimatı', 120, 60),
        normalPara(`${form.firmaAdi} işletmesinin bulunduğu bölge deprem kuşağı üzerinde yer almaktadır. Yakın çevremizde olabilecek depremler sonrasında iletişim, ulaşım ve diğer hizmetlerin sağlanmasında aksamalar olacaktır. Bu nedenle deprem öncesinde, sırasında ve sonrasında aşağıdaki uygulamalara geçilecektir.`, 0, 60),
        bulletPara('Deprem başladığında koşuşturmayı ve paniği engelleyiniz'),
        bulletPara('Acil Toplanma Bölgesine gidin'),
        bulletPara('Bina dışındaysanız binalardan ve elektrik direklerinden uzak durun'),
        bulletPara('Sarsıntı durduktaktan sonra tüm çalışanlar kendi ünitelerindeki Acil Müdahale Talimatları uyarınca yapılması gereken işlerini süratle tamamlayacaklardır'),

        boldPara('9.3. Sel Baskını Durumu ve Talimatı', 120, 60),
        normalPara('Sahanın altyapısının kaldıramayacağı büyüklüklerde yağışlarla ya da su birikmeleriyle karşı karşıya gelindiğinde hemen yetkililere haber verilir. Panik yaratmadan sahada bulunan personel bilgilendirilir ve ilk önlemler alınır. Su giderleri açılır ve suyun geliş yönü set ve bariyerlerle engellenir veya değiştirilir.', 0, 80),

        boldPara('9.4. Fırtına Durumu', 120, 60),
        normalPara('Fırtına başladığında, personelin öncelikle başlarını ve bedenlerini düşebilecek malzemelerden koruması, elektrik, su, doğalgaz donanımlarını kapatmak, camlardan ve kapılardan uzak durmak, dışarıda veya araç içindeyseniz, en yakın sığınağa veya işletme binasına sığınmanız gerekir.', 0, 80),

        boldPara('9.5. Sabotaj Durumu ve Talimatı', 120, 60),
        normalPara('Sabotaj esnasında yapılması gerekenler:', 0, 40),
        bulletPara('Vakit kaybetmeden Güvenlik Birimine Haber Ver'),
        bulletPara('Sabotajın şekline göre ilgili yerlere haber ver (Güvenlik, Santral, Danışma)'),
        bulletPara('Jandarma (112), Büyükşehir İtfaiye (112)'),
        bulletPara('Can güvenliğini tehlikeye atmadan olay mahallini güvence altına al (Koruma Ekibi)'),
        bulletPara('Toplanma Bölgesine git ve ilgililere yardımcı ol (Tüm Personel)'),

        boldPara('9.6. Yaralanma Durumu Talimatı', 120, 60),
        normalPara('Çalışma sırasında karşılaşılacak her türlü küçük ya da büyük yaralanmada anında personel çalışmayı keser, üründen uzaklaşır. Yaralanma ve varsa kanama durumu sağlık memuru, bölüm sorumlusu, ekip başı, üretim müdürü, idari işler yöneticisine bildirilir.', 0, 80),

        boldPara('9.7. Patlama Talimatı', 120, 60),
        normalPara('Çalışma sahasında oluşabilecek patlayıcı ortamların tehlikelerinden çalışanların sağlık ve güvenliğini korumak için alınması gerekli önlemleri belirlemek için tedbirler alınmalıdır.', 0, 60),
        bulletPara('Telâşlanmayınız, parlama ve patlama esnasında çevrenize ve sorumlu kişilere duyurunuz'),
        bulletPara('Gaz vanalarını, elektrik salterlerini kapatınız'),
        bulletPara('Yanıcı ve patlayıcı maddeleri uzaklaştırınız'),
        bulletPara('Önce canlıları ve daha sonra kıymetli eşya ve dokümanları kurtarınız'),
        bulletPara('Yaralılara ilkyardım müdahalesini yapınız'),

        boldPara('9.8. Elektrik Çarpması İçin Acil Durum Müdahale Yöntemi', 120, 60),
        normalPara('Kazazedeye direkt dokunmadan önce elektrik akımının kesilip kesilmediğini kontrol edin. Tahta, çubur vb. yalıtkan malzemeler kullanarak elektrikle teması kesin. Revire haber verin. Kazazedenin bilincini kontrol edin. Gerekirse ilkyardım uygulayın. Ambulansı arayın (112).', 0, 80),

        boldPara('9.9. Uzuv Kopması İçin Acil Durum Müdahale Yöntemi', 120, 60),
        normalPara('Uzuv kopmalarında kopan organa kısa süre içerisinde doğru müdahaleler yapılıp hastayla beraber en yakın tam teşekküllü bir hastaneye sevk edilmelidir. Kopan organ uygun taşınırsa 6-8 saat içerisinde eski durumuna ulaşabilir.', 0, 60),
        bulletPara('Yaralıyı hemen sakinleştirin, hareket etmesini engelleyin'),
        bulletPara('Yaranın bulunduğu yerin üstüne uygun materyal ile turnike uygulayın'),
        bulletPara('Kopan organı bulun ve kirli ise serum fizyolojik veya temiz su ile yıkayın'),
        bulletPara('Kopan organı temiz bir poşetin içine koyarak yaralıyla beraber en yakın hastaneye sevk edin'),

        boldPara('9.10. Gıda Zehirlenmesi İçin Acil Durum Müdahale Yöntemi', 120, 60),
        normalPara('Gıda zehirlenmesi halinde veya şüphesinde ilkyardım ekibine haber verin. İlkyardım müdahalesini yapın. Ambulans çağırın (112). Hastanın/hastaların yanında refakatçi bulunmasını sağlayın. Sağlık durumunun sonuçlarını takip edin, olayın oluş şeklini inceleyin ve olay raporu hazırlanmasına yardımcı olun.', 0, 80),

        // 10. TATBIKATLAR
        sectionHeader('10', 'TATBİKATLAR'),
        normalPara('Hazırlanan acil durum planının uygulama adımlarının düzenli olarak takip edilebilmesi ve uygulanabilirliğinden emin olmak için işyerlerinde yılda en az bir defa olmak üzere tatbikat yapılır, denetlenir ve gözden geçirilerek gerekli düzeltici ve önleyici faaliyetler yapılır.', 80, 60),
        normalPara('Gerçekleştirilen tatbikatın tarihi, görülen eksiklikler ve bu eksiklikler doğrultusunda yapılacak düzenlemeleri içeren tatbikat raporu hazırlanır.', 60, 80),

        emptyLine(400, 0),

        // İMZA TABLOSU
        new Paragraph({
          spacing: { before: 0, after: 120 },
          shading: { type: ShadingType.SOLID, color: HEADER_BG },
          border: { left: { style: BorderStyle.THICK, size: 24, color: '3B82F6' } },
          children: [new TextRun({ text: '  HAZIRLAYAN VE ONAY', bold: true, size: 22, font: FONT, color: 'FFFFFF', allCaps: true })],
        }),
        emptyLine(80, 0),
        signatureTable,

        emptyLine(200, 0),

        // Footer
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 0 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } },
          children: [
            new TextRun({ text: 'Bu belge ', size: 16, font: FONT, color: '9CA3AF' }),
            new TextRun({ text: 'isgdenetim.com.tr', size: 16, font: FONT, color: ACCENT, bold: true }),
            new TextRun({ text: ' tarafından oluşturulmuştur.', size: 16, font: FONT, color: '9CA3AF' }),
            new TextRun({ text: `   ·   ADEP-EM-01   ·   ${form.hazirlanmaTarihi}`, size: 16, font: FONT, color: '9CA3AF' }),
          ],
        }),
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
      saveAs(blob, `Acil_Durum_Plani_${form.firmaAdi || 'Belge'}.docx`);
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
        style={{ maxWidth: '620px', maxHeight: '92vh', background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <i className="ri-alarm-warning-line text-sm" style={{ color: '#DC2626' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Acil Durum Eylem Planı</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ADEP-EM-01 — Word Belgesi</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Belge Notu */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(27,58,107,0.05)', border: '1px solid rgba(27,58,107,0.15)' }}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(27,58,107,0.1)' }}>
                <i className="ri-file-word-line text-sm" style={{ color: '#1B3A6B' }} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: '#1B3A6B' }}>Oluşturulacak Belge</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  ADEP-EM-01 numaralı resmi Acil Durum Planı; genel esaslar, amaç, kapsam, dayanak, organizasyon, ekipler, acil durum talimatları (yangın, deprem, sel, fırtına, sabotaj, yaralanma, patlama, elektrik çarpması, uzuv kopması, gıda zehirlenmesi) ve imza alanlarıyla Word formatında oluşturulacaktır.
                </p>
              </div>
            </div>
          </div>

          {/* Firma Bilgileri */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Firma Bilgileri</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Firma / İşyeri Adı <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  value={form.firmaAdi}
                  onChange={e => set('firmaAdi', e.target.value)}
                  placeholder="Örn: ABC İnşaat A.Ş."
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>İşveren imza alanında firma adı olarak görünür</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Şantiye / Proje Adı</label>
                  <input
                    value={form.santiyeAdi}
                    onChange={e => set('santiyeAdi', e.target.value)}
                    placeholder="Örn: Proje Adı"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Çalışan Sayısı</label>
                  <input
                    value={form.calisanSayisi}
                    onChange={e => set('calisanSayisi', e.target.value)}
                    placeholder="Örn: 50"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Şantiye Adresi <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  value={form.santiyeAdresi}
                  onChange={e => set('santiyeAdresi', e.target.value)}
                  placeholder="Örn: Mahalle, İlçe / İl"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Tehlike Sınıfı</label>
                <div className="flex gap-2">
                  {TEHLIKE_SINIFLARI.map(s => (
                    <button
                      key={s}
                      onClick={() => set('tehlikeSinifi', s)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                      style={{
                        background: form.tehlikeSinifi === s ? 'rgba(220,38,38,0.08)' : 'var(--bg-app)',
                        border: `1px solid ${form.tehlikeSinifi === s ? 'rgba(220,38,38,0.35)' : 'var(--border-main)'}`,
                        color: form.tehlikeSinifi === s ? '#DC2626' : 'var(--text-muted)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tarihler */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Tarihler</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Hazırlanma Tarihi</label>
                <input
                  value={form.hazirlanmaTarihi}
                  onChange={e => set('hazirlanmaTarihi', e.target.value)}
                  placeholder="GG.AA.YYYY"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Geçerlilik Tarihi</label>
                <input
                  value={form.gecerlilikTarihi}
                  onChange={e => set('gecerlilikTarihi', e.target.value)}
                  placeholder="GG.AA.YYYY"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>

          {/* İmza Bilgileri */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>İmza Alanı Bilgileri</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    İSG Uzmanı Adı Soyadı <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    value={form.isgUzmaniAdi}
                    onChange={e => set('isgUzmaniAdi', e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>İSG Uzmanı Telefon</label>
                  <input
                    value={form.isgUzmaniTelefon}
                    onChange={e => set('isgUzmaniTelefon', e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    Acil Durum Sorumlusu Adı Soyadı <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    value={form.acilDurumSorumlusuAdi}
                    onChange={e => set('acilDurumSorumlusuAdi', e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Acil Durum Sorumlusu Telefon</label>
                  <input
                    value={form.acilDurumSorumlusuTelefon}
                    onChange={e => set('acilDurumSorumlusuTelefon', e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* İşveren imza önizleme */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-information-line text-xs" style={{ color: '#DC2626' }} />
                  <span className="text-[10px] font-semibold" style={{ color: '#DC2626' }}>İşveren İmza Alanı</span>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  İşveren imza alanında <strong style={{ color: 'var(--text-primary)' }}>{form.firmaAdi || '(Firma Adı)'}</strong> yazacak. Buraya isim değil firma adı gelir — yukarıdaki "Firma / İşyeri Adı" alanından otomatik alınır.
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
