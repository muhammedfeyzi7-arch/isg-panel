import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportToPDF(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Geçici olarak scroll'u sıfırla ve tam yüksekliği göster
  const originalOverflow = element.style.overflow;
  const originalMaxHeight = element.style.maxHeight;
  element.style.overflow = 'visible';
  element.style.maxHeight = 'none';

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    let yOffset = 0;
    let remainingHeight = imgHeight;

    while (remainingHeight > 0) {
      if (yOffset > 0) pdf.addPage();

      const sliceHeight = Math.min(remainingHeight, pageHeight - margin * 2);
      const sourceY = (yOffset / imgHeight) * canvas.height;
      const sourceHeight = (sliceHeight / imgHeight) * canvas.height;

      // Her sayfa için canvas slice al
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sourceHeight;
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
      }

      const sliceData = sliceCanvas.toDataURL('image/png');
      pdf.addImage(sliceData, 'PNG', margin, margin, contentWidth, sliceHeight);

      yOffset += sliceHeight;
      remainingHeight -= sliceHeight;
    }

    pdf.save(`${fileName}.pdf`);
  } finally {
    element.style.overflow = originalOverflow;
    element.style.maxHeight = originalMaxHeight;
  }
}
