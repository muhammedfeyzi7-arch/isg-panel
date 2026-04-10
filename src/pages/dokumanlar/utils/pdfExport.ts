import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Verilen HTML elementini alıp A4 Landscape PDF olarak indirir.
 * Tablo genişse yatay sayfaya sığdırır, uzunsa çok sayfaya böler.
 */
export async function exportToPDF(
  elementOrId: HTMLElement | string,
  fileName: string,
): Promise<void> {
  const element =
    typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;

  if (!element) return;

  // Geçici olarak scroll kısıtlamalarını kaldır
  const prevOverflow = element.style.overflow;
  const prevMaxH = element.style.maxHeight;
  const prevMaxW = element.style.maxWidth;
  element.style.overflow = 'visible';
  element.style.maxHeight = 'none';
  element.style.maxWidth = 'none';

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: element.scrollWidth + 40,
      windowHeight: element.scrollHeight + 40,
    });

    // A4 Landscape: 297 x 210 mm
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();   // 297
    const pageH = pdf.internal.pageSize.getHeight();  // 210
    const margin = 8;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;

    // Canvas boyutlarını mm'ye çevir (scale=2 olduğu için /2)
    const pxPerMm = canvas.width / contentW;          // px / mm
    const totalHeightMm = canvas.height / pxPerMm;    // toplam içerik yüksekliği mm

    let yMm = 0; // kaç mm işlendi

    while (yMm < totalHeightMm) {
      if (yMm > 0) pdf.addPage();

      const sliceHeightMm = Math.min(contentH, totalHeightMm - yMm);
      const srcY = Math.round(yMm * pxPerMm);
      const srcH = Math.round(sliceHeightMm * pxPerMm);

      // Slice canvas
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = srcH;
      const ctx = slice.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      }

      pdf.addImage(
        slice.toDataURL('image/png'),
        'PNG',
        margin,
        margin,
        contentW,
        sliceHeightMm,
      );

      yMm += sliceHeightMm;
    }

    // Dosya adından .pdf uzantısını çıkar (zaten ekliyoruz)
    const cleanName = fileName.replace(/\.pdf$/i, '');
    pdf.save(`${cleanName}.pdf`);
  } finally {
    element.style.overflow = prevOverflow;
    element.style.maxHeight = prevMaxH;
    element.style.maxWidth = prevMaxW;
  }
}
