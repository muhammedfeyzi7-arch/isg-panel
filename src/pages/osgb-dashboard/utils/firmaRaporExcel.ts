import type ExcelJS from 'exceljs';
import { setWorkbookMetadata, addWatermark, addFooter, protectSheet } from '@/utils/excelProtection';
import { supabase } from '@/lib/supabase';

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  'Aktif':           { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Pasif':           { fg: 'FFD97706', bg: 'FFFEF3C7' },
  'Ayrıldı':         { fg: 'FFDC2626', bg: 'FFFEE2E2' },
  'Açık':            { fg: 'FFDC2626', bg: 'FFFEE2E2' },
  'Kapandı':         { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Kapatıldı':       { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Tamamlandı':      { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Planlandı':       { fg: 'FF1D4ED8', bg: 'FFDBEAFE' },
  'Eksik':           { fg: 'FFDC2626', bg: 'FFFEE2E2' },
  'Yüklü':           { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Süre Dolmuş':     { fg: 'FFD97706', bg: 'FFFEF3C7' },
  'Uygun':           { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Bakımda':         { fg: 'FFD97706', bg: 'FFFEF3C7' },
  'Uygun Değil':     { fg: 'FFDC2626', bg: 'FFFEE2E2' },
  'Hurda':           { fg: 'FF64748B', bg: 'FFF1F5F9' },
  'Az Tehlikeli':    { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Tehlikeli':       { fg: 'FFD97706', bg: 'FFFEF3C7' },
  'Çok Tehlikeli':   { fg: 'FFDC2626', bg: 'FFFEE2E2' },
  'Kritik':          { fg: 'FFDC2626', bg: 'FFFEE2E2' },
  'Yüksek':          { fg: 'FFEA580C', bg: 'FFFFEDD5' },
  'Orta':            { fg: 'FFD97706', bg: 'FFFEF3C7' },
  'Düşük':           { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Güncel':          { fg: 'FF16A34A', bg: 'FFDCFCE7' },
  'Yaklaşıyor':      { fg: 'FFD97706', bg: 'FFFEF3C7' },
  'Süresi Geçmiş':   { fg: 'FFDC2626', bg: 'FFFEE2E2' },
};

const STATUS_COL_KEYS = ['Durum', 'Tehlike Sınıfı', 'Seviye', 'Sonuç'];

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
const calcDays = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - n.getTime()) / 86400000);
};

function applyBrandedHeader(ws: ExcelJS.Worksheet, colCount: number, title: string, subtitle: string) {
  addWatermark(ws, colCount);
  ws.mergeCells(2, 1, 2, colCount);
  ws.mergeCells(3, 1, 3, colCount);
  ws.mergeCells(4, 1, 4, colCount);
  const r2 = ws.getRow(2); r2.height = 32;
  const r3 = ws.getRow(3); r3.height = 26;
  const r4 = ws.getRow(4); r4.height = 18;
  const c2 = ws.getCell(2, 1);
  c2.value = 'ISG DENETİM YÖNETİM SİSTEMİ';
  c2.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF020817' } };
  c2.alignment = { horizontal: 'left', vertical: 'middle' };
  const c3 = ws.getCell(3, 1);
  c3.value = title;
  c3.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1E' } };
  c3.alignment = { horizontal: 'left', vertical: 'middle' };
  const c4 = ws.getCell(4, 1);
  c4.value = subtitle;
  c4.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
  c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  c4.alignment = { horizontal: 'left', vertical: 'middle' };
}

function applyColHeader(ws: ExcelJS.Worksheet, cols: string[], rowNum = 5) {
  const row = ws.getRow(rowNum); row.height = 22;
  cols.forEach((h, ci) => {
    const cell = row.getCell(ci + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF0EA5E9' } } };
  });
}

function applyDataRows(
  ws: ExcelJS.Worksheet,
  rows: (string | number | null)[][],
  cols: string[],
  startRow = 6
) {
  rows.forEach((rowVals, ri) => {
    const exRow = ws.getRow(startRow + ri);
    exRow.height = Math.max(20, Math.min(60, 20));
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0F9FF';
    rowVals.forEach((val, ci) => {
      const cell = exRow.getCell(ci + 1);
      cell.value = val ?? '';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
      if (ci === 0) {
        cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (typeof val === 'number' && ci > 0) {
        cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF1E3A5F' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      const colName = cols[ci] ?? '';
      if (STATUS_COL_KEYS.some(k => colName.includes(k))) {
        const sc = STATUS_COLORS[String(val)];
        if (sc) {
          cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: sc.fg } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }
    });
  });
}

function buildSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  subtitle: string,
  cols: string[],
  rows: (string | number | null)[][],
  colWidths: number[]
) {
  const ws = wb.addWorksheet(sheetName);
  ws.columns = colWidths.map(w => ({ width: w }));
  applyBrandedHeader(ws, cols.length, title, subtitle);
  applyColHeader(ws, cols);
  applyDataRows(ws, rows, cols);
  ws.views = [{ state: 'frozen', ySplit: 5 }];
  addFooter(ws, rows.length + 5, cols.length);
  protectSheet(ws);
  return ws;
}

// ── Ana Firma Excel Raporu ──────────────────────────────────────────────────
export async function buildFirmaRapor(firmaId: string, firmaAdi: string): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  setWorkbookMetadata(wb);

  const now = new Date();
  const tarih = now.toLocaleDateString('tr-TR');
  const tarihDosya = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

  // ── Veri çek ──
  const [
    { data: personelData },
    { data: evrakData },
    { data: egitimData },
    { data: muayeneData },
    { data: uygunsuzlukData },
    { data: ekipmanData },
    { data: tutanakData },
    { data: isIzniData },
  ] = await Promise.all([
    supabase.from('personeller').select('data').eq('organization_id', firmaId).is('deleted_at', null),
    supabase.from('evraklar').select('data').eq('organization_id', firmaId).is('deleted_at', null),
    supabase.from('egitimler').select('data').eq('organization_id', firmaId).is('deleted_at', null),
    supabase.from('muayeneler').select('data').eq('organization_id', firmaId).is('deleted_at', null),
    supabase.from('uygunsuzluklar').select('data').eq('organization_id', firmaId).is('deleted_at', null),
    supabase.from('ekipmanlar').select('data').eq('organization_id', firmaId).is('deleted_at', null),
    supabase.from('tutanaklar').select('data').eq('organization_id', firmaId).is('deleted_at', null),
    supabase.from('is_izinleri').select('data').eq('organization_id', firmaId).is('deleted_at', null),
  ]);

  const personeller = (personelData ?? []).map(r => r.data as Record<string, unknown>);
  const evraklar = (evrakData ?? []).map(r => r.data as Record<string, unknown>);
  const egitimler = (egitimData ?? []).map(r => r.data as Record<string, unknown>);
  const muayeneler = (muayeneData ?? []).map(r => r.data as Record<string, unknown>);
  const uygunsuzluklar = (uygunsuzlukData ?? []).map(r => r.data as Record<string, unknown>);
  const ekipmanlar = (ekipmanData ?? []).map(r => r.data as Record<string, unknown>);
  const tutanaklar = (tutanakData ?? []).map(r => r.data as Record<string, unknown>);
  const isIzinleri = (isIzniData ?? []).map(r => r.data as Record<string, unknown>);

  // ── SAYFA 1: ÖZET ──
  const ozetWs = wb.addWorksheet('Genel Özet');
  ozetWs.columns = [{ width: 30 }, { width: 16 }, { width: 30 }, { width: 16 }];
  addWatermark(ozetWs, 4);
  ozetWs.mergeCells(2, 1, 2, 4); ozetWs.mergeCells(3, 1, 3, 4); ozetWs.mergeCells(4, 1, 4, 4);
  const oR2 = ozetWs.getRow(2); oR2.height = 32;
  const oR3 = ozetWs.getRow(3); oR3.height = 26;
  const oR4 = ozetWs.getRow(4); oR4.height = 18;
  const oC2 = ozetWs.getCell(2, 1);
  oC2.value = 'ISG DENETİM YÖNETİM SİSTEMİ';
  oC2.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  oC2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF020817' } };
  oC2.alignment = { horizontal: 'left', vertical: 'middle' };
  const oC3 = ozetWs.getCell(3, 1);
  oC3.value = `GENEL ÖZET RAPORU — ${firmaAdi.toUpperCase()}`;
  oC3.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  oC3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1E' } };
  oC3.alignment = { horizontal: 'left', vertical: 'middle' };
  const oC4 = ozetWs.getCell(4, 1);
  oC4.value = `Rapor Tarihi: ${tarih}  |  Firma: ${firmaAdi}`;
  oC4.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
  oC4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  oC4.alignment = { horizontal: 'left', vertical: 'middle' };
  applyColHeader(ozetWs, ['Kategori', 'Toplam', 'Alt Bilgi', 'Değer']);
  const aktifPersonel = personeller.filter(p => (p.durum as string) === 'Aktif').length;
  const sorunluEvrak = evraklar.filter(e => (e.durum as string) === 'Eksik' || (e.durum as string) === 'Süre Dolmuş').length;
  const acikUyg = uygunsuzluklar.filter(u => (u.durum as string) !== 'Kapandı' && (u.durum as string) !== 'Kapatıldı').length;
  const uygunDegil = ekipmanlar.filter(e => (e.durum as string) === 'Uygun Değil').length;
  const muayeneGecmis = muayeneler.filter(m => (calcDays(m.sonrakiTarih as string) ?? 1) < 0).length;

  const ozetRows = [
    ['Toplam Personel', personeller.length, 'Aktif Personel', aktifPersonel],
    ['Toplam Evrak', evraklar.length, 'Sorunlu Evrak', sorunluEvrak],
    ['Toplam Eğitim', egitimler.length, 'Tamamlanan', egitimler.filter(e => (e.durum as string) === 'Tamamlandı').length],
    ['Sağlık Takibi', muayeneler.length, 'Süresi Geçmiş', muayeneGecmis],
    ['Açık Uygunsuzluk', acikUyg, 'Kapatılan', uygunsuzluklar.length - acikUyg],
    ['Toplam Ekipman', ekipmanlar.length, 'Uygun Değil', uygunDegil],
    ['Tutanaklar', tutanaklar.length, 'Onaylı', tutanaklar.filter(t => (t.durum as string) === 'Onaylandı').length],
    ['İş İzinleri', isIzinleri.length, 'Aktif İzin', isIzinleri.filter(i => (i.durum as string) === 'Onaylandı').length],
  ];
  ozetRows.forEach((row, ri) => {
    const exRow = ozetWs.getRow(6 + ri); exRow.height = 22;
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0F9FF';
    row.forEach((val, ci) => {
      const cell = exRow.getCell(ci + 1);
      cell.value = val;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
      if (ci === 1 || ci === 3) {
        cell.font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF1E3A5F' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
      }
    });
  });
  ozetWs.views = [{ state: 'frozen', ySplit: 5 }];
  addFooter(ozetWs, ozetRows.length + 5, 4);
  protectSheet(ozetWs);

  // ── SAYFA 2: PERSONELLER ──
  buildSheet(wb, 'Personeller', 'PERSONELLER LİSTESİ',
    `Toplam ${personeller.length} personel  |  ${firmaAdi}  |  Rapor: ${tarih}`,
    ['#', 'Ad Soyad', 'TC Kimlik', 'Telefon', 'E-posta', 'Görev', 'Departman', 'Durum', 'Kan Grubu', 'İşe Giriş'],
    personeller.map((p, i) => [i+1, p.adSoyad as string ?? '—', p.tc as string ?? '—', p.telefon as string ?? '—',
      p.email as string ?? '—', p.gorev as string ?? '—', p.departman as string ?? '—', p.durum as string ?? '—',
      p.kanGrubu as string ?? '—', fmtDate(p.iseGirisTarihi as string)]),
    [4, 28, 15, 17, 30, 22, 20, 13, 11, 15]
  );

  // ── SAYFA 3: EVRAKLAR ──
  buildSheet(wb, 'Evraklar', 'EVRAKLAR LİSTESİ',
    `Toplam ${evraklar.length} evrak  |  Sorunlu: ${sorunluEvrak}  |  ${firmaAdi}  |  Rapor: ${tarih}`,
    ['#', 'Evrak Adı', 'Tür', 'Personel', 'Durum', 'Geçerlilik Tarihi', 'Kalan Gün'],
    evraklar.map((e, i) => {
      const kg = calcDays(e.gecerlilikTarihi as string);
      const pSnap = personeller.find(p => p.id === (e.personelId as string));
      return [i+1, e.ad as string ?? '—', e.tur as string ?? '—', pSnap?.adSoyad as string ?? '—',
        e.durum as string ?? '—', fmtDate(e.gecerlilikTarihi as string),
        kg !== null ? (kg < 0 ? `${Math.abs(kg)}g önce doldu` : `${kg}g kaldı`) : '—'];
    }),
    [4, 34, 22, 26, 17, 17, 15]
  );

  // ── SAYFA 4: EĞİTİMLER ──
  buildSheet(wb, 'Eğitimler', 'EĞİTİMLER LİSTESİ',
    `Toplam ${egitimler.length} eğitim  |  ${firmaAdi}  |  Rapor: ${tarih}`,
    ['#', 'Eğitim Adı', 'Eğitmen', 'Tarih', 'Durum', 'Katılımcı Sayısı', 'Katıldı', 'Oran'],
    egitimler.map((e, i) => {
      const kl = (e.katilimcilar as { katildi: boolean }[]) ??
        ((e.katilimciIds as string[]) ?? []).map(() => ({ katildi: true }));
      const katildi = kl.filter(k => k.katildi).length;
      const oran = kl.length > 0 ? `%${Math.round((katildi / kl.length) * 100)}` : '—';
      return [i+1, e.ad as string ?? '—', e.egitmen as string ?? '—', fmtDate(e.tarih as string),
        e.durum as string ?? '—', kl.length, katildi, oran];
    }),
    [4, 36, 24, 14, 14, 16, 12, 12]
  );

  // ── SAYFA 5: SAĞLIK TAKİBİ ──
  buildSheet(wb, 'Sağlık Takibi', 'SAĞLIK TAKİBİ',
    `Toplam ${muayeneler.length} muayene  |  Geçmiş: ${muayeneGecmis}  |  ${firmaAdi}  |  Rapor: ${tarih}`,
    ['#', 'Ad Soyad', 'Görev', 'Muayene Tarihi', 'Sonraki Muayene', 'Kalan Gün', 'Durum', 'Sağlık Durumu'],
    muayeneler
      .sort((a, b) => (calcDays(a.sonrakiTarih as string) ?? 9999) - (calcDays(b.sonrakiTarih as string) ?? 9999))
      .map((m, i) => {
        const pSnap = personeller.find(p => p.id === (m.personelId as string));
        const days = calcDays(m.sonrakiTarih as string);
        const durum = days === null ? '—' : days < 0 ? 'Süresi Geçmiş' : days <= 30 ? 'Yaklaşıyor' : 'Güncel';
        return [i+1, pSnap?.adSoyad as string ?? '—', pSnap?.gorev as string ?? '—',
          fmtDate(m.muayeneTarihi as string), fmtDate(m.sonrakiTarih as string),
          days !== null ? days : '—', durum, m.saglikDurumu as string ?? '—'];
      }),
    [4, 26, 20, 16, 18, 12, 16, 20]
  );

  // ── SAYFA 6: UYGUNSUZLUKLAR ──
  buildSheet(wb, 'Uygunsuzluklar', 'UYGUNSUZLUKLAR LİSTESİ',
    `Toplam ${uygunsuzluklar.length}  |  Açık: ${acikUyg}  |  ${firmaAdi}  |  Rapor: ${tarih}`,
    ['#', 'DÖF No', 'Başlık', 'Durum', 'Seviye', 'Açılış Tarihi', 'Kapanış Tarihi', 'Sorumlu'],
    uygunsuzluklar.map((u, i) => [i+1, u.acilisNo as string ?? '—',
      (u.baslik as string ?? (u.aciklama as string ?? '').slice(0, 60)) || '—',
      u.durum as string ?? '—', u.severity as string ?? '—',
      fmtDate(u.olusturmaTarihi as string), fmtDate(u.kapatmaTarihi as string), u.sorumlu as string ?? '—']),
    [4, 15, 42, 14, 15, 17, 17, 24]
  );

  // ── SAYFA 7: EKİPMANLAR ──
  buildSheet(wb, 'Ekipmanlar', 'EKİPMANLAR LİSTESİ',
    `Toplam ${ekipmanlar.length}  |  Uygun Değil: ${uygunDegil}  |  ${firmaAdi}  |  Rapor: ${tarih}`,
    ['#', 'Ekipman Adı', 'Tür', 'Marka', 'Model', 'Durum', 'Sonraki Kontrol', 'Kalan Süre'],
    ekipmanlar.map((e, i) => {
      const kg = calcDays(e.sonrakiKontrolTarihi as string);
      return [i+1, e.ad as string ?? '—', e.tur as string ?? '—', e.marka as string ?? '—',
        e.model as string ?? '—', e.durum as string ?? '—', fmtDate(e.sonrakiKontrolTarihi as string),
        kg !== null ? (kg < 0 ? `${Math.abs(kg)}g gecikti` : `${kg}g kaldı`) : '—'];
    }),
    [4, 28, 18, 16, 16, 14, 16, 14]
  );

  // ── SAYFA 8: TUTANAKLAR ──
  buildSheet(wb, 'Tutanaklar', 'TUTANAKLAR LİSTESİ',
    `Toplam ${tutanaklar.length} tutanak  |  ${firmaAdi}  |  Rapor: ${tarih}`,
    ['#', 'Başlık', 'Tür', 'Tarih', 'Durum', 'Oluşturan'],
    tutanaklar.map((t, i) => [i+1, t.baslik as string ?? t.tur as string ?? '—', t.tur as string ?? '—',
      fmtDate(t.olusturmaTarihi as string), t.durum as string ?? '—', t.olusturanAd as string ?? '—']),
    [4, 40, 22, 15, 16, 24]
  );

  // ── SAYFA 9: İŞ İZİNLERİ ──
  buildSheet(wb, 'İş İzinleri', 'İŞ İZİNLERİ LİSTESİ',
    `Toplam ${isIzinleri.length} iş izni  |  ${firmaAdi}  |  Rapor: ${tarih}`,
    ['#', 'İş Adı', 'Sorumlu', 'Başlangıç', 'Bitiş', 'Durum', 'Risk Seviyesi'],
    isIzinleri.map((i, idx) => [idx+1, i.isAdi as string ?? '—', i.sorumlu as string ?? '—',
      fmtDate(i.baslangicTarihi as string), fmtDate(i.bitisTarihi as string),
      i.durum as string ?? '—', i.riskSeviyesi as string ?? '—']),
    [4, 36, 24, 15, 15, 16, 18]
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadFirmaRapor(blob: Blob, firmaAdi: string) {
  const now = new Date();
  const tarih = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const safe = firmaAdi.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').trim().replace(/\s+/g, '-').toUpperCase();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tarih}-${safe}-RAPOR.xlsx`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
