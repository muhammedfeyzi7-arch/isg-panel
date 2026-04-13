import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  TableOfContents, PageBreak,
} from 'docx';

export interface EK2DocxData {
  personelAd: string;
  personelGorev?: string;
  firmaAd: string;
  // Sağlık beyanı
  kronikHastaliklar?: string;
  ilacKullanim?: string;
  ameliyatGecmisi?: string;
  // Bulgular
  tansiyon?: string;
  nabiz?: string;
  gorme?: string;
  isitme?: string;
  // Karar
  sonuc: string;
  aciklama?: string;
  doktor?: string;
  hastane?: string;
  // Tarihler
  muayeneTarihi?: string;
  sonrakiTarih?: string;
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return d;
  }
}

function sonucLabel(s: string): string {
  if (s === 'uygun') return 'Çalışabilir';
  if (s === 'kisitli') return 'Kısıtlı Çalışabilir';
  if (s === 'uygun_degil') return 'Çalışamaz';
  return s;
}

function headerPara(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '0EA5E9', space: 4 },
    },
    run: {
      color: '0284C7',
      bold: true,
      size: 24,
    },
  });
}

function infoRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, fill: 'F1F5F9' },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 18, color: '64748B' })],
            spacing: { before: 60, after: 60 },
            indent: { left: 80 },
          }),
        ],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: value || '—', size: 20, color: '1E293B' })],
            spacing: { before: 60, after: 60 },
            indent: { left: 80 },
          }),
        ],
      }),
    ],
  });
}

export async function generateEK2Docx(data: EK2DocxData): Promise<void> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children: [
          // ── BAŞLIK ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: 'T.C. ÇALIŞMA VE SOSYAL GÜVENLİK BAKANLIĞI',
                bold: true,
                size: 18,
                color: '334155',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            border: {
              bottom: { style: BorderStyle.DOUBLE, size: 6, color: '0EA5E9', space: 6 },
            },
            children: [
              new TextRun({
                text: 'İŞYERİ HEKİMİ TARAFINDAN YAPILAN PERİYODİK MUAYENE FORMU (EK-2)',
                bold: true,
                size: 28,
                color: '0284C7',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `Muayene Tarihi: ${fmtDate(data.muayeneTarihi)}   |   Sonraki Kontrol: ${fmtDate(data.sonrakiTarih)}`,
                size: 18,
                color: '64748B',
                italics: true,
              }),
            ],
          }),

          // ── BÖLÜM 1: PERSONEL BİLGİLERİ ──
          headerPara('1. Personel Bilgileri'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow('Ad Soyad', data.personelAd),
              infoRow('Görev / Unvan', data.personelGorev || '—'),
              infoRow('Çalıştığı Firma', data.firmaAd),
              infoRow('Muayene Tarihi', fmtDate(data.muayeneTarihi)),
              infoRow('Sonraki Kontrol', fmtDate(data.sonrakiTarih)),
            ],
          }),

          // ── BÖLÜM 2: SAĞLIK BEYANI ──
          headerPara('2. Sağlık Beyanı (Anamnez)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow('Kronik Hastalıklar', data.kronikHastaliklar || 'Yok / Belirtilmemiş'),
              infoRow('Kullanılan İlaçlar', data.ilacKullanim || 'Yok / Belirtilmemiş'),
              infoRow('Ameliyat Geçmişi', data.ameliyatGecmisi || 'Yok / Belirtilmemiş'),
            ],
          }),

          // ── BÖLÜM 3: MUAYENE BULGULARI ──
          headerPara('3. Muayene Bulguları'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow('Tansiyon (mmHg)', data.tansiyon || 'Değerlendirilmedi'),
              infoRow('Nabız (atım/dk)', data.nabiz || 'Değerlendirilmedi'),
              infoRow('Görme', data.gorme || 'Değerlendirilmedi'),
              infoRow('İşitme', data.isitme || 'Değerlendirilmedi'),
            ],
          }),

          // ── BÖLÜM 4: HEKIM BİLGİSİ ──
          headerPara('4. Hekim Bilgisi'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow('İşyeri Hekimi', data.doktor || '—'),
              infoRow('Hastane / Klinik', data.hastane || '—'),
            ],
          }),

          // ── BÖLÜM 5: MUAYENE SONUCU ──
          headerPara('5. Muayene Sonucu ve Değerlendirme'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.SOLID, fill: 'F1F5F9' },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                    },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Muayene Kararı', bold: true, size: 18, color: '64748B' })],
                        spacing: { before: 80, after: 80 },
                        indent: { left: 80 },
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    shading: {
                      type: ShadingType.SOLID,
                      fill: data.sonuc === 'uygun' ? 'F0FDF4'
                        : data.sonuc === 'kisitli' ? 'FFFBEB'
                        : 'FFF1F2',
                    },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: sonucLabel(data.sonuc),
                            bold: true,
                            size: 22,
                            color: data.sonuc === 'uygun' ? '15803D'
                              : data.sonuc === 'kisitli' ? 'B45309'
                              : 'B91C1C',
                          }),
                        ],
                        spacing: { before: 80, after: 80 },
                        indent: { left: 80 },
                      }),
                    ],
                  }),
                ],
              }),
              infoRow('Açıklama / Kısıtlamalar', data.aciklama || '—'),
            ],
          }),

          // ── BÖLÜM 6: TARİHLER ──
          headerPara('6. Muayene Takip Tarihleri'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow('Muayene Tarihi', fmtDate(data.muayeneTarihi)),
              infoRow('Sonraki Muayene Tarihi', fmtDate(data.sonrakiTarih)),
            ],
          }),

          // ── İMZA ALANLARI ──
          new Paragraph({ spacing: { before: 560, after: 100 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                    },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Personel İmzası', bold: true, size: 18, color: '64748B' })],
                        spacing: { before: 80, after: 320 },
                        indent: { left: 80 },
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: data.personelAd, size: 18 })],
                        spacing: { after: 80 },
                        indent: { left: 80 },
                        border: { top: { style: BorderStyle.DASHED, size: 4, color: 'CBD5E1', space: 2 } },
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                    },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'İşyeri Hekimi İmzası / Mühür', bold: true, size: 18, color: '64748B' })],
                        spacing: { before: 80, after: 320 },
                        indent: { left: 80 },
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: data.doktor || '—', size: 18 })],
                        spacing: { after: 80 },
                        indent: { left: 80 },
                        border: { top: { style: BorderStyle.DASHED, size: 4, color: 'CBD5E1', space: 2 } },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Footer notu
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 280 },
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 6 } },
            children: [
              new TextRun({
                text: 'Bu belge 6331 sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında düzenlenmiştir.',
                italics: true,
                size: 16,
                color: '94A3B8',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

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
