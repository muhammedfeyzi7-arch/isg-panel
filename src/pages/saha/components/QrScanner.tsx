import { useState, useRef, useCallback, useEffect } from 'react';

// jsQR modül yükleyici — singleton
let jsQRModule: ((data: Uint8ClampedArray, width: number, height: number, opts?: { inversionAttempts?: string }) => { data: string } | null) | null = null;
let jsQRLoading = false;
const jsQRCallbacks: Array<() => void> = [];

export function loadJsQR(): Promise<void> {
  return new Promise((resolve) => {
    if (jsQRModule) { resolve(); return; }
    jsQRCallbacks.push(resolve);
    if (jsQRLoading) return;
    jsQRLoading = true;
    import('jsqr').then((mod) => {
      jsQRModule = mod.default;
      jsQRLoading = false;
      jsQRCallbacks.forEach(cb => cb());
      jsQRCallbacks.length = 0;
    }).catch(() => {
      jsQRLoading = false;
      jsQRCallbacks.forEach(cb => cb());
      jsQRCallbacks.length = 0;
    });
  });
}

interface QrScannerProps {
  onResult: (text: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onResult, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(true);
  const detectorRef = useRef<{ detect: (src: HTMLCanvasElement) => Promise<{ rawValue: string }[]> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleFound = useCallback((text: string) => {
    stopAll();
    onResult(text);
  }, [stopAll, onResult]);

  useEffect(() => {
    activeRef.current = true;
    if ('BarcodeDetector' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch { detectorRef.current = null; }
    }
    void loadJsQR();

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        await video.play();
        setReady(true);
        requestAnimationFrame(tick);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied'))
          setError('Kamera izni reddedildi. Tarayıcı ayarlarından kamera iznini açın.');
        else if (msg.includes('NotFound') || msg.includes('DevicesNotFound'))
          setError('Kamera bulunamadı.');
        else
          setError('Kamera başlatılamadı: ' + msg);
      }
    };

    const tick = async () => {
      if (!activeRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick); return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (detectorRef.current) {
        try {
          const codes = await detectorRef.current.detect(canvas);
          if (codes.length > 0 && activeRef.current) { handleFound(codes[0].rawValue); return; }
        } catch { detectorRef.current = null; }
      }
      if (jsQRModule) {
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQRModule(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
          if (code && activeRef.current) { handleFound(code.data); return; }
        } catch { /* ignore */ }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    void start();
    return () => { stopAll(); };
  }, [handleFound, stopAll]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
        <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <i className="ri-camera-off-line text-2xl" style={{ color: '#EF4444' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: '#F87171' }}>{error}</p>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>Kapat</button>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ maxWidth: '360px', margin: '0 auto' }}>
      <div className="relative rounded-2xl overflow-hidden" style={{ height: '280px', background: '#0A0F1E' }}>
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 52% 52% at 50% 50%, transparent 0%, rgba(0,0,0,0.65) 100%)' }} />
          <div className="relative z-10" style={{ width: '180px', height: '180px' }}>
            {(['top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl', 'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl', 'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl', 'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl'] as const).map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#34D399' }} />
            ))}
            {ready && (
              <div className="absolute left-2 right-2 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #34D399, transparent)', animation: 'qrScan 2s ease-in-out infinite', top: '10%' }} />
            )}
          </div>
        </div>
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: ready ? '#34D399' : '#FBBF24', animation: ready ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
            <span className="text-xs font-medium" style={{ color: '#E2E8F0' }}>{!ready ? 'Kamera başlatılıyor...' : 'QR aranıyor...'}</span>
          </div>
        </div>
      </div>
      <p className="text-center text-xs mt-3 font-medium" style={{ color: '#64748B' }}>QR kodu çerçeve içine getirin — otomatik okunur</p>
      <style>{`
        @keyframes qrScan { 0% { top: 10%; opacity: 0.5; } 50% { top: 82%; opacity: 1; } 100% { top: 10%; opacity: 0.5; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
