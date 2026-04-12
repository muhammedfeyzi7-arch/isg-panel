import { useState } from 'react';

const ACCENT = '#0EA5E9';

interface BodyRegion {
  id: string;
  label: string;
  // hotspot pozisyonu üstüne (ön/arka view'da)
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

/* ─── Ön yüz SVG — anatomik kaslı erkek ─── */
function FrontBodySVG({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const [hov, setHov] = useState<string | null>(null);

  const regionColor = (id: string) => {
    if (selected.includes(id)) return 'rgba(239,68,68,0.55)';
    if (hov === id) return 'rgba(249,115,22,0.38)';
    return 'transparent';
  };

  const dotColor = (id: string) => {
    if (selected.includes(id)) return '#EF4444';
    if (hov === id) return '#F97316';
    return 'rgba(255,255,255,0.7)';
  };

  // Tıklanabilir bölge alanları (clip/path ile eşleşen)
  const clickZones: { id: string; path: string }[] = [
    // Baş
    { id: 'bas', path: 'M 172,18 Q 200,8 228,18 Q 248,35 248,62 Q 248,88 228,98 Q 200,106 172,98 Q 152,88 152,62 Q 152,35 172,18 Z' },
    // Boyun
    { id: 'boyun', path: 'M 184,98 L 216,98 L 220,116 L 180,116 Z' },
    // Sol omuz
    { id: 'sol_omuz', path: 'M 148,112 Q 168,108 180,116 L 158,148 Q 138,148 128,134 Z' },
    // Sağ omuz
    { id: 'sag_omuz', path: 'M 252,112 Q 232,108 220,116 L 242,148 Q 262,148 272,134 Z' },
    // Sol kol (üst + ön)
    { id: 'sol_kol', path: 'M 128,134 L 110,220 L 126,224 L 148,148 Z' },
    // Sağ kol
    { id: 'sag_kol', path: 'M 272,134 L 290,220 L 274,224 L 252,148 Z' },
    // Göğüs
    { id: 'gogus', path: 'M 180,116 L 220,116 L 234,190 L 200,196 L 166,190 Z' },
    // Karın
    { id: 'karin', path: 'M 166,190 L 200,196 L 234,190 L 238,252 L 200,260 L 162,252 Z' },
    // Sol el
    { id: 'sol_el', path: 'M 100,224 L 110,220 L 126,266 L 116,272 Z' },
    // Sağ el
    { id: 'sag_el', path: 'M 300,224 L 290,220 L 274,266 L 284,272 Z' },
    // Sol kalça/uyluk
    { id: 'sol_kalca', path: 'M 162,252 L 200,260 L 194,316 L 162,316 Z' },
    // Sağ kalça/uyluk
    { id: 'sag_kalca', path: 'M 238,252 L 200,260 L 206,316 L 238,316 Z' },
    // Sol bacak
    { id: 'sol_bacak', path: 'M 162,316 L 194,316 L 190,406 L 164,406 Z' },
    // Sağ bacak
    { id: 'sag_bacak', path: 'M 238,316 L 206,316 L 210,406 L 236,406 Z' },
    // Sol ayak
    { id: 'sol_ayak', path: 'M 164,406 L 190,406 L 188,448 L 148,448 L 148,440 Z' },
    // Sağ ayak
    { id: 'sag_ayak', path: 'M 210,406 L 236,406 L 252,440 L 252,448 L 212,448 Z' },
  ];

  return (
    <svg viewBox="0 0 400 470" width="100%" height="100%" style={{ userSelect: 'none' }}>
      <defs>
        {/* Cilt dokusu gradient */}
        <radialGradient id="skinGrad" cx="45%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#d4a882" />
          <stop offset="55%" stopColor="#b8845a" />
          <stop offset="100%" stopColor="#8a5c38" />
        </radialGradient>
        <radialGradient id="skinGradDark" cx="40%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#c49060" />
          <stop offset="60%" stopColor="#9e6c42" />
          <stop offset="100%" stopColor="#6e4422" />
        </radialGradient>
        {/* Kas highlight gradient */}
        <linearGradient id="muscleHL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,220,180,0.0)" />
          <stop offset="40%" stopColor="rgba(255,220,180,0.22)" />
          <stop offset="55%" stopColor="rgba(255,220,180,0.08)" />
          <stop offset="100%" stopColor="rgba(255,220,180,0.0)" />
        </linearGradient>
        {/* Glow filtre */}
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glowSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ════ GÖVDE ANA ŞEKLI ════ */}

      {/* Bacaklar */}
      {/* Sol bacak */}
      <path d="M 162,252 L 194,316 L 190,406 L 164,418 L 148,448 L 162,252 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      {/* Sağ bacak */}
      <path d="M 238,252 L 206,316 L 210,406 L 236,418 L 252,448 L 238,252 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />

      {/* Ayaklar */}
      <path d="M 148,440 Q 150,448 172,450 Q 188,452 190,448 L 190,406 L 164,406 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      <path d="M 252,440 Q 250,448 228,450 Q 212,452 210,448 L 210,406 L 236,406 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />

      {/* ─── Kas çizgileri bacak ─── */}
      {/* Quadriceps orta çizgi sol */}
      <path d="M 176,264 Q 178,300 176,326 Q 175,360 174,400"
        fill="none" stroke="rgba(80,40,20,0.25)" strokeWidth="1.2" />
      {/* Quadriceps orta çizgi sağ */}
      <path d="M 224,264 Q 222,300 224,326 Q 225,360 226,400"
        fill="none" stroke="rgba(80,40,20,0.25)" strokeWidth="1.2" />
      {/* Diz üstü highlight sol */}
      <ellipse cx="176" cy="322" rx="12" ry="8" fill="rgba(255,200,150,0.18)" />
      <ellipse cx="224" cy="322" rx="12" ry="8" fill="rgba(255,200,150,0.18)" />
      {/* Baldır highlight */}
      <path d="M 170,336 Q 173,360 172,390" fill="none" stroke="rgba(255,190,130,0.20)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 230,336 Q 227,360 228,390" fill="none" stroke="rgba(255,190,130,0.20)" strokeWidth="4" strokeLinecap="round" />

      {/* Gövde (torso) */}
      <path d="M 180,116 Q 156,120 148,148 Q 138,172 140,200 Q 142,230 156,250 Q 170,264 200,268 Q 230,264 244,250 Q 258,230 260,200 Q 262,172 252,148 Q 244,120 220,116 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />

      {/* ─── Pektoral kaslar ─── */}
      {/* Sol pektoral */}
      <path d="M 182,122 Q 164,130 160,148 Q 160,162 172,168 Q 186,172 198,166 L 198,122 Z"
        fill="rgba(140,80,40,0.18)" stroke="none" />
      {/* Sol pektoral highlight */}
      <path d="M 190,126 Q 172,138 170,154 Q 171,160 178,162"
        fill="none" stroke="rgba(255,210,170,0.28)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Sol pektoral alt çizgi */}
      <path d="M 162,166 Q 178,172 198,168"
        fill="none" stroke="rgba(80,40,18,0.30)" strokeWidth="1.4" strokeLinecap="round" />

      {/* Sağ pektoral */}
      <path d="M 218,122 Q 236,130 240,148 Q 240,162 228,168 Q 214,172 202,166 L 202,122 Z"
        fill="rgba(140,80,40,0.18)" stroke="none" />
      {/* Sağ pektoral highlight */}
      <path d="M 210,126 Q 228,138 230,154 Q 229,160 222,162"
        fill="none" stroke="rgba(255,210,170,0.28)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Sağ pektoral alt çizgi */}
      <path d="M 238,166 Q 222,172 202,168"
        fill="none" stroke="rgba(80,40,18,0.30)" strokeWidth="1.4" strokeLinecap="round" />

      {/* Göğüs orta çizgi */}
      <line x1="200" y1="116" x2="200" y2="192" stroke="rgba(80,40,18,0.22)" strokeWidth="1.2" />

      {/* ─── Karın kasları (6 paket) ─── */}
      {[0, 1, 2].map(row => (
        <g key={row}>
          {/* Sol abs */}
          <ellipse cx="190" cy={196 + row * 20} rx="9" ry="7"
            fill="rgba(120,70,30,0.14)" stroke="rgba(80,40,18,0.18)" strokeWidth="0.8" />
          {/* Sağ abs */}
          <ellipse cx="210" cy={196 + row * 20} rx="9" ry="7"
            fill="rgba(120,70,30,0.14)" stroke="rgba(80,40,18,0.18)" strokeWidth="0.8" />
          {/* Highlight */}
          <ellipse cx="188" cy={194 + row * 20} rx="4" ry="2.5" fill="rgba(255,200,150,0.18)" />
          <ellipse cx="208" cy={194 + row * 20} rx="4" ry="2.5" fill="rgba(255,200,150,0.18)" />
        </g>
      ))}
      {/* Linea alba (orta dikey) */}
      <line x1="200" y1="192" x2="200" y2="256" stroke="rgba(80,40,18,0.20)" strokeWidth="1.0" />
      {/* Göbek */}
      <ellipse cx="200" cy="237" rx="4" ry="3" fill="rgba(80,40,18,0.22)" stroke="rgba(60,30,10,0.3)" strokeWidth="0.8" />

      {/* ─── Serratus (kaburga kenarı) ─── */}
      {[0, 1, 2].map(i => (
        <g key={i}>
          <path d={`M ${158 + i * 2},${172 + i * 12} Q ${148 + i * 2},${178 + i * 12} ${152 + i},${186 + i * 12}`}
            fill="none" stroke="rgba(80,40,18,0.18)" strokeWidth="1.2" strokeLinecap="round" />
          <path d={`M ${242 - i * 2},${172 + i * 12} Q ${252 - i * 2},${178 + i * 12} ${248 - i},${186 + i * 12}`}
            fill="none" stroke="rgba(80,40,18,0.18)" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      ))}

      {/* Kollar */}
      {/* Sol kol */}
      <path d="M 148,148 Q 130,150 118,178 Q 108,208 110,222 Q 114,230 124,232 Q 130,230 128,218 Q 128,194 140,164 L 148,148 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      {/* Sol kol biseps highlight */}
      <path d="M 142,154 Q 128,172 124,198 Q 125,210 128,216"
        fill="none" stroke="rgba(255,210,170,0.22)" strokeWidth="3" strokeLinecap="round" />
      {/* Sağ kol */}
      <path d="M 252,148 Q 270,150 282,178 Q 292,208 290,222 Q 286,230 276,232 Q 270,230 272,218 Q 272,194 260,164 L 252,148 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      {/* Sağ kol biseps highlight */}
      <path d="M 258,154 Q 272,172 276,198 Q 275,210 272,216"
        fill="none" stroke="rgba(255,210,170,0.22)" strokeWidth="3" strokeLinecap="round" />

      {/* Ön kollar */}
      {/* Sol ön kol */}
      <path d="M 110,222 Q 100,240 100,258 Q 100,270 106,274 L 118,270 Q 122,260 124,232 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      {/* Sağ ön kol */}
      <path d="M 290,222 Q 300,240 300,258 Q 300,270 294,274 L 282,270 Q 278,260 276,232 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />

      {/* Eller */}
      <path d="M 100,258 Q 96,272 100,282 Q 106,292 116,292 Q 124,292 126,278 L 118,270 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      <path d="M 300,258 Q 304,272 300,282 Q 294,292 284,292 Q 276,292 274,278 L 282,270 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />

      {/* Omuzlar */}
      <path d="M 180,116 Q 158,110 148,120 Q 140,130 142,144 Q 144,152 150,154 L 162,148 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      <path d="M 220,116 Q 242,110 252,120 Q 260,130 258,144 Q 256,152 250,154 L 238,148 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      {/* Omuz deltoid highlight */}
      <path d="M 150,128 Q 144,138 145,148" fill="none" stroke="rgba(255,210,170,0.30)" strokeWidth="3" strokeLinecap="round" />
      <path d="M 250,128 Q 256,138 255,148" fill="none" stroke="rgba(255,210,170,0.30)" strokeWidth="3" strokeLinecap="round" />

      {/* Boyun */}
      <path d="M 184,98 Q 178,104 180,116 L 220,116 Q 222,104 216,98 Z"
        fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      {/* Sternokleid kas çizgisi */}
      <path d="M 192,100 Q 186,106 184,116" fill="none" stroke="rgba(80,40,18,0.20)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 208,100 Q 214,106 216,116" fill="none" stroke="rgba(80,40,18,0.20)" strokeWidth="1.4" strokeLinecap="round" />

      {/* Klavikula çizgileri */}
      <path d="M 184,118 Q 166,116 155,122" fill="none" stroke="rgba(80,40,18,0.22)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 216,118 Q 234,116 245,122" fill="none" stroke="rgba(80,40,18,0.22)" strokeWidth="1.4" strokeLinecap="round" />

      {/* Kafa */}
      <ellipse cx="200" cy="58" rx="34" ry="42" fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.8" />
      {/* Yüz detayları */}
      {/* Kaşlar */}
      <path d="M 183,46 Q 190,44 196,46" fill="none" stroke="rgba(60,30,10,0.55)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 204,46 Q 210,44 217,46" fill="none" stroke="rgba(60,30,10,0.55)" strokeWidth="2.2" strokeLinecap="round" />
      {/* Gözler */}
      <ellipse cx="189" cy="52" rx="5.5" ry="3.8" fill="rgba(40,20,8,0.75)" />
      <ellipse cx="211" cy="52" rx="5.5" ry="3.8" fill="rgba(40,20,8,0.75)" />
      <circle cx="189" cy="52" r="2.2" fill="rgba(20,10,4,0.9)" />
      <circle cx="211" cy="52" r="2.2" fill="rgba(20,10,4,0.9)" />
      <circle cx="190" cy="51" r="0.8" fill="rgba(255,255,255,0.7)" />
      <circle cx="212" cy="51" r="0.8" fill="rgba(255,255,255,0.7)" />
      {/* Burun */}
      <path d="M 200,54 Q 198,62 196,66 Q 200,68 204,66 Q 202,62 200,54" fill="rgba(80,40,18,0.20)" stroke="none" />
      {/* Ağız */}
      <path d="M 193,72 Q 200,76 207,72" fill="none" stroke="rgba(80,40,18,0.38)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Kulaklar */}
      <path d="M 166,52 Q 162,58 165,66 Q 168,70 172,68 Q 170,58 172,52 Z" fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.7" />
      <path d="M 234,52 Q 238,58 235,66 Q 232,70 228,68 Q 230,58 228,52 Z" fill="url(#skinGrad)" stroke="#8a5c38" strokeWidth="0.7" />
      {/* Saç */}
      <path d="M 168,36 Q 184,18 200,16 Q 216,18 232,36 Q 238,44 236,28 Q 220,12 200,10 Q 180,12 164,28 Z"
        fill="rgba(40,22,8,0.80)" stroke="none" />

      {/* ════ TIKLANABİLİR BÖLGELER ════ */}
      {clickZones.map(z => (
        <path
          key={z.id}
          d={z.path}
          fill={regionColor(z.id)}
          stroke={selected.includes(z.id) ? '#EF4444' : hov === z.id ? '#F97316' : 'transparent'}
          strokeWidth="1.5"
          style={{ cursor: 'pointer', transition: 'fill 0.15s, stroke 0.15s' }}
          onClick={() => onToggle(z.id)}
          onMouseEnter={() => setHov(z.id)}
          onMouseLeave={() => setHov(null)}
        />
      ))}

      {/* ════ HOTSPOT NOKTALAR ════ */}
      {REGIONS.filter(r => r.frontDot).map(r => {
        const dot = r.frontDot!;
        const isSel = selected.includes(r.id);
        const isHov = hov === r.id;
        if (!isSel && !isHov) return null;
        return (
          <g key={r.id} filter={isSel ? 'url(#glow)' : undefined}>
            <circle cx={dot.cx} cy={dot.cy} r={isSel ? 9 : 7} fill={isSel ? 'rgba(239,68,68,0.25)' : 'rgba(249,115,22,0.20)'} />
            <circle cx={dot.cx} cy={dot.cy} r={isSel ? 4.5 : 3.5} fill={isSel ? '#EF4444' : '#F97316'} />
            <circle cx={dot.cx - 1} cy={dot.cy - 1} r={1.2} fill="rgba(255,255,255,0.8)" />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Arka yüz SVG ─── */
function BackBodySVG({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const [hov, setHov] = useState<string | null>(null);

  const regionColor = (id: string) => {
    if (selected.includes(id)) return 'rgba(239,68,68,0.55)';
    if (hov === id) return 'rgba(249,115,22,0.38)';
    return 'transparent';
  };

  const backZones: { id: string; path: string }[] = [
    { id: 'bas',       path: 'M 172,18 Q 200,8 228,18 Q 248,35 248,62 Q 248,88 228,98 Q 200,106 172,98 Q 152,88 152,62 Q 152,35 172,18 Z' },
    { id: 'boyun',     path: 'M 184,98 L 216,98 L 220,116 L 180,116 Z' },
    { id: 'sol_omuz',  path: 'M 148,112 Q 168,108 180,116 L 158,148 Q 138,148 128,134 Z' },
    { id: 'sag_omuz',  path: 'M 252,112 Q 232,108 220,116 L 242,148 Q 262,148 272,134 Z' },
    { id: 'sol_kol',   path: 'M 128,134 L 110,220 L 126,224 L 148,148 Z' },
    { id: 'sag_kol',   path: 'M 272,134 L 290,220 L 274,224 L 252,148 Z' },
    { id: 'sirt',      path: 'M 180,116 L 220,116 L 234,190 L 200,196 L 166,190 Z' },
    { id: 'karin',     path: 'M 166,190 L 200,196 L 234,190 L 238,252 L 200,260 L 162,252 Z' },
    { id: 'sol_el',    path: 'M 100,224 L 110,220 L 126,266 L 116,272 Z' },
    { id: 'sag_el',    path: 'M 300,224 L 290,220 L 274,266 L 284,272 Z' },
    { id: 'sol_kalca', path: 'M 162,252 L 200,260 L 194,316 L 162,316 Z' },
    { id: 'sag_kalca', path: 'M 238,252 L 200,260 L 206,316 L 238,316 Z' },
    { id: 'sol_bacak', path: 'M 162,316 L 194,316 L 190,406 L 164,406 Z' },
    { id: 'sag_bacak', path: 'M 238,316 L 206,316 L 210,406 L 236,406 Z' },
    { id: 'sol_ayak',  path: 'M 164,406 L 190,406 L 188,448 L 148,448 L 148,440 Z' },
    { id: 'sag_ayak',  path: 'M 210,406 L 236,406 L 252,440 L 252,448 L 212,448 Z' },
  ];

  return (
    <svg viewBox="0 0 400 470" width="100%" height="100%" style={{ userSelect: 'none' }}>
      <defs>
        <radialGradient id="skinGradB" cx="55%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#c49060" />
          <stop offset="55%" stopColor="#a87040" />
          <stop offset="100%" stopColor="#7a4e28" />
        </radialGradient>
        <filter id="glowB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Bacaklar arka */}
      <path d="M 162,252 L 194,316 L 190,406 L 164,418 L 148,448 L 162,252 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      <path d="M 238,252 L 206,316 L 210,406 L 236,418 L 252,448 L 238,252 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      {/* Ayaklar arka */}
      <path d="M 148,440 Q 148,450 170,452 Q 188,454 188,448 L 190,406 L 164,406 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      <path d="M 252,440 Q 252,450 230,452 Q 212,454 212,448 L 210,406 L 236,406 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      {/* Hamstring sol */}
      <path d="M 178,262 Q 174,300 172,326 Q 171,360 172,400" fill="none" stroke="rgba(60,28,8,0.22)" strokeWidth="1.2" />
      <path d="M 186,264 Q 188,300 188,326" fill="none" stroke="rgba(60,28,8,0.18)" strokeWidth="1.0" />
      {/* Hamstring sağ */}
      <path d="M 222,262 Q 226,300 228,326 Q 229,360 228,400" fill="none" stroke="rgba(60,28,8,0.22)" strokeWidth="1.2" />
      <path d="M 214,264 Q 212,300 212,326" fill="none" stroke="rgba(60,28,8,0.18)" strokeWidth="1.0" />
      {/* Baldır arka highlight */}
      <path d="M 173,332 Q 170,355 172,388" fill="none" stroke="rgba(200,150,100,0.22)" strokeWidth="5" strokeLinecap="round" />
      <path d="M 227,332 Q 230,355 228,388" fill="none" stroke="rgba(200,150,100,0.22)" strokeWidth="5" strokeLinecap="round" />

      {/* Torso arka */}
      <path d="M 180,116 Q 156,120 148,148 Q 138,172 140,200 Q 142,230 156,250 Q 170,264 200,268 Q 230,264 244,250 Q 258,230 260,200 Q 262,172 252,148 Q 244,120 220,116 Z"
        fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />

      {/* Sırt omurga çizgisi */}
      <line x1="200" y1="118" x2="200" y2="262" stroke="rgba(60,28,8,0.28)" strokeWidth="1.5" />
      {/* Omurga kemik çıkıntıları */}
      {[130, 148, 166, 184, 202, 218, 234, 250].map((y, i) => (
        <ellipse key={i} cx="200" cy={y} rx="3.5" ry="2.5" fill="rgba(200,140,80,0.25)" stroke="rgba(60,28,8,0.15)" strokeWidth="0.6" />
      ))}
      {/* Erector spinae (omurga yanı kaslar) */}
      <path d="M 191,122 Q 188,180 188,245" fill="none" stroke="rgba(140,80,30,0.22)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 209,122 Q 212,180 212,245" fill="none" stroke="rgba(140,80,30,0.22)" strokeWidth="4" strokeLinecap="round" />
      {/* Latissimus dorsi */}
      <path d="M 152,148 Q 158,186 166,210 Q 175,230 190,244" fill="none" stroke="rgba(100,55,20,0.22)" strokeWidth="5" strokeLinecap="round" />
      <path d="M 248,148 Q 242,186 234,210 Q 225,230 210,244" fill="none" stroke="rgba(100,55,20,0.22)" strokeWidth="5" strokeLinecap="round" />
      {/* Trapezius (üst sırt) */}
      <path d="M 184,118 Q 172,130 162,140 Q 156,148 152,152" fill="none" stroke="rgba(120,65,25,0.25)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 216,118 Q 228,130 238,140 Q 244,148 248,152" fill="none" stroke="rgba(120,65,25,0.25)" strokeWidth="4" strokeLinecap="round" />
      {/* Kürek kemiği */}
      <path d="M 163,136 Q 168,152 164,168 Q 172,164 178,156 Z" fill="rgba(200,150,90,0.14)" stroke="rgba(100,55,20,0.16)" strokeWidth="0.8" />
      <path d="M 237,136 Q 232,152 236,168 Q 228,164 222,156 Z" fill="rgba(200,150,90,0.14)" stroke="rgba(100,55,20,0.16)" strokeWidth="0.8" />

      {/* Kollar arka */}
      <path d="M 148,148 Q 130,150 118,178 Q 108,208 110,222 Q 114,230 124,232 Q 130,230 128,218 Q 128,194 140,164 L 148,148 Z"
        fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      <path d="M 252,148 Q 270,150 282,178 Q 292,208 290,222 Q 286,230 276,232 Q 270,230 272,218 Q 272,194 260,164 L 252,148 Z"
        fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      {/* Triseps highlight */}
      <path d="M 140,158 Q 128,180 124,206" fill="none" stroke="rgba(200,150,100,0.25)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 260,158 Q 272,180 276,206" fill="none" stroke="rgba(200,150,100,0.25)" strokeWidth="3.5" strokeLinecap="round" />

      {/* Ön kollar arka */}
      <path d="M 110,222 Q 100,240 100,258 Q 100,270 106,274 L 118,270 Q 122,260 124,232 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      <path d="M 290,222 Q 300,240 300,258 Q 300,270 294,274 L 282,270 Q 278,260 276,232 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      {/* Eller arka */}
      <path d="M 100,258 Q 96,272 100,282 Q 106,292 116,292 Q 124,292 126,278 L 118,270 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      <path d="M 300,258 Q 304,272 300,282 Q 294,292 284,292 Q 276,292 274,278 L 282,270 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      {/* Omuzlar arka */}
      <path d="M 180,116 Q 158,110 148,120 Q 140,130 142,144 Q 144,152 150,154 L 162,148 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      <path d="M 220,116 Q 242,110 252,120 Q 260,130 258,144 Q 256,152 250,154 L 238,148 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      {/* Boyun arka */}
      <path d="M 184,98 Q 178,104 180,116 L 220,116 Q 222,104 216,98 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      {/* Kafa arka */}
      <ellipse cx="200" cy="58" rx="34" ry="42" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.8" />
      {/* Saç arka */}
      <path d="M 168,18 Q 184,10 200,10 Q 216,10 232,18 Q 240,26 238,42 Q 226,12 200,12 Q 174,12 162,42 Z" fill="rgba(40,22,8,0.80)" />
      {/* Kulaklar arka */}
      <path d="M 166,52 Q 162,58 165,66 Q 168,70 172,68 Q 170,58 172,52 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.7" />
      <path d="M 234,52 Q 238,58 235,66 Q 232,70 228,68 Q 230,58 228,52 Z" fill="url(#skinGradB)" stroke="#7a4e28" strokeWidth="0.7" />

      {/* Tıklanabilir bölgeler */}
      {backZones.map(z => (
        <path key={z.id} d={z.path}
          fill={regionColor(z.id)}
          stroke={selected.includes(z.id) ? '#EF4444' : hov === z.id ? '#F97316' : 'transparent'}
          strokeWidth="1.5"
          style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
          onClick={() => onToggle(z.id)}
          onMouseEnter={() => setHov(z.id)}
          onMouseLeave={() => setHov(null)}
        />
      ))}

      {/* Hotspot noktalar */}
      {REGIONS.filter(r => r.backDot).map(r => {
        const dot = r.backDot!;
        const isSel = selected.includes(r.id);
        const isHov = hov === r.id;
        if (!isSel && !isHov) return null;
        return (
          <g key={r.id} filter={isSel ? 'url(#glowB)' : undefined}>
            <circle cx={dot.cx} cy={dot.cy} r={isSel ? 9 : 7} fill={isSel ? 'rgba(239,68,68,0.25)' : 'rgba(249,115,22,0.20)'} />
            <circle cx={dot.cx} cy={dot.cy} r={isSel ? 4.5 : 3.5} fill={isSel ? '#EF4444' : '#F97316'} />
          </g>
        );
      })}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════
   EXPORT — ön/arka toggle
══════════════════════════════════════════════════════ */
interface Human3DModelProps {
  selected: string[];
  onToggle: (id: string) => void;
  isDark: boolean;
}

export default function Human3DModel({ selected, onToggle, isDark }: Human3DModelProps) {
  const [view, setView] = useState<'front' | 'back'>('front');

  const bg     = isDark ? '#0c1628' : '#eef4fb';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const textS  = isDark ? '#64748b' : '#94a3b8';

  return (
    <div className="w-full h-full flex flex-col" style={{ background: bg }}>
      {/* Ön/Arka toggle */}
      <div className="flex items-center justify-center gap-2 pt-3 pb-1 flex-shrink-0">
        {(['front', 'back'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap"
            style={{
              background: view === v ? ACCENT : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'),
              color: view === v ? '#fff' : textS,
              border: `1px solid ${view === v ? ACCENT : border}`,
            }}
          >
            {v === 'front' ? 'Ön Yüz' : 'Arka Yüz'}
          </button>
        ))}
      </div>

      {/* SVG */}
      <div className="flex-1 flex items-center justify-center px-4 pb-3" style={{ minHeight: 0 }}>
        <div style={{ width: '100%', maxWidth: 220, aspectRatio: '400/470' }}>
          {view === 'front'
            ? <FrontBodySVG selected={selected} onToggle={onToggle} />
            : <BackBodySVG  selected={selected} onToggle={onToggle} />
          }
        </div>
      </div>

      {/* İpucu */}
      <div className="text-center pb-2 flex-shrink-0">
        <span className="text-[9px]" style={{ color: textS }}>
          <i className="ri-cursor-line mr-1" />Bölgeye tıklayarak seç · Tekrar tıkla: kaldır
        </span>
      </div>
    </div>
  );
}
