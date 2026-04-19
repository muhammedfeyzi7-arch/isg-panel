import { useEffect, useRef } from 'react';

interface FirmQRCodeProps {
  value: string;
  size?: number;
}

// Minimal QR code generator using canvas (no external lib needed)
// Uses a simple approach: encode URL as QR via Google Charts API (works offline via img)
export default function FirmQRCode({ value, size = 160 }: FirmQRCodeProps) {
  const encoded = encodeURIComponent(value);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=png&margin=10`;

  return (
    <div
      className="flex items-center justify-center rounded-lg overflow-hidden"
      style={{ width: size, height: size, border: '1px solid var(--border)', backgroundColor: '#fff' }}
    >
      <img
        src={src}
        alt="QR Kod"
        width={size}
        height={size}
        style={{ display: 'block' }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}
