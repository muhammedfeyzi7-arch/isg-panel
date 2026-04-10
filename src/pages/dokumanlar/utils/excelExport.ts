// @ts-expect-error no types for xlsx-js-style
import XLSXStyle from 'xlsx-js-style';

interface RiskRow {
  no: number;
  bolum: string;
  faaliyet: string;
  tehlikeKaynagi: string;
  tehlikeler: string;
  riskler: string;
  kimlerEtkilenir: string;
  mevcutDurum: string;
  o1: number;
  s1: number;
  f1: number;
  r1: number;
  riskTanimi1: string;
  planlamaAnalizSonucu: string;
  duzelticiTedbirler: string;
  sorumluluk: string;
  gerceklestirilenTedbirler: string;
  gercTarih: string;
  o2: number;
  s2: number;
  f2: number;
  r2: number;
  riskTanimi2: string;
  aciklama: string;
}

interface FirmaBilgileri {
  firmaAdi: string;
  adres: string;
  isverenAdi: string;
  revizyonNo: string;
  gerceklesmeTarihi: string;
  gecerlilikTarihi: string;
}

// ─── Renk Sabitleri ───────────────────────────────────────────────────────────
const DARK_BLUE  = '1E3A5F';
const RED_BG     = 'DC2626';
const ORANGE_BG  = 'EA580C';
const AMBER_BG   = 'D97706';
const GREEN_BG   = '16A34A';
const BLUE_BG    = '0284C7';
const LIGHT_RED  = 'FDECEA';
const LIGHT_GREEN= 'ECFDF5';
const LIGHT_GRAY = 'F1F5F9';
const HEADER_SUB = 'EFF6FF';
const WHITE      = 'FFFFFF';
const TEXT_DARK  = '111827';
const TEXT_GRAY  = '6B7280';

// ─── Yardımcı: Hücre oluştur ─────────────────────────────────────────────────
function cell(
  v: string | number,
  opts: {
    bold?: boolean;
    fontSize?: number;
    fgColor?: string;
    fontColor?: string;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'center' | 'bottom';
    wrap?: boolean;
    border?: boolean;
    italic?: boolean;
  } = {},
) {
  const {
    bold = false, fontSize = 9, fgColor, fontColor = TEXT_DARK,
    align = 'center', valign = 'center', wrap = true, border = true, italic = false,
  } = opts;

  const borderStyle = border
    ? { top: { style: 'thin', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } }
    : {};

  return {
    v,
    t: typeof v === 'number' ? 'n' : 's',
    s: {
      font: { name: 'Arial', sz: fontSize, bold, italic, color: { rgb: fontColor } },
      fill: fgColor ? { fgColor: { rgb: fgColor }, patternType: 'solid' } : { patternType: 'none' },
      alignment: { horizontal: align, vertical: valign, wrapText: wrap },
      border: borderStyle,
    },
  };
}

function emptyCell(fgColor?: string) {
  return cell('', { fgColor, border: true });
}

// ─── Risk rengi ──────────────────────────────────────────────────────────────
function getRiskColor(skor: number): string {
  if (skor >= 400) return RED_BG;
  if (skor >= 200) return ORANGE_BG;
  if (skor >= 70)  return AMBER_BG;
  if (skor >= 20)  return GREEN_BG;
  return BLUE_BG;
}

function getRiskLabel(skor: number): string {
  if (skor >= 400) return 'TOLERANS GÖSTERİLEMEZ';
  if (skor >= 200) return 'YÜKSEK RİSK';
  if (skor >= 70)  return 'ÖNEMLİ RİSK';
  if (skor >= 20)  return 'KESİN RİSK';
  return 'KABUL EDİLEBİLİR';
}

// ─── Ana Export Fonksiyonu ───────────────────────────────────────────────────
export function exportRiskToExcel(
  rows: RiskRow[],
  firma: FirmaBilgileri,
  sektor: string,
  fileName: string,
) {
  const wb = XLSXStyle.utils.book_new();
  const wsData: unknown[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  let R = 0; // satır sayacı

  // ═══════════════════════════════════════════════════════════════════════════
  // BÖLÜM 1: REFERANS TABLOLAR (4 tablo yan yana)
  // ═══════════════════════════════════════════════════════════════════════════

  // Başlık satırı — 4 tablo başlığı
  // Tablo sütun aralıkları:
  // Olasılık:       C0-C1   (2 sütun)
  // Şiddet:         C2-C3   (2 sütun)
  // Frekans:        C4-C5   (2 sütun)
  // Risk Derec.:    C6-C8   (3 sütun)
  // Toplam: 9 sütun (0-8)

  const refTitleStyle = { bold: true, fontSize: 9, fgColor: DARK_BLUE, fontColor: WHITE, align: 'center' as const };

  wsData.push([
    cell('OLASILIK DEĞERİ TABLOSU', refTitleStyle),
    emptyCell(DARK_BLUE),
    cell('ŞİDDET DEĞERİ TABLOSU', refTitleStyle),
    emptyCell(DARK_BLUE),
    cell('FREKANS DEĞERİ TABLOSU', refTitleStyle),
    emptyCell(DARK_BLUE),
    cell('RİSK DERECELENDİRME TABLOSU', refTitleStyle),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
  ]);
  merges.push(
    { s: { r: R, c: 0 }, e: { r: R, c: 1 } },
    { s: { r: R, c: 2 }, e: { r: R, c: 3 } },
    { s: { r: R, c: 4 }, e: { r: R, c: 5 } },
    { s: { r: R, c: 6 }, e: { r: R, c: 8 } },
  );
  R++;

  // Alt başlık satırı
  const subHdr = { bold: true, fontSize: 8, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'center' as const };
  wsData.push([
    cell('OLASILIK DEĞERİ', subHdr),
    cell('OLASILIK (Zararın gerçekleşme olasılığı)', subHdr),
    cell('ŞİDDET DEĞERİ', subHdr),
    cell('ŞİDDET (İnsan ve/veya çevre üzerine yaratacağı tahmin)', subHdr),
    cell('FREKANS DEĞERİ', subHdr),
    cell('FREKANS (Tehlikeye zaman içinde maruz kalma)', subHdr),
    cell('RİSK DEĞERİ', subHdr),
    cell('RİSK DEĞERLENDİRME SONUCU', { ...subHdr }),
    emptyCell(HEADER_SUB),
  ]);
  merges.push({ s: { r: R, c: 7 }, e: { r: R, c: 8 } });
  R++;

  // Referans veri satırları
  const OLASILIK = [
    { deger: 10, aciklama: 'Beklenir, kesin' },
    { deger: 6,  aciklama: 'Yüksek, oldukça mümkün' },
    { deger: 3,  aciklama: 'Olası' },
    { deger: 1,  aciklama: 'Mümkün fakat düşük' },
    { deger: 0.5,aciklama: 'Beklenmesi fakat mümkün' },
    { deger: 0.2,aciklama: 'Beklenmez' },
  ];
  const SIDDET = [
    { deger: 100, aciklama: 'Birden fazla ölümlü kaza/Çevresel felaket' },
    { deger: 40,  aciklama: 'Ölümlü kaza/Büyük çevresel zarar' },
    { deger: 15,  aciklama: 'Kalıcı hasar/Yaralanma, iş kaybı/Çevresel engel oluşturma, yakın çevreden şikayet' },
    { deger: 7,   aciklama: 'Önemli yaralanma, ilk yardım ihtiyacı/Arazi sınırları dışında çevresel zarar' },
    { deger: 3,   aciklama: 'Küçük hasar/Yaralanma, dahili ilk yardım/Arazi içinde sınırlı çevresel zarar' },
    { deger: 1,   aciklama: 'Ucuz atlatma/Çevresel zarar yok' },
  ];
  const FREKANS = [
    { deger: 10,  aciklama: 'Hemen hemen sürekli (bir saatte birkaç defa)' },
    { deger: 6,   aciklama: 'Sık (günde bir veya birkaç defa)' },
    { deger: 3,   aciklama: 'Ara sıra (haftada bir veya birkaç defa)' },
    { deger: 2,   aciklama: 'Sık değil (ayda bir veya birkaç defa)' },
    { deger: 1,   aciklama: 'Seyrek (yılda birkaç defa)' },
    { deger: 0.5, aciklama: 'Çok seyrek (yılda bir veya daha seyrek)' },
  ];
  const RISK_DEREC = [
    { aralik: 'R≥400',       label: 'TOLERANS GÖSTERİLEMEZ RİSK (Çok yüksek risk)', aciklama: 'Hemen gerekli önlemler alınmalı veya iş durdurulmalı, tesisin, binanın kapatılması vb. düşünülmelidir.', bg: RED_BG },
    { aralik: '200≤R<400',   label: 'YÜKSEK RİSK (Esaslı risk)', aciklama: 'En kısa dönemde iyileştirilmeli (bir hafta içerisinde)', bg: ORANGE_BG },
    { aralik: '70≤R<200',    label: 'ÖNEMLİ RİSK', aciklama: 'Kısa dönemde iyileştirilmeli (1 hafta içerisinde)', bg: AMBER_BG },
    { aralik: '20≤R<70',     label: 'KESİN RİSK (Olası risk)', aciklama: 'Gözetim altında uygulanmalıdır', bg: GREEN_BG },
    { aralik: 'R≤20',        label: 'KABUL EDİLEBİLİR RİSK (Önemsiz risk)', aciklama: 'Önlem öncelikli değil', bg: BLUE_BG },
  ];

  const maxRefRows = Math.max(OLASILIK.length, SIDDET.length, FREKANS.length, RISK_DEREC.length);

  for (let i = 0; i < maxRefRows; i++) {
    const o = OLASILIK[i];
    const s = SIDDET[i];
    const f = FREKANS[i];
    const rd = RISK_DEREC[i];

    wsData.push([
      o ? cell(o.deger, { bold: true, fontSize: 9, fgColor: 'EFF6FF', fontColor: BLUE_BG, align: 'center' }) : emptyCell(),
      o ? cell(o.aciklama, { fontSize: 8, align: 'left', fgColor: WHITE }) : emptyCell(),
      s ? cell(s.deger, { bold: true, fontSize: 9, fgColor: 'FFF7ED', fontColor: ORANGE_BG, align: 'center' }) : emptyCell(),
      s ? cell(s.aciklama, { fontSize: 8, align: 'left', fgColor: WHITE }) : emptyCell(),
      f ? cell(f.deger, { bold: true, fontSize: 9, fgColor: 'F0FDF4', fontColor: GREEN_BG, align: 'center' }) : emptyCell(),
      f ? cell(f.aciklama, { fontSize: 8, align: 'left', fgColor: WHITE }) : emptyCell(),
      rd ? cell(rd.aralik, { bold: true, fontSize: 9, fgColor: rd.bg, fontColor: WHITE, align: 'center' }) : emptyCell(),
      rd ? cell(rd.label, { bold: true, fontSize: 8, fgColor: rd.bg, fontColor: WHITE, align: 'left' }) : emptyCell(),
      rd ? cell(rd.aciklama, { fontSize: 7, fgColor: rd.bg, fontColor: WHITE, align: 'left' }) : emptyCell(),
    ]);
    R++;
  }

  // Boş ayırıcı satır
  wsData.push(Array(9).fill(emptyCell(WHITE)));
  R++;

  // ═══════════════════════════════════════════════════════════════════════════
  // BÖLÜM 2: FİRMA BİLGİLERİ BAŞLIK
  // ═══════════════════════════════════════════════════════════════════════════

  // Ana başlık — firma adı + rapor adı
  // Ana tablo 23 sütun olacak (A-W), referans tablolar 9 sütun
  // Firma başlığını 23 sütuna yayacağız
  const TOTAL_COLS = 23;

  const firmaRow: unknown[] = [
    cell(firma.firmaAdi || 'FİRMA ADI', { bold: true, fontSize: 11, fgColor: DARK_BLUE, fontColor: WHITE, align: 'left' }),
    ...Array(10).fill(emptyCell(DARK_BLUE)),
    cell('RİSK DEĞERLENDİRME RAPORU ANALİZ FORMU', { bold: true, fontSize: 11, fgColor: DARK_BLUE, fontColor: WHITE, align: 'center' }),
    ...Array(10).fill(emptyCell(DARK_BLUE)),
  ];
  wsData.push(firmaRow);
  merges.push(
    { s: { r: R, c: 0 }, e: { r: R, c: 10 } },
    { s: { r: R, c: 11 }, e: { r: R, c: TOTAL_COLS - 1 } },
  );
  R++;

  // İşveren + Adres satırı
  const isverenRow: unknown[] = [
    cell('İşveren Adı Soyadı', { bold: true, fontSize: 8, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'left' }),
    cell(firma.isverenAdi || '', { fontSize: 9, fgColor: WHITE, align: 'left' }),
    ...Array(3).fill(emptyCell(WHITE)),
    cell('Adres', { bold: true, fontSize: 8, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'left' }),
    cell(firma.adres || '', { fontSize: 9, fgColor: WHITE, align: 'left' }),
    ...Array(16).fill(emptyCell(WHITE)),
  ];
  wsData.push(isverenRow);
  merges.push(
    { s: { r: R, c: 1 }, e: { r: R, c: 4 } },
    { s: { r: R, c: 6 }, e: { r: R, c: TOTAL_COLS - 1 } },
  );
  R++;

  // Revizyon / Tarih satırı
  const revRow: unknown[] = [
    cell('Sektör', { bold: true, fontSize: 8, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'center' }),
    cell(sektor || '', { fontSize: 9, fgColor: WHITE, align: 'center' }),
    emptyCell(WHITE),
    cell('Revizyon No.', { bold: true, fontSize: 8, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'center' }),
    cell(firma.revizyonNo || '0', { fontSize: 9, fgColor: WHITE, align: 'center' }),
    cell('Revizyon Tarihi', { bold: true, fontSize: 8, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'center' }),
    emptyCell(WHITE),
    cell('Gerçekleşme Tarihi', { bold: true, fontSize: 8, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'center' }),
    cell(firma.gerceklesmeTarihi || '', { fontSize: 9, fgColor: WHITE, align: 'center' }),
    cell('Geçerlilik Tarihi', { bold: true, fontSize: 8, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'center' }),
    cell(firma.gecerlilikTarihi || '', { fontSize: 9, fgColor: WHITE, align: 'center' }),
    cell('Bu risk analizinde yöntem olarak Fine-Kinney metodu kullanılmıştır.', { fontSize: 8, italic: true, fgColor: HEADER_SUB, fontColor: TEXT_GRAY, align: 'center' }),
    ...Array(TOTAL_COLS - 12).fill(emptyCell(HEADER_SUB)),
  ];
  wsData.push(revRow);
  merges.push(
    { s: { r: R, c: 1 }, e: { r: R, c: 2 } },
    { s: { r: R, c: 11 }, e: { r: R, c: TOTAL_COLS - 1 } },
  );
  R++;

  // ═══════════════════════════════════════════════════════════════════════════
  // BÖLÜM 3: ANA TABLO BAŞLIKLARI
  // ═══════════════════════════════════════════════════════════════════════════

  // Sütun yapısı (0-indexed):
  // 0: S.No
  // 1: Bölüm
  // 2: Faaliyet
  // 3: Tehlike Kaynağı
  // 4: Tehlikeler
  // 5: Riskler
  // 6: Kimler Etkilenir
  // 7: Mevcut Durum
  // 8: O1
  // 9: Ş1
  // 10: F1
  // 11: R1 / Risk Tanımı
  // 12: Planlama ve Analiz Sonucu
  // 13: Düzeltici/Önleyici Kontrol Tedbirleri
  // 14: Sorumluluk
  // 15: Gerçekleştirilen Tedbirler
  // 16: Tarih
  // 17: O2
  // 18: Ş2
  // 19: F2
  // 20: R2 / Risk Tanımı
  // 21: Açıklama
  // 22: (boş)

  // Üst grup başlıkları
  const grpHdr = (v: string, bg: string, fc: string = WHITE) =>
    cell(v, { bold: true, fontSize: 9, fgColor: bg, fontColor: fc, align: 'center' });

  const groupRow: unknown[] = [
    grpHdr('S.No', DARK_BLUE),
    grpHdr('TEHLİKELERE GÖRE MEVCUT DURUM RİSK SEVİYESİNİN TESPİT TABLOSU', DARK_BLUE),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
    grpHdr('MEVCUT RİSK', RED_BG),
    emptyCell(RED_BG),
    emptyCell(RED_BG),
    emptyCell(RED_BG),
    grpHdr('YAPILACAK/GERÇEKLEŞTİRİLEN DÜZELTİCİ/ÖNLEYİCİ FAALİYET TESPİT TABLOSU', DARK_BLUE),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
    emptyCell(DARK_BLUE),
    grpHdr('SONRAKI RİSK', GREEN_BG),
    emptyCell(GREEN_BG),
    emptyCell(GREEN_BG),
    emptyCell(GREEN_BG),
    grpHdr('AÇIKLAMA', DARK_BLUE),
    emptyCell(DARK_BLUE),
  ];
  wsData.push(groupRow);
  merges.push(
    { s: { r: R, c: 1 }, e: { r: R, c: 7 } },
    { s: { r: R, c: 8 }, e: { r: R, c: 11 } },
    { s: { r: R, c: 12 }, e: { r: R, c: 16 } },
    { s: { r: R, c: 17 }, e: { r: R, c: 20 } },
    { s: { r: R, c: 21 }, e: { r: R, c: 22 } },
  );
  R++;

  // Alt başlıklar
  const colHdr = (v: string, bg: string = HEADER_SUB, fc: string = TEXT_DARK) =>
    cell(v, { bold: true, fontSize: 8, fgColor: bg, fontColor: fc, align: 'center', wrap: true });

  const subHeaders: unknown[] = [
    colHdr('S.A NO'),
    colHdr('BÖLÜM'),
    colHdr('FAALİYET'),
    colHdr('TEHLİKE KAYNAĞI'),
    colHdr('TEHLİKELER'),
    colHdr('RİSKLER'),
    colHdr('KİMLER ETKİLENEBİLİR'),
    colHdr('MEVCUT DURUM'),
    colHdr('O', 'FDECEA', RED_BG),
    colHdr('Ş', 'FDECEA', RED_BG),
    colHdr('F', 'FDECEA', RED_BG),
    colHdr('RİSK\nTANIMI', 'FDECEA', RED_BG),
    colHdr('PLANLAMA VE ANALİZ SONUCU'),
    colHdr('DÜZELTİCİ/ÖNLEYİCİ KONTROL TEDBİRLERİ'),
    colHdr('SORUMLULUK /RİSİ'),
    colHdr('GERÇEKLEŞTİRİLEN DÜZELTİCİ/ÖNLEYİCİ KONTROL TEDBİRLERİ'),
    colHdr('GERÇEKLEŞTİRİLEN TARİH'),
    colHdr('O', 'ECFDF5', GREEN_BG),
    colHdr('Ş', 'ECFDF5', GREEN_BG),
    colHdr('F', 'ECFDF5', GREEN_BG),
    colHdr('RİSK\nTANIMI', 'ECFDF5', GREEN_BG),
    colHdr('AÇIKLAMA'),
    emptyCell(HEADER_SUB),
  ];
  wsData.push(subHeaders);
  R++;

  // ═══════════════════════════════════════════════════════════════════════════
  // BÖLÜM 4: VERİ SATIRLARI
  // ═══════════════════════════════════════════════════════════════════════════

  rows.forEach((row, i) => {
    const isEven = i % 2 === 0;
    const rowBg = isEven ? WHITE : 'F8FAFC';

    const riskColor1 = getRiskColor(row.r1);
    const riskLabel1 = `${row.r1}\n${getRiskLabel(row.r1)}`;
    const riskColor2 = getRiskColor(row.r2);
    const riskLabel2 = `${row.r2}\n${getRiskLabel(row.r2)}`;

    const dc = (v: string | number, bg?: string) =>
      cell(v, { fontSize: 8, fgColor: bg || rowBg, align: 'left', valign: 'top', wrap: true });
    const cc = (v: string | number, bg?: string, fc?: string) =>
      cell(v, { fontSize: 8, fgColor: bg || rowBg, fontColor: fc || TEXT_DARK, align: 'center', valign: 'center', wrap: true });

    wsData.push([
      cc(row.no, rowBg, TEXT_GRAY),
      dc(row.bolum),
      dc(row.faaliyet),
      dc(row.tehlikeKaynagi),
      dc(row.tehlikeler),
      dc(row.riskler),
      dc(row.kimlerEtkilenir),
      dc(row.mevcutDurum),
      // Mevcut risk
      cc(row.o1, 'FDECEA', RED_BG),
      cc(row.s1, 'FDECEA', RED_BG),
      cc(row.f1, 'FDECEA', RED_BG),
      cell(riskLabel1, { bold: true, fontSize: 9, fgColor: riskColor1, fontColor: WHITE, align: 'center', valign: 'center', wrap: true }),
      // Planlama
      dc(row.planlamaAnalizSonucu),
      dc(row.duzelticiTedbirler),
      dc(row.sorumluluk),
      dc(row.gerceklestirilenTedbirler),
      dc(row.gercTarih),
      // Sonraki risk
      cc(row.o2, 'ECFDF5', GREEN_BG),
      cc(row.s2, 'ECFDF5', GREEN_BG),
      cc(row.f2, 'ECFDF5', GREEN_BG),
      cell(riskLabel2, { bold: true, fontSize: 9, fgColor: riskColor2, fontColor: WHITE, align: 'center', valign: 'center', wrap: true }),
      dc(row.aciklama),
      emptyCell(rowBg),
    ]);
    R++;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSHEET OLUŞTUR
  // ═══════════════════════════════════════════════════════════════════════════

  const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
  ws['!merges'] = merges;

  // Sütun genişlikleri (wch = karakter genişliği)
  ws['!cols'] = [
    { wch: 5 },   // S.No
    { wch: 12 },  // Bölüm
    { wch: 14 },  // Faaliyet
    { wch: 16 },  // Tehlike Kaynağı
    { wch: 18 },  // Tehlikeler
    { wch: 18 },  // Riskler
    { wch: 14 },  // Kimler Etkilenir
    { wch: 16 },  // Mevcut Durum
    { wch: 5 },   // O1
    { wch: 5 },   // Ş1
    { wch: 5 },   // F1
    { wch: 14 },  // R1
    { wch: 20 },  // Planlama
    { wch: 22 },  // Düzeltici
    { wch: 12 },  // Sorumluluk
    { wch: 22 },  // Gerçekleştirilen
    { wch: 10 },  // Tarih
    { wch: 5 },   // O2
    { wch: 5 },   // Ş2
    { wch: 5 },   // F2
    { wch: 14 },  // R2
    { wch: 18 },  // Açıklama
    { wch: 4 },   // boş
  ];

  // Satır yükseklikleri
  const rowHeights: { hpt: number }[] = [];
  // Referans tablo başlıkları
  rowHeights.push({ hpt: 18 }); // başlık
  rowHeights.push({ hpt: 22 }); // alt başlık
  for (let i = 0; i < maxRefRows; i++) rowHeights.push({ hpt: 30 });
  rowHeights.push({ hpt: 6 }); // boş
  // Firma bilgileri
  rowHeights.push({ hpt: 22 }); // firma başlık
  rowHeights.push({ hpt: 20 }); // işveren/adres
  rowHeights.push({ hpt: 18 }); // revizyon
  // Tablo başlıkları
  rowHeights.push({ hpt: 20 }); // grup başlık
  rowHeights.push({ hpt: 28 }); // alt başlık
  // Veri satırları
  rows.forEach(() => rowHeights.push({ hpt: 50 }));

  ws['!rows'] = rowHeights;

  XLSXStyle.utils.book_append_sheet(wb, ws, 'Risk Analizi');

  const cleanName = fileName.replace(/\.xlsx$/i, '');
  XLSXStyle.writeFile(wb, `${cleanName}.xlsx`);
}
