// OSGB Raporlar — Excel Export (ExcelJS)
import type { OsgbRaporData } from './osgbReportPdf';

export async function downloadOsgbReportExcel(data: OsgbRaporData): Promise<void> {
  const { orgName, donem, firmalar, uzmanlar } = data;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISG Denetim Sistemi';
  wb.created = new Date();

  const totalPersonel = firmalar.reduce((s, f) => s + f.personelSayisi, 0);
  const totalUygunsuzluk = firmalar.reduce((s, f) => s + f.uygunsuzluk, 0);
  const totalKapatilan = firmalar.reduce((s, f) => s + f.kapatilan, 0);
  const totalTutanak = firmalar.reduce((s, f) => s + f.tutanakSayisi, 0);
  const totalEgitim = firmalar.reduce((s, f) => s + f.egitimSayisi, 0);

  // ── ÖZET SAYFASI ──────────────────────────────────────────────────────────
  const wsOzet = wb.addWorksheet('Özet');
  wsOzet.columns = [
    { key: 'label', width: 36 },
    { key: 'value', width: 24 },
  ];

  const addOzetRow = (label: string, value: string | number, isBold = false, bgArgb?: string) => {
    const row = wsOzet.addRow({ label, value });
    row.height = 22;
    if (isBold) {
      row.getCell(1).font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF0F172A' } };
      row.getCell(2).font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF0F172A' } };
    } else {
      row.getCell(1).font = { size: 11, name: 'Calibri', color: { argb: 'FF374151' } };
      row.getCell(2).font = { size: 11, name: 'Calibri', color: { argb: 'FF1E293B' } };
    }
    row.getCell(2).alignment = { horizontal: 'right' };
    if (bgArgb) {
      [1, 2].forEach(c => {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      });
    }
    row.eachCell(cell => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    });
  };

  // Başlık
  wsOzet.mergeCells('A1:B1');
  const titleCell = wsOzet.getCell('A1');
  titleCell.value = `OSGB ISG Raporu — ${orgName}`;
  titleCell.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  titleCell.border = { bottom: { style: 'medium', color: { argb: 'FF10B981' } } };
  wsOzet.getRow(1).height = 36;

  wsOzet.addRow({});
  addOzetRow('Dönem', donem, true, 'FFF0FDF4');
  addOzetRow('Rapor Tarihi', new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }));
  wsOzet.addRow({});
  addOzetRow('── GENEL İSTATİSTİKLER ──', '', true, 'FFF8FAFC');
  addOzetRow('Toplam Müşteri Firma', firmalar.length);
  addOzetRow('Toplam Personel', totalPersonel);
  addOzetRow('Toplam Açık Uygunsuzluk', totalUygunsuzluk - totalKapatilan);
  addOzetRow('Toplam Kapatılan Uygunsuzluk', totalKapatilan);
  addOzetRow('Toplam Tutanak', totalTutanak);
  addOzetRow('Toplam Eğitim', totalEgitim);
  addOzetRow('Kapanma Oranı', totalUygunsuzluk > 0 ? `${Math.round((totalKapatilan / totalUygunsuzluk) * 100)}%` : '—');
  addOzetRow('Aktif Uzman', uzmanlar.filter(u => u.is_active).length);

  // ── FİRMA SAYFASI ─────────────────────────────────────────────────────────
  const wsFirma = wb.addWorksheet('Müşteri Firmalar');
  wsFirma.columns = [
    { header: 'Firma Adı', key: 'name', width: 32 },
    { header: 'Personel Sayısı', key: 'personelSayisi', width: 16 },
    { header: 'Sorumlu Uzman', key: 'uzmanAd', width: 24 },
    { header: 'Açık Uygunsuzluk', key: 'uygunsuzluk', width: 18 },
    { header: 'Kapatılan', key: 'kapatilan', width: 14 },
    { header: 'Tutanak', key: 'tutanakSayisi', width: 12 },
    { header: 'Eğitim', key: 'egitimSayisi', width: 12 },
    { header: 'Kapanma Oranı %', key: 'kapanmaOran', width: 18 },
  ];

  const firmaHeaderRow = wsFirma.getRow(1);
  firmaHeaderRow.height = 30;
  firmaHeaderRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF10B981' } } };
  });

  firmalar.forEach((f, i) => {
    const rowBg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const kapanmaOran = f.uygunsuzluk > 0 ? Math.round((f.kapatilan / f.uygunsuzluk) * 100) : 100;
    const dataRow = wsFirma.addRow({
      name: f.name,
      personelSayisi: f.personelSayisi,
      uzmanAd: f.uzmanAd ?? 'Atanmadı',
      uygunsuzluk: f.uygunsuzluk - f.kapatilan,
      kapatilan: f.kapatilan,
      tutanakSayisi: f.tutanakSayisi,
      egitimSayisi: f.egitimSayisi,
      kapanmaOran: `${kapanmaOran}%`,
    });
    dataRow.height = 24;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      cell.font = { size: 11, name: 'Calibri', color: { argb: 'FF1E293B' } };

      // Uygunsuzluk renk kodlaması
      if (colNum === 4) {
        const v = f.uygunsuzluk - f.kapatilan;
        const color = v > 5 ? 'FFDC2626' : v > 2 ? 'FFD97706' : 'FF16A34A';
        cell.font = { bold: true, size: 11, color: { argb: color } };
      }
      if (colNum === 5) cell.font = { bold: true, size: 11, color: { argb: 'FF16A34A' } };
      if (colNum === 6) cell.font = { bold: true, size: 11, color: { argb: 'FF6366F1' } };
      if (colNum === 7) cell.font = { bold: true, size: 11, color: { argb: 'FF0891B2' } };
      if (colNum === 8) cell.font = { bold: true, size: 11, color: { argb: 'FF059669' } };
    });
  });

  // Toplam satırı
  const totalRow = wsFirma.addRow({
    name: 'TOPLAM',
    personelSayisi: totalPersonel,
    uzmanAd: '—',
    uygunsuzluk: totalUygunsuzluk - totalKapatilan,
    kapatilan: totalKapatilan,
    tutanakSayisi: totalTutanak,
    egitimSayisi: totalEgitim,
    kapanmaOran: `${totalUygunsuzluk > 0 ? Math.round((totalKapatilan / totalUygunsuzluk) * 100) : 100}%`,
  });
  totalRow.height = 28;
  totalRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    cell.font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'center' };
    cell.border = { top: { style: 'medium', color: { argb: 'FF10B981' } } };
  });

  wsFirma.views = [{ state: 'frozen', ySplit: 1 }];

  // ── UZMAN SAYFASI ──────────────────────────────────────────────────────────
  const wsUzman = wb.addWorksheet('Gezici Uzmanlar');
  wsUzman.columns = [
    { header: 'Ad Soyad', key: 'display_name', width: 28 },
    { header: 'E-posta', key: 'email', width: 34 },
    { header: 'Atandığı Firma', key: 'active_firm_name', width: 30 },
    { header: 'Durum', key: 'is_active', width: 14 },
  ];

  const uzmanHeaderRow = wsUzman.getRow(1);
  uzmanHeaderRow.height = 30;
  uzmanHeaderRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF8B5CF6' } } };
  });

  uzmanlar.forEach((u, i) => {
    const rowBg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const dataRow = wsUzman.addRow({
      display_name: u.display_name,
      email: u.email,
      active_firm_name: u.active_firm_name ?? 'Atanmadı',
      is_active: u.is_active ? 'Aktif' : 'Pasif',
    });
    dataRow.height = 24;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = { vertical: 'middle', horizontal: colNum === 4 ? 'center' : 'left' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      cell.font = { size: 11, name: 'Calibri', color: { argb: 'FF374151' } };
      if (colNum === 4) {
        cell.font = { bold: true, size: 11, color: { argb: u.is_active ? 'FF059669' : 'FF94A3B8' } };
      }
    });
  });
  wsUzman.views = [{ state: 'frozen', ySplit: 1 }];

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  link.download = `${dateStr}-OSGB-Raporu.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
