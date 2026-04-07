import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScan: (result: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const containerId = "qr-reader-container";

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          onScan(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {}
      )
      .then(() => setStarted(true))
      .catch(() => {
        setError("Kamera erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edin.");
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Scanner viewport */}
      <div className="relative w-full max-w-xs">
        {/* Corner frame overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="relative w-52 h-52">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#059669] rounded-tl-md"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#059669] rounded-tr-md"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#059669] rounded-bl-md"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#059669] rounded-br-md"></div>
            {/* Scan line animation */}
            {started && (
              <div className="absolute left-2 right-2 h-[2px] bg-[#059669]/70 rounded-full animate-scan-line"></div>
            )}
          </div>
        </div>

        {/* QR reader div */}
        <div
          id={containerId}
          className="w-full rounded-2xl overflow-hidden bg-black"
          style={{ minHeight: "280px" }}
        ></div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 max-w-xs w-full">
          <i className="ri-error-warning-line text-base shrink-0"></i>
          <span>{error}</span>
        </div>
      ) : (
        <p className="text-xs text-[#94A3B8] text-center">
          Ekipman QR kodunu kamera alanına tutun
        </p>
      )}
    </div>
  );
}
