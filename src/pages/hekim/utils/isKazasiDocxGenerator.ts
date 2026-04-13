import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
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
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
};

function fmtDate(d?: string): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

function fmtDateLong(d?: string): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return d; }
}

function headerPara(text: string, color = 'B91C1C'): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 4 },
    },
    run: {
      color,
      bold: true,
      size: 24,
    },
  });
}

function infoRow(label: string, value: string, highlight = false): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, fill: 'F8FAFC' },
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
        width: { size: 65, type: WidthType.PERCENTAGE },
        shading: highlight ? { type: ShadingType.SOLID, fill: 'FFF1F2' } : undefined,
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
                text: value || '—',
                size: 20,
                color: highlight ? '9F1239' : '1E293B',
                bold: highlight,
              }),
            ],
            spacing: { before: 60, after: 60 },
            indent: { left: 80 },
          }),
        ],
      }),
    ],
  });
}

function textBlock(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text || '—', size: 20, color: '334155' })],
    spacing: { before: 60, after: 60, line: 360 },
    indent: { left: 80, right: 80 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      left: { style: BorderStyle.SINGLE, size: 6, color: 'EF4444' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    },
  });
}

export async function generateIsKazasiDocx(data: IsKazasiDocxData): Promise<void> {
  const raporNo = `IK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  const bolgeLabels = (data.yaraliVucutBolgeleri ?? []).map(id => VUCUT_LABEL[id] ?? id).join(', ') || '—';
  const besNedenFiltered = (data.besNeden ?? []).filter(n => n.neden);

  const children: (Paragraph | Table)[] = [
    // Başlık
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'T.C. ÇALIŞMA VE SOSYAL GÜVENLİK BAKANLIĞI',
          bold: true, size: 18, color: '334155',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      border: {
        bottom: { style: BorderStyle.DOUBLE, size: 6, color: 'EF4444', space: 6 },
      },
      children: [
        new TextRun({
          text: 'İŞ KAZASI TUTANAĞI',
          bold: true, size: 32, color: 'B91C1C',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Rapor No: ${raporNo}   |   Tarih: ${fmtDateLong(data.kazaTarihi)}`,
          size: 18, color: '64748B', italics: true,
        }),
      ],
    }),

    // ── 1. GENEL BİLGİLER ──
    headerPara('1. Genel Bilgiler'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoRow('Firma / İşyeri', data.firmaAd),
        infoRow('Kazazede', data.personelAd),
        infoRow('Görev / Unvan', data.personelGorev || '—'),
        infoRow('Kaza Tarihi', fmtDateLong(data.kazaTarihi)),
        infoRow('Kaza Saati', data.kazaSaati || '—'),
        infoRow('Kaza Yeri', data.kazaYeri || '—'),
        infoRow('Kaza Türü', data.kazaTuru || '—'),
        infoRow('Kaza Tipi', KAZA_TIPI_MAP[data.kazaTipi ?? ''] || data.kazaTipi || '—'),
        infoRow('Risk Seviyesi', RISK_MAP[data.riskSeviyesi ?? ''] || data.riskSeviyesi || '—'),
      ],
    }),

    // ── 2. KAZA AÇIKLAMASI ──
    headerPara('2. Kaza Açıklaması'),
    textBlock(data.kazaAciklamasi || '—'),

    // ── 3. YARALANMA BİLGİSİ ──
    headerPara('3. Yaralanma Bilgisi', 'F97316'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoRow('Yaralanan Bölgeler', bolgeLabels, !!(data.yaraliVucutBolgeleri ?? []).length),
        infoRow('Yaralanma Türü', data.yaralanmaTuru || '—'),
        infoRow('Yaralanma Şiddeti', data.yaralanmaSiddeti || '—', true),
        infoRow('İş Günü Kaybı', data.isGunuKaybi ? `${data.isGunuKaybi} gün` : 'Yok'),
        infoRow('Hastaneye Kaldırıldı', data.hastaneyeKaldirildi ? 'Evet' : 'Hayır'),
        infoRow('Hastane Adı', data.hastaneAdi || '—'),
      ],
    }),
  ];

  // ── 4. SGK BİLDİRİMİ ──
  children.push(headerPara('4. SGK Bildirimi', '4C1D95'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoRow('SGK\'ya Bildirildi', data.sgkBildirildi ? 'Evet' : 'Hayır'),
        infoRow('Bildirim Tarihi', data.sgkBildirimTarihi ? fmtDate(data.sgkBildirimTarihi) : '—'),
        infoRow('Bildirim Notu', data.sgkBildirimNotu || '—'),
      ],
    }),
  );

  // ── 5. 5 NEDEN ANALİZİ ──
  if (besNedenFiltered.length > 0) {
    children.push(headerPara('5. 5 Neden Kök Neden Analizi', '065F46'));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: besNedenFiltered.map((item, idx) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, fill: 'F0FDF4' },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(idx + 1), bold: true, size: 22, color: '15803D' })],
                    spacing: { before: 60, after: 60 },
                  }),
                ],
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: item.neden, size: 20, color: '1E293B' })],
                    spacing: { before: 60, after: 60 },
                    indent: { left: 80 },
                  }),
                ],
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, fill: 'F8FAFC' },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: item.aciklama || '—', size: 18, color: '64748B', italics: true })],
                    spacing: { before: 60, after: 60 },
                    indent: { left: 80 },
                  }),
                ],
              }),
            ],
          }),
        ),
      }),
    );
  }

  // ── 6. ALINAN ÖNLEMLER ──
  children.push(headerPara('6. Alınan Önlemler', '065F46'));
  children.push(textBlock(data.onlemler || 'Belirtilmemiş'));

  // ── 7. SONUÇ / DURUM ──
  children.push(headerPara('7. Soruşturma Sonucu ve Kayıt Durumu', '334155'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoRow('Tanık Bilgileri', data.tanikBilgileri || '—'),
        infoRow('Kayıt Durumu', data.durum || '—', data.durum === 'Açık'),
        infoRow('Hekim / Hazırlayan', data.doktor || 'İşyeri Hekimi'),
        infoRow('Rapor Tarihi', fmtDateLong(new Date().toISOString())),
      ],
    }),
  );

  // ── İMZA ALANLARI ──
  children.push(new Paragraph({ spacing: { before: 560 } }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Kazazede / Çalışan', bold: true, size: 18, color: '64748B' })],
                  spacing: { before: 80, after: 300 },
                  indent: { left: 80 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: data.personelAd, size: 18 })],
                  spacing: { after: 60 },
                  indent: { left: 80 },
                  border: { top: { style: BorderStyle.DASHED, size: 4, color: 'CBD5E1', space: 2 } },
                }),
              ],
            }),
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'İşveren Vekili', bold: true, size: 18, color: '64748B' })],
                  spacing: { before: 80, after: 300 },
                  indent: { left: 80 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: '___________________', size: 18, color: '94A3B8' })],
                  spacing: { after: 60 },
                  indent: { left: 80 },
                  border: { top: { style: BorderStyle.DASHED, size: 4, color: 'CBD5E1', space: 2 } },
                }),
              ],
            }),
            new TableCell({
              width: { size: 34, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'İşyeri Hekimi / ISG Uzmanı', bold: true, size: 18, color: '64748B' })],
                  spacing: { before: 80, after: 300 },
                  indent: { left: 80 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: data.doktor || 'İşyeri Hekimi', size: 18 })],
                  spacing: { after: 60 },
                  indent: { left: 80 },
                  border: { top: { style: BorderStyle.DASHED, size: 4, color: 'CBD5E1', space: 2 } },
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  // Footer
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 280 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 6 } },
      children: [
        new TextRun({
          text: `Bu belge 6331 sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında düzenlenmiştir.   Rapor No: ${raporNo}`,
          italics: true, size: 16, color: '94A3B8',
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children,
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
  const dateStr = data.kazaTarihi
    ? new Date(data.kazaTarihi).toLocaleDateString('tr-TR').replace(/\./g, '-')
    : new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  a.download = `IsKazasi-Tutanak-${data.personelAd.replace(/\s+/g, '-')}-${dateStr}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
