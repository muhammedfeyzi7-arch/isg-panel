import { useState } from 'react';

const ACCENT = '#0EA5E9';

interface BodyRegion {
  id: string;
  label: string;
  frontDot: { cx: number; cy: number; r?: number } | null;
  backDot:  { cx: number; cy: number; r?: number } | null;
}

const REGIONS: BodyRegion[] = [
  { id: 'bas',       label: 'Baş',        frontDot: { cx: 200, cy:  52 }, backDot:  { cx: 200, cy:  52 } },
  { id: 'boyun',     label: 'Boyun',      frontDot: { cx: 200, cy:  95 }, backDot:  { cx: 200, cy:  95 } },
  { id: 'sol_omuz',  label: 'Sol Omuz',   frontDot: { cx: 148, cy: 118 }, backDot:  { cx: 148, cy: 118 } },
  { id: 'sag_omuz',  label: 'Sağ Omuz',  frontDot: { cx: 252, cy: 118 }, backDot:  { cx: 252, cy: 118 } },
  { id: 'gogus',     label: 'Göğüs',      frontDot: { cx: 200, cy: 148 }, backDot:  null },
  { id: 'sirt',      label: 'Sırt',       frontDot: null,                 backDot:  { cx: 200, cy: 155 } },
  { id: 'sol_kol',   label: 'Sol Kol',    frontDot: { cx: 122, cy: 178 }, backDot:  { cx: 122, cy: 178 } },
  { id: 'sag_kol',   label: 'Sağ Kol',   frontDot: { cx: 278, cy: 178 }, backDot:  { cx: 278, cy: 178 } },
  { id: 'karin',     label: 'Karın/Bel',  frontDot: { cx: 200, cy: 208 }, backDot:  null },
  { id: 'sol_el',    label: 'Sol El',     frontDot: { cx: 106, cy: 258 }, backDot:  { cx: 106, cy: 258 } },
  { id: 'sag_el',    label: 'Sağ El',     frontDot: { cx: 294, cy: 258 }, backDot:  { cx: 294, cy: 258 } },
  { id: 'sol_kalca', label: 'Sol Kalça',  frontDot: { cx: 177, cy: 272 }, backDot:  { cx: 177, cy: 272 } },
  { id: 'sag_kalca', label: 'Sağ Kalça', frontDot: { cx: 223, cy: 272 }, backDot:  { cx: 223, cy: 272 } },
  { id: 'sol_bacak', label: 'Sol Bacak',  frontDot: { cx: 174, cy: 340 }, backDot:  { cx: 174, cy: 340 } },
  { id: 'sag_bacak', label: 'Sağ Bacak', frontDot: { cx: 226, cy: 340 }, backDot:  { cx: 226, cy: 340 } },
  { id: 'sol_ayak',  label: 'Sol Ayak',  frontDot: { cx: 172, cy: 430 }, backDot:  { cx: 172, cy: 430 } },
  { id: 'sag_ayak',  label: 'Sağ Ayak', frontDot: { cx: 228, cy: 430 }, backDot:  { cx: 228, cy: 430 } },
];

const BODY_PARTS = [
  { id: 'bas',       label: 'Baş' },
  { id: 'boyun',     label: 'Boyun' },
  { id: 'sol_omuz',  label: 'Sol Omuz' },
  { id: 'sag_omuz',  label: 'Sağ Omuz' },
  { id: 'gogus',     label: 'Göğüs' },
  { id: 'sirt',      label: 'Sırt' },
  { id: 'sol_kol',   label: 'Sol Kol' },
  { id: 'sag_kol',   label: 'Sağ Kol' },
  { id: 'karin',     label: 'Karın/Bel' },
  { id: 'sol_el',    label: 'Sol El' },
  { id: 'sag_el',    label: 'Sağ El' },
  { id: 'sol_kalca', label: 'Sol Kalça' },
  { id: 'sag_kalca', label: 'Sağ Kalça' },
  { id: 'sol_bacak', label: 'Sol Bacak' },
  { id: 'sag_bacak', label: 'Sağ Bacak' },
  { id: 'sol_ayak',  label: 'Sol Ayak' },
  { id: 'sag_ayak',  label: 'Sağ Ayak' },
];

interface Human3DModelProps {
  selected: string[];
  onToggle: (id: string) => void;
  isDark: boolean;
}

export default function Human3DModel({ selected, onToggle, isDark }: Human3DModelProps) {
  const [loaded, setLoaded] = useState(false);

  const bg     = isDark ? '#0c1628' : '#eef4fb';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const textS  = isDark ? '#64748b' : '#94a3b8';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: bg }}>
      {/* 3D Model */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: bg, zIndex: 10 }}>
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs" style={{ color: textS }}>3D model yükleniyor...</span>
          </div>
        )}
        <iframe
          title="Human Anatomy 3D"
          src="https://sketchfab.com/models/14191ef860b44925be0e94462c84ffe6/embed?autostart=1&ui_controls=1&ui_infos=0&ui_inspector=0&ui_stop=0&ui_watermark=0&ui_watermark_link=0"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
          onLoad={() => setLoaded(true)}
        />
      </div>

      {/* Bölge seçim butonları */}
      <div className="flex-shrink-0 px-2 py-2" style={{ borderTop: `1px solid ${border}` }}>
        <p className="text-[9px] font-semibold mb-1.5 text-center" style={{ color: textS }}>
          <i className="ri-body-scan-line mr-1" />Etkilenen bölgeyi seç
        </p>
        <div className="flex flex-wrap gap-1 justify-center">
          {BODY_PARTS.map(part => {
            const isSel = selected.includes(part.id);
            return (
              <button
                key={part.id}
                onClick={() => onToggle(part.id)}
                className="px-2 py-0.5 rounded-full text-[9px] font-medium cursor-pointer transition-all whitespace-nowrap"
                style={{
                  background: isSel ? ACCENT : cardBg,
                  color: isSel ? '#fff' : textS,
                  border: `1px solid ${isSel ? ACCENT : border}`,
                }}
              >
                {isSel && <i className="ri-check-line mr-0.5" />}
                {part.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
