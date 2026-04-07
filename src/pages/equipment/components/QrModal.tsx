import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Ekipman } from '../../../types';

interface Props {
  ekipman: Ekipman | null;
  onClose: () => void;
}

export default function QrModal({ ekipman, onClose }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!ekipman) return null;

  const qrUrl = `${window.location.origin}/equipment/qr/${ekipman.id}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=4F46E5&margin=3`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Kod - ${ekipman.ad}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', sans-serif; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
          .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 28px 24px; text-align: center; max-width: 300px; width: 100%; }
          .logo-bar { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
          .logo-text { font-size: 13px; font-weight: 700; color: #0f172a; }
          .qr-wrap { background: #fff; border-radius: 12px; padding: 16px; display: inline-block; margin-bottom: 16px; border: 1px solid #e2e8f0; }
          .title { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
          .sub { font-size: 12px; color: #64748b; margin-bottom: 12px; }
          .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; margin-bottom: 16px; }
          .url { font-size: 9px; color: #94a3b8; word-break: break-all; padding: 8px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
          .footer { margin-top: 16px; font-size: 10px; color: #cbd5e1; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo-bar">
            <span class="logo-text">ISG Denetim</span>
          </div>
          <div class="qr-wrap">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=4F46E5&margin=3" width="220" height="220" />
          </div>
          <div class="title">${ekipman.ad}</div>
          <div class="sub">${ekipman.tur || ''}${ekipman.seriNo ? ' • ' + ekipman.seriNo : ''}</div>
          <div class="badge">${ekipman.durum}</div>
          <div class="url">${qrUrl}</div>
          <div class="footer">ISG Denetim Yönetim Sistemi • Ekipman Kontrol QR</div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrUrl)}&margin=4&bgcolor=ffffff&color=4F46E5`;
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
      window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrUrl)}&margin=4`, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-[340px] overflow-hidden"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(15,23,42,0.15), 0 4px 16px rgba(99,102,241,0.08)',
        }}
      >
        {/* Top accent bar */}
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #6366F1, #818CF8, #A5B4FC)' }} />

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-4"
          style={{ borderBottom: '1px solid #F1F5F9' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
            >
              <i className="ri-qr-code-line text-white text-base" />
            </div>
            <div>
              <h2 className="text-[14px] font-black text-slate-800" style={{ letterSpacing: '-0.02em' }}>{ekipman.ad}</h2>
              <p className="text-[10px] mt-0.5 text-slate-400">
                {ekipman.tur || 'Ekipman'}{ekipman.seriNo ? ` • ${ekipman.seriNo}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 flex-shrink-0 text-slate-400"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8'; }}
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* QR Code Area */}
        <div className="px-6 py-5 flex flex-col items-center gap-4">

          {/* QR Card */}
          <div
            ref={canvasRef}
            className="relative flex flex-col items-center gap-3 w-full rounded-2xl p-5"
            style={{
              background: 'linear-gradient(145deg, #F8F7FF 0%, #F5F3FF 100%)',
              border: '1px solid rgba(99,102,241,0.15)',
            }}
          >
            {/* Corner accents */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: 'rgba(99,102,241,0.35)' }} />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: 'rgba(99,102,241,0.35)' }} />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: 'rgba(99,102,241,0.35)' }} />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: 'rgba(99,102,241,0.35)' }} />

            {/* QR Image */}
            <div
              className="rounded-2xl overflow-hidden p-3 flex items-center justify-center"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(99,102,241,0.12)',
                boxShadow: '0 2px 16px rgba(99,102,241,0.08)',
              }}
            >
              <img
                src={qrImageUrl}
                alt={`QR - ${ekipman.ad}`}
                width={220}
                height={220}
                className="rounded-xl"
                style={{ display: 'block' }}
              />
            </div>

            {/* ISG badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#6366F1' }} />
              <span className="text-[10px] font-bold" style={{ color: '#6366F1' }}>ISG Denetim Sistemi</span>
            </div>
          </div>

          {/* URL copy row */}
          <div
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
            onClick={handleCopy}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.background = '#F5F3FF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC'; }}
          >
            <i className="ri-link text-[11px] flex-shrink-0 text-slate-400" />
            <p className="text-[10px] font-mono flex-1 truncate text-slate-400">{qrUrl}</p>
            <div
              className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-md transition-all"
              style={{
                background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${copied ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.2)'}`,
              }}
            >
              <i className={`${copied ? 'ri-check-line' : 'ri-clipboard-line'} text-[10px]`} style={{ color: copied ? '#10B981' : '#6366F1' }} />
              <span className="text-[9.5px] font-bold" style={{ color: copied ? '#10B981' : '#6366F1' }}>
                {copied ? 'Kopyalandı' : 'Kopyala'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 pb-5 flex items-center gap-2.5"
          style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}
        >
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer transition-all whitespace-nowrap text-slate-500"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
          >
            Kapat
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer transition-all whitespace-nowrap disabled:opacity-60"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }}
            onMouseEnter={e => { if (!downloading) { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)'; }}
          >
            <i className={`${downloading ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'} text-sm`} />
            {downloading ? 'İndiriliyor...' : 'İndir'}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer transition-all whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#FFFFFF',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            <i className="ri-printer-line text-sm" />
            Yazdır
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
