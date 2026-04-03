import { useRef } from 'react';
import Modal from '../../../components/base/Modal';
import type { Ekipman } from '../../../types';

interface Props {
  ekipman: Ekipman | null;
  onClose: () => void;
}

// Minimal QR code generator (no external lib needed)
// Uses a simple URL-based QR via Google Charts API (no data leak — only URL is sent)
export default function QrModal({ ekipman, onClose }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!ekipman) return null;

  const qrUrl = `${window.location.origin}/equipment/qr/${ekipman.id}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}&bgcolor=0F172A&color=E2E8F0&margin=2`;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Kod - ${ekipman.ad}</title>
        <style>
          body { margin: 0; padding: 20px; font-family: 'Segoe UI', sans-serif; background: #fff; display: flex; justify-content: center; }
          .card { border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; max-width: 280px; }
          .title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
          .sub { font-size: 12px; color: #64748b; margin-bottom: 16px; }
          img { width: 200px; height: 200px; }
          .footer { font-size: 10px; color: #94a3b8; margin-top: 12px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">${ekipman.ad}</div>
          <div class="sub">${ekipman.tur || ''} ${ekipman.seriNo ? '• ' + ekipman.seriNo : ''}</div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&margin=2" />
          <div class="footer">${qrUrl}</div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleDownload = async () => {
    try {
      const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&margin=4&bgcolor=ffffff&color=0f172a`;
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `QR-${ekipman.ad.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Fallback: open in new tab
      window.open(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&margin=4`, '_blank');
    }
  };

  return (
    <Modal
      isOpen={!!ekipman}
      onClose={onClose}
      title="QR Kod"
      size="sm"
      icon="ri-qr-code-line"
      footer={
        <div className="flex items-center gap-2 w-full">
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">Kapat</button>
          <button onClick={handleDownload} className="btn-secondary whitespace-nowrap">
            <i className="ri-download-line mr-1" />İndir
          </button>
          <button onClick={handlePrint} className="btn-primary whitespace-nowrap">
            <i className="ri-printer-line mr-1" />Yazdır
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        {/* QR Image */}
        <div
          ref={canvasRef}
          className="rounded-2xl p-4 flex items-center justify-center"
          style={{ background: '#0F172A', border: '1px solid rgba(51,65,85,0.5)' }}
        >
          <img
            src={qrImageUrl}
            alt={`QR - ${ekipman.ad}`}
            width={220}
            height={220}
            className="rounded-xl"
          />
        </div>

        {/* Ekipman bilgisi */}
        <div className="text-center">
          <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{ekipman.ad}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {ekipman.tur}{ekipman.seriNo ? ` • ${ekipman.seriNo}` : ''}
          </p>
        </div>

        {/* Güvenlik notu */}
        <div className="w-full px-3 py-2.5 rounded-xl flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <i className="ri-shield-check-line text-sm mt-0.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
            Bu QR kod <strong style={{ color: '#F59E0B' }}>yalnızca yetkili kullanıcılara</strong> açıktır. Okutulduğunda giriş yapılmamışsa login sayfasına yönlendirilir.
          </p>
        </div>

        {/* URL */}
        <div className="w-full px-3 py-2 rounded-lg" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}>
          <p className="text-xs font-mono break-all" style={{ color: '#475569' }}>{qrUrl}</p>
        </div>
      </div>
    </Modal>
  );
}
