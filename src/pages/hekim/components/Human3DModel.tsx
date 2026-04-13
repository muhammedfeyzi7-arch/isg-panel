import { useState, useRef, useEffect, useCallback } from 'react';

// ── Renk Paleti ──────────────────────────────────────────────────────────────
const RED        = '#EF4444';
const RED_LIGHT  = '#FCA5A5';
const RED_BG     = 'rgba(239,68,68,0.15)';
const RED_BORDER = 'rgba(239,68,68,0.35)';

// ── Vücut bölgesi tanımı ─────────────────────────────────────────────────────
interface BodyRegion {
  id:    string;
  label: string;
  /** SVG viewBox = 400×460 içindeki koordinat */
  cx:    number;
  cy:    number;
  rx:    number;   // yatay yarı-çap
  ry:    number;   // dikey yarı-çap
  /** Klinik not */
  note:  string;
  risk:  'Kritik' | 'Yüksek' | 'Orta' | 'Düşük';
}

const RISK_COLOR: Record<string, string> = {
  Kritik: '#EF4444',
  Yüksek: '#F59E0B',
  Orta:   '#F97316',
  Düşük:  '#10B981',
};

// SVG koordinatları: insan vücudunu temsil eden 400×460 viewBox
const REGIONS: BodyRegion[] = [
  { id: 'bas',       label: 'Baş',        cx: 200, cy:  52, rx: 28, ry: 30, note: 'Kafa travması, beyin sarsıntısı riski yüksek',          risk: 'Kritik' },
  { id: 'boyun',     label: 'Boyun',      cx: 200, cy:  95, rx: 14, ry: 12, note: 'Omurga hasarı — immobilizasyon gerekebilir',              risk: 'Kritik' },
  { id: 'sol_omuz',  label: 'Sol Omuz',   cx: 148, cy: 118, rx: 20, ry: 16, note: 'Rotator cuff, klavikula kırığı değerlendir',              risk: 'Orta'   },
  { id: 'sag_omuz',  label: 'Sağ Omuz',  cx: 252, cy: 118, rx: 20, ry: 16, note: 'Rotator cuff, klavikula kırığı değerlendir',              risk: 'Orta'   },
  { id: 'gogus',     label: 'Göğüs',      cx: 200, cy: 148, rx: 28, ry: 22, note: 'Pnömotoraks, kot kırığı olasılığını göz önünde bulundur', risk: 'Yüksek' },
  { id: 'sirt',      label: 'Sırt',       cx: 200, cy: 155, rx: 28, ry: 22, note: 'Vertebra hasarı olasılığını değerlendir',                 risk: 'Yüksek' },
  { id: 'sol_kol',   label: 'Sol Kol',    cx: 122, cy: 178, rx: 14, ry: 22, note: 'Biseps/humerus kırığı, sinir hasarı',                     risk: 'Düşük'  },
  { id: 'sag_kol',   label: 'Sağ Kol',   cx: 278, cy: 178, rx: 14, ry: 22, note: 'Biseps/humerus kırığı, sinir hasarı',                     risk: 'Düşük'  },
  { id: 'sol_el',    label: 'Sol El',     cx: 106, cy: 258, rx: 14, ry: 18, note: 'Parmak kırıkları, tendon hasarı',                         risk: 'Düşük'  },
  { id: 'sag_el',    label: 'Sağ El',    cx: 294, cy: 258, rx: 14, ry: 18, note: 'Parmak kırıkları, tendon hasarı',                         risk: 'Düşük'  },
  { id: 'karin',     label: 'Karın/Bel', cx: 200, cy: 208, rx: 26, ry: 28, note: 'İç organ hasarı, lomber vertebra değerlendir',             risk: 'Yüksek' },
  { id: 'sol_kalca', label: 'Sol Kalça',  cx: 177, cy: 272, rx: 18, ry: 16, note: 'Kalça eklemi, femur boynu kırığı',                        risk: 'Düşük'  },
  { id: 'sag_kalca', label: 'Sağ Kalça', cx: 223, cy: 272, rx: 18, ry: 16, note: 'Kalça eklemi, femur boynu kırığı',                        risk: 'Düşük'  },
  { id: 'sol_bacak', label: 'Sol Bacak',  cx: 174, cy: 340, rx: 16, ry: 30, note: 'Tibia/fibula kırığı, menisküs hasarı',                    risk: 'Düşük'  },
  { id: 'sag_bacak', label: 'Sağ Bacak', cx: 226, cy: 340, rx: 16, ry: 30, note: 'Tibia/fibula kırığı, menisküs hasarı',                    risk: 'Düşük'  },
  { id: 'sol_ayak',  label: 'Sol Ayak',  cx: 172, cy: 430, rx: 16, ry: 14, note: 'Metatars kırığı, ayak bileği burkulmasi',                  risk: 'Düşük'  },
  { id: 'sag_ayak',  label: 'Sağ Ayak', cx: 228, cy: 430, rx: 16, ry: 14, note: 'Metatars kırığı, ayak bileği burkulmasi',                  risk: 'Düşük'  },
];

// ── Tooltip bileşeni ─────────────────────────────────────────────────────────
interface TooltipProps {
  region: BodyRegion;
  containerRect: DOMRect;
  svgRect: DOMRect;
  isDark: boolean;
  onClose: () => void;
}

function RegionTooltip({ region, svgRect, isDark, onClose }: TooltipProps) {
  // Tooltip'i bölgenin sağına veya soluna konumlandır
  const riskColor = RISK_COLOR[region.risk];
  const bg = isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)';
  const textP = isDark ? '#f1f5f9' : '#0f172a';
  const textS = isDark ? '#94a3b8' : '#64748b';

  // cx/cy → pixel (SVG viewBox 400×460, svgRect ile orantıla)
  const scaleX = svgRect.width  / 400;
  const scaleY = svgRect.height / 460;
  const pxX = svgRect.left + region.cx * scaleX;
  const pxY = svgRect.top  + region.cy * scaleY;

  const TOOLTIP_W = 180;
  const TOOLTIP_H = 64;
  const GAP = 12;

  // Sağa veya sola?
  const placeRight = pxX + TOOLTIP_W + GAP < window.innerWidth - 20;
  const left = placeRight ? pxX + GAP : pxX - TOOLTIP_W - GAP;
  const top  = Math.min(
    Math.max(pxY - TOOLTIP_H / 2, 8),
    window.innerHeight - TOOLTIP_H - 8,
  );

  return (
    <div
      className="fixed pointer-events-none z-[99999] rounded-2xl overflow-hidden"
      style={{
        left,
        top,
        width: TOOLTIP_W,
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: isDark
          ? `0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px ${RED_BORDER}`
          : `0 20px 60px rgba(15,23,42,0.2), 0 0 0 1px ${RED_BORDER}`,
        animation: 'tooltipFadeIn 0.15s ease',
      }}
    >
      {/* Üst kırmızı şerit */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${RED}, transparent)` }} />

      {/* Başlık */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <i className="ri-body-scan-line text-xs" style={{ color: RED }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate" style={{ color: textP }}>{region.label}</p>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}30` }}
          >
            {region.risk} Risk
          </span>
        </div>
        <button
          className="pointer-events-auto w-5 h-5 flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{ color: textS, background: 'transparent' }}
          onClick={onClose}
        >
          <i className="ri-close-line text-xs" />
        </button>
      </div>

    </div>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
interface Human3DModelProps {
  selected: string[];
  onToggle: (id: string) => void;
  isDark: boolean;
}

export default function Human3DModel({ selected, onToggle, isDark }: Human3DModelProps) {
  const [loaded, setLoaded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipRegion, setTooltipRegion] = useState<BodyRegion | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgRect, setSvgRect] = useState<DOMRect | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  const bg = '#060c18';
  const textS = '#334155';
  const border = 'rgba(255,255,255,0.04)';

  const updateRects = useCallback(() => {
    if (svgRef.current)       setSvgRect(svgRef.current.getBoundingClientRect());
    if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    updateRects();
    window.addEventListener('resize', updateRects);
    return () => window.removeEventListener('resize', updateRects);
  }, [updateRects, loaded]);

  const handleEllipseClick = useCallback((region: BodyRegion, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(region.id);
    updateRects();
    setTooltipRegion(prev => (prev?.id === region.id ? null : region));
  }, [onToggle, updateRects]);

  const handleEllipseHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  const dismissTooltip = useCallback(() => setTooltipRegion(null), []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col overflow-hidden relative"
      style={{ background: bg }}
      onClick={dismissTooltip}
    >
      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes hotspotPulse {
          0%, 100% { r: 8; opacity: 0.4; }
          50%       { r: 16; opacity: 0; }
        }
        @keyframes selectedGlow {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
      `}</style>

      {/* ── 3D Model iframe ── */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {!loaded && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: bg, zIndex: 10 }}
          >
            <div className="w-8 h-8 border border-red-600 rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
            <span className="text-xs" style={{ color: textS }}>3D model yükleniyor...</span>
          </div>
        )}
        <iframe
          title="Human Anatomy 3D"
          src="https://sketchfab.com/models/14191ef860b44925be0e94462c84ffe6/embed?autostart=1&ui_controls=1&ui_infos=0&ui_inspector=0&ui_stop=0&ui_watermark=0&ui_watermark_link=0"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          onLoad={() => { setLoaded(true); setTimeout(updateRects, 100); }}
          style={{
            width: '100%', height: '100%', border: 'none', display: 'block',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.4s',
          }}
        />

        {/* ── SVG Hotspot Overlay ── */}
        {loaded && (
          <svg
            ref={svgRef}
            viewBox="0 0 400 460"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none', zIndex: 5 }}
          >
            {REGIONS.map(region => {
              const isSel     = selected.includes(region.id);
              const isHovered = hoveredId === region.id;

              const fillOpacity = isSel ? 0.5 : isHovered ? 0.3 : 0.0;
              const strokeOpacity = isSel || isHovered ? 1 : 0.5;
              const strokeWidth = isSel ? 3 : isHovered ? 2.5 : 1.5;
              const dotR = isSel ? 7 : isHovered ? 8 : 5;

              return (
                <g key={region.id}>
                  {/* Seçiliyse outer pulse ring */}
                  {isSel && (
                    <ellipse
                      cx={region.cx} cy={region.cy}
                      rx={region.rx + 10} ry={region.ry + 10}
                      fill="none"
                      stroke={RED}
                      strokeWidth="1"
                      opacity="0"
                      style={{
                        animation: 'hotspotPulse 1.6s ease-in-out infinite',
                        transformOrigin: `${region.cx}px ${region.cy}px`,
                      }}
                    />
                  )}

                  {/* Inner pulse ring */}
                  {isSel && (
                    <ellipse
                      cx={region.cx} cy={region.cy}
                      rx={region.rx + 4} ry={region.ry + 4}
                      fill="none"
                      stroke={RED}
                      strokeWidth="1.5"
                      opacity="0.4"
                      style={{
                        animation: 'selectedGlow 2s ease-in-out infinite',
                        transformOrigin: `${region.cx}px ${region.cy}px`,
                      }}
                    />
                  )}

                  {/* Tıklanabilir ellipse */}
                  <ellipse
                    cx={region.cx} cy={region.cy}
                    rx={region.rx} ry={region.ry}
                    fill={isSel || isHovered ? RED : 'transparent'}
                    fillOpacity={fillOpacity}
                    stroke={isSel || isHovered ? RED : 'rgba(239,68,68,0.5)'}
                    strokeOpacity={strokeOpacity}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isSel ? 'none' : isHovered ? 'none' : '4 3'}
                    style={{
                      cursor: 'pointer',
                      pointerEvents: 'all',
                      transition: 'fill-opacity 0.2s, stroke-opacity 0.2s',
                      filter: isSel ? `drop-shadow(0 0 8px ${RED}) drop-shadow(0 0 16px ${RED}50)` : isHovered ? `drop-shadow(0 0 4px ${RED})` : 'none',
                    }}
                    onClick={e => handleEllipseClick(region, e as unknown as React.MouseEvent)}
                    onMouseEnter={() => handleEllipseHover(region.id)}
                    onMouseLeave={() => handleEllipseHover(null)}
                  />

                  {/* Merkez nokta */}
                  <circle
                    cx={region.cx} cy={region.cy}
                    r={dotR}
                    fill={isSel ? RED : isHovered ? RED : 'rgba(239,68,68,0.6)'}
                    opacity={isSel || isHovered ? 1 : 0.7}
                    style={{
                      cursor: 'pointer',
                      pointerEvents: 'all',
                      transition: 'r 0.15s, opacity 0.15s',
                      filter: isSel ? `drop-shadow(0 0 6px ${RED}) drop-shadow(0 0 12px ${RED})` : isHovered ? `drop-shadow(0 0 4px ${RED})` : 'none',
                    }}
                    onClick={e => handleEllipseClick(region, e as unknown as React.MouseEvent)}
                    onMouseEnter={() => handleEllipseHover(region.id)}
                    onMouseLeave={() => handleEllipseHover(null)}
                  />

                  {/* Seçili ise label */}
                  {isSel && (
                    <foreignObject
                      x={region.cx + region.rx + 5}
                      y={region.cy - 11}
                      width="76"
                      height="22"
                      style={{ pointerEvents: 'none', overflow: 'visible' }}
                    >
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
                          borderRadius: '6px',
                          padding: '3px 7px',
                          fontSize: '9px',
                          fontWeight: 800,
                          color: '#fff',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          boxShadow: '0 2px 12px rgba(239,68,68,0.6)',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {region.label}
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* ── Seçili Bölge Özet Şeridi ── */}
      {selected.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 flex-wrap"
          style={{
            borderTop: '1px solid rgba(239,68,68,0.15)',
            background: 'rgba(239,68,68,0.05)',
          }}
        >
          <span className="text-[9px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: RED }}>
            <i className="ri-map-pin-2-fill mr-1" />Seçili ({selected.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {selected.map(id => {
              const reg = REGIONS.find(r => r.id === id);
              return (
                <button
                  key={id}
                  onClick={() => onToggle(id)}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold cursor-pointer whitespace-nowrap transition-all"
                  style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.3)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.28)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}
                >
                  {reg?.label ?? id}
                  <i className="ri-close-line text-[8px] ml-0.5" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Renk Kılavuzu ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-3 py-2"
        style={{ borderTop: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-3">
          {[
            { color: 'rgba(239,68,68,0.5)', label: 'Bölge' },
            { color: RED, label: 'Seçili', glow: true },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  background: item.color,
                  boxShadow: (item as { glow?: boolean }).glow ? `0 0 6px ${RED}` : 'none',
                }}
              />
              <span className="text-[9px] font-medium" style={{ color: '#1e293b' }}>{item.label}</span>
            </div>
          ))}
        </div>
        <span className="text-[9px] flex items-center gap-1" style={{ color: '#1e293b' }}>
          <i className="ri-cursor-line text-[9px]" />Bölgeye tıkla
        </span>
      </div>

      {/* ── Tooltip ── */}
      {tooltipRegion && svgRect && containerRect && (
        <RegionTooltip
          region={tooltipRegion}
          containerRect={containerRect}
          svgRect={svgRect}
          isDark={true}
          onClose={dismissTooltip}
        />
      )}
    </div>
  );
}
