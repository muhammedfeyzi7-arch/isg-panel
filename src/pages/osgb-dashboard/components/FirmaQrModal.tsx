import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface FirmaQrModalProps {
  firmaId: string;
  firmaAdi: string;
  isDark?: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    QRCode?: new (el: HTMLElement, options: {
      text: string;
      width: number;
      height: number;
      colorDark: string;
      colorLight: string;
      correctLevel: number;
    }) => void;
  }
}

export default function FirmaQrModal({ firmaId, firmaAdi, isDark = false, onClose }: FirmaQrModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const qrData = JSON.stringify({ type: 'firm', id: firmaId });

  const modalBg = 'var(--modal-bg)';
  const modalBorder = 'var(--modal-border)';
  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';

  // QRCode.js CDN'den yüklü değilse yükle, sonra oluştur
  useEffect(() => {
    const buildQr = () => {
      if (!qrRef.current || !window.QRCode) return;
      qrRef.current.innerHTML = '';
      new window.QRCode(qrRef.current, {
        text: qrData,
        width: 240,
        height: 240,
        colorDark: isDark ? '#0f172a' : '#0f172a',
        colorLight: '#ffffff',
        correctLevel: 2, // H
      });
      // Canvas referansını yakala
      setTimeout(() => {
        const canvas = qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
        canvasRef.current = canvas;
        setQrReady(true);
      }, 100);
    };

    if (window.QRCode) {
      buildQr();
    } else {
      // Yükle
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = buildQr;
      document.head.appendChild(script);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrData, isDark]);

  const handleDownload = () => {
    const canvas = canvasRef.current ?? (qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null);
    if (!canvas) return;

    // Başlıklı tam QR görseli oluştur
    const outputCanvas = document.createElement('canvas');
    const padding = 40;
    const headerH = 80;
    const footerH = 60;
    outputCanvas.width = canvas.width + padding * 2;
    outputCanvas.height = canvas.height + padding * 2 + headerH + footerH;

    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    // Beyaz arka plan
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

    // Yeşil üst şerit
    ctx.fillStyle = '#10B981';
    ctx.fillRect(0, 0, outputCanvas.width, headerH);

    // Başlık metni
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ZİYARET QR KODU', outputCanvas.width / 2, 30);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(firmaAdi, outputCanvas.width / 2, 55);

    // QR
    ctx.drawImage(canvas, padding, headerH + padding);

    // Alt açıklama
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.fillText('Uzmanlar bu kodu okutarak ziyaret başlatır', outputCanvas.width / 2, headerH + padding + canvas.height + padding / 2 + 10);

    const link = document.createElement('a');
    link.download = `${firmaAdi.replace(/\s+/g, '-')}-qr.png`;
    link.href = outputCanvas.toDataURL('image/png');
    link.click();
  };

  const handlePrint = () => {
    const canvas = canvasRef.current ?? (qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null);
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ziyaret QR - ${firmaAdi}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; }
            .header { background: #10B981; color: #fff; width: 320px; padding: 20px; text-align: center; border-radius: 12px 12px 0 0; }
            .header h2 { margin: 0 0 4px; font-size: 16px; letter-spacing: 1px; }
            .header p { margin: 0; font-size: 13px; opacity: 0.9; }
            .qr-box { border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px; text-align: center; }
            .qr-box img { width: 240px; height: 240px; }
            .footer { margin-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; max-width: 280px; }
            @media print { body { justify-content: flex-start; padding-top: 40px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>ZİYARET QR KODU</h2>
            <p>${firmaAdi}</p>
          </div>
          <div class="qr-box">
            <img src="${dataUrl}" alt="QR Kod" />
          </div>
          <div class="footer">Uzmanlar bu kodu okutarak ziyaret başlatır</div>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(14px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: modalBg, border: `1px solid ${modalBorder}` }}
      >
        {/* Başlık */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <i className="ri-qr-code-line text-base" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">Ziyaret QR Kodu</p>
              <p className="text-sm font-bold">{firmaAdi}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* QR Alan */}
        <div className="flex flex-col items-center p-6 gap-4">
          {/* QR Görsel */}
          <div
            className="rounded-2xl p-4 flex items-center justify-center"
            style={{ background: '#ffffff', border: '2px solid rgba(16,185,129,0.2)' }}
          >
            <div ref={qrRef} style={{ lineHeight: 0 }} />
            {!qrReady && (
              <div className="w-60 h-60 flex items-center justify-center">
                <i className="ri-loader-4-line text-3xl animate-spin" style={{ color: '#10B981' }} />
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div className="text-center px-2">
            <p className="text-xs font-semibold" style={{ color: textPrimary }}>
              <i className="ri-information-line mr-1" style={{ color: '#10B981' }} />
              Uzmanlar bu kodu okutarak ziyaret başlatır
            </p>
            <p className="text-[10px] mt-1" style={{ color: textMuted }}>
              QR ile giriş otomatik check-in oluşturur, çıkışta check-out tamamlanır
            </p>
          </div>

          {/* QR data özeti */}
          <div
            className="w-full px-3 py-2 rounded-xl flex items-center gap-2"
            style={{ background: 'var(--bg-item)', border: `1px solid ${modalBorder}` }}
          >
            <i className="ri-code-line text-xs flex-shrink-0" style={{ color: textMuted }} />
            <span className="text-[10px] font-mono flex-1 truncate" style={{ color: textMuted }}>
              {`{"type":"firm","id":"${firmaId.slice(0, 8)}..."}`}
            </span>
            <button
              onClick={handleCopy}
              className="text-[10px] font-semibold cursor-pointer flex-shrink-0 whitespace-nowrap"
              style={{ color: copied ? '#10B981' : textMuted }}
            >
              {copied ? <><i className="ri-check-line" /> Kopyalandı</> : 'Kopyala'}
            </button>
          </div>

          {/* Butonlar */}
          <div className="w-full grid grid-cols-2 gap-2">
            <button
              onClick={handleDownload}
              disabled={!qrReady}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-all"
              style={{
                background: qrReady ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                border: `1px solid ${qrReady ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.2)'}`,
                color: qrReady ? '#10B981' : '#94A3B8',
              }}
            >
              <i className="ri-download-2-line text-base" />
              İndir
            </button>
            <button
              onClick={handlePrint}
              disabled={!qrReady}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-all text-white"
              style={{
                background: qrReady ? 'linear-gradient(135deg, #10B981, #059669)' : 'rgba(148,163,184,0.2)',
                opacity: qrReady ? 1 : 0.6,
              }}
            >
              <i className="ri-printer-line text-base" />
              Yazdır
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
