/**
 * PersonelKartvizit — Ultra Premium Business Card
 * Dark/Light mode aware. 3D flip. Holographic shimmer.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/store/AppContext';

interface Props {
  personelId: string | null;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'Aktif':   { label: 'AKTİF',   color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.28)' },
  'Pasif':   { label: 'PASİF',   color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)' },
  'Ayrıldı': { label: 'AYRILDI', color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)' },
};

const ACCENT_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9'];

function getAccent(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return ACCENT_COLORS[Math.abs(h) % ACCENT_COLORS.length];
}

function getInitials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] ?? '?').toUpperCase();
}

/* ── Tiny dot grid pattern (SVG data URI) ── */
function dotPattern(color: string) {
  const encoded = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='1' cy='1' r='1' fill='${color}'/></svg>`
  );
  return `url("data:image/svg+xml,${encoded}")`;
}

export default function PersonelKartvizit({ personelId, onClose }: Props) {
  const { personeller, firmalar, getPersonelFoto, theme } = useApp();
  const overlayRef = useRef<HTMLDivElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const [imgErr, setImgErr]   = useState(false);
  const [flipped, setFlipped] = useState(false);

  const isDark = theme === 'dark';

  const personel = personelId ? personeller.find(p => p.id === personelId) ?? null : null;
  const firma    = personel ? firmalar.find(f => f.id === personel.firmaId) : null;
  const fotoUrl  = personelId ? getPersonelFoto(personelId) : null;
  const accent   = personel ? getAccent(personel.adSoyad) : '#6366F1';
  const initials = personel ? getInitials(personel.adSoyad) : '?';
  const status   = STATUS_CONFIG[personel?.durum ?? ''] ?? STATUS_CONFIG['Pasif'];
  const showFoto = !!(fotoUrl && !imgErr);

  useEffect(() => { setImgErr(false); setFlipped(false); }, [personelId]);

  useEffect(() => {
    if (!personelId) return;
    requestAnimationFrame(() => {
      if (overlayRef.current) overlayRef.current.style.opacity = '1';
      if (wrapRef.current) { wrapRef.current.style.transform = 'translateY(0) scale(1)'; wrapRef.current.style.opacity = '1'; }
    });
  }, [personelId]);

  const close = () => {
    if (overlayRef.current) overlayRef.current.style.opacity = '0';
    if (wrapRef.current) { wrapRef.current.style.transform = 'translateY(18px) scale(0.96)'; wrapRef.current.style.opacity = '0'; }
    setTimeout(onClose, 220);
  };

  if (!personelId || !personel) return null;

  const maskedTc = personel.tc?.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 **** $3') ?? null;

  /* ── Theme tokens ── */
  const overlayBg   = isDark ? 'rgba(0,0,0,0.82)' : 'rgba(15,23,42,0.55)';

  /* CARD — dark: deep navy gradient / light: crisp white */
  const cardFrontBg = isDark
    ? `linear-gradient(145deg, #0D1526 0%, #111827 40%, #0F1E3A 100%)`
    : `linear-gradient(145deg, #FFFFFF 0%, #F8FAFF 60%, #EEF2FF 100%)`;
  const cardBackBg  = isDark
    ? `linear-gradient(145deg, #0A1020 0%, #0F172A 100%)`
    : `linear-gradient(145deg, #F1F5FF 0%, #E8EEFF 100%)`;

  const cardShadow  = isDark
    ? `0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)`
    : `0 32px 72px rgba(15,23,42,0.22), 0 0 0 1px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.9)`;

  const nameColor   = isDark ? '#F1F5F9' : '#0F172A';
  const roleColor   = accent;
  const subColor    = isDark ? 'rgba(148,163,184,0.75)' : '#64748B';
  const contactColor= isDark ? '#CBD5E1' : '#334155';
  const chipBg      = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)';
  const chipBorder  = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(15,23,42,0.1)';
  const dividerColor= isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const backInfoBg  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const backInfoBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)';
  const backLabelColor = isDark ? 'rgba(148,163,184,0.55)' : '#94A3B8';
  const backValueColor = isDark ? '#E2E8F0' : '#1E293B';
  const hintColor   = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.35)';
  const btnCloseBg  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const btnCloseBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)';
  const btnCloseColor  = isDark ? '#94A3B8' : '#64748B';
  const dotColor    = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.07)';
  const stripeBg    = isDark
    ? 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.55) 100%)'
    : 'linear-gradient(180deg, rgba(15,23,42,0.12) 0%, rgba(15,23,42,0.22) 50%, rgba(15,23,42,0.12) 100%)';
  const logoColor   = isDark ? `${accent}` : accent;
  const barcodeColor= isDark ? `${accent}55` : `${accent}40`;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: overlayBg, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', opacity: 0, transition: 'opacity 0.25s ease', zIndex: 99999 }}
      onClick={e => { if (e.target === overlayRef.current) close(); }}
    >
      <div
        ref={wrapRef}
        className="flex flex-col items-center gap-4 w-full px-2 sm:px-0"
        style={{ maxWidth: '500px', transform: 'translateY(20px) scale(0.96)', opacity: 0, transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease' }}
      >
        {/* Flip hint */}
        <p style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: hintColor }}>
          <i className="ri-refresh-line" style={{ marginRight: '6px' }} />Kartı çevirmek için tıkla
        </p>

        {/* ── 3D Card ── */}
        <div
          className="w-full cursor-pointer"
          style={{ perspective: '1400px', height: 'clamp(220px, 45vw, 270px)' }}
          onClick={() => setFlipped(f => !f)}
        >
          <div style={{
            width: '100%', height: '100%', position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.7s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>

            {/* ══════════════ FRONT ══════════════ */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              borderRadius: '22px', overflow: 'hidden',
              background: cardFrontBg, boxShadow: cardShadow,
            }}>
              {/* Dot pattern */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: dotPattern(dotColor), backgroundSize: '20px 20px', pointerEvents: 'none', opacity: 0.8 }} />

              {/* Accent glow blob */}
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-60px', left: '-20px', width: '180px', height: '180px', borderRadius: '50%', background: `radial-gradient(circle, ${accent}10 0%, transparent 70%)`, pointerEvents: 'none' }} />

              {/* Top accent bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `linear-gradient(90deg, transparent 0%, ${accent} 30%, ${accent}cc 70%, transparent 100%)` }} />

              {/* Decorative ring */}
              <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '180px', height: '180px', borderRadius: '50%', border: `1px solid ${accent}20`, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '-25px', right: '-25px', width: '120px', height: '120px', borderRadius: '50%', border: `1px solid ${accent}15`, pointerEvents: 'none' }} />

              {/* Content */}
              <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', padding: 'clamp(14px, 4vw, 24px)', gap: 'clamp(12px, 3vw, 22px)' }}>

                {/* LEFT */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', width: 'clamp(72px, 18vw, 96px)', flexShrink: 0 }}>
                  {/* Photo / Initials */}
                  <div style={{
                    width: 'clamp(60px, 15vw, 84px)', height: 'clamp(60px, 15vw, 84px)', borderRadius: '18px', overflow: 'hidden', flexShrink: 0,
                    border: `2px solid ${accent}45`,
                    boxShadow: `0 0 0 5px ${accent}12, 0 10px 28px rgba(0,0,0,0.3)`,
                    background: `linear-gradient(135deg, ${accent}25, ${accent}10)`,
                  }}>
                    {showFoto ? (
                      <img src={fotoUrl!} alt={personel.adSoyad} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={() => setImgErr(true)} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: 800, color: accent, letterSpacing: '-0.02em' }}>
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.09em', padding: '4px 9px', borderRadius: '999px', background: status.bg, color: status.color, border: `1px solid ${status.border}`, whiteSpace: 'nowrap' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: status.color, flexShrink: 0, boxShadow: `0 0 5px ${status.color}` }} />
                    {status.label}
                  </span>

                  {/* Blood type */}
                  {personel.kanGrubu && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.22)', whiteSpace: 'nowrap' }}>
                      <i className="ri-drop-fill" style={{ marginRight: '3px', fontSize: '9px' }} />{personel.kanGrubu}
                    </span>
                  )}
                </div>

                {/* RIGHT */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {/* Top */}
                  <div>
                    {/* Brand tag */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: logoColor, textTransform: 'uppercase', marginBottom: '10px', padding: '3px 8px', borderRadius: '6px', background: `${accent}12`, border: `1px solid ${accent}20` }}>
                      <i className="ri-shield-check-fill" style={{ fontSize: '9px' }} />ISG Denetim
                    </div>

                    <h2 style={{ fontSize: 'clamp(15px, 4vw, 22px)', fontWeight: 900, color: nameColor, letterSpacing: '-0.035em', lineHeight: 1.05, marginBottom: '5px' }}>
                      {personel.adSoyad}
                    </h2>

                    {personel.gorev && (
                      <p style={{ fontSize: '12.5px', fontWeight: 700, color: roleColor, marginBottom: '2px', letterSpacing: '-0.01em' }}>
                        {personel.gorev}
                      </p>
                    )}
                    {personel.departman && (
                      <p style={{ fontSize: '11px', color: subColor, fontWeight: 500 }}>{personel.departman}</p>
                    )}
                    {firma?.ad && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '7px', padding: '4px 8px', borderRadius: '7px', background: chipBg, border: `1px solid ${chipBorder}`, width: 'fit-content' }}>
                        <i className="ri-building-2-line" style={{ fontSize: '10px', color: subColor }} />
                        <span style={{ fontSize: '11px', color: subColor, fontWeight: 500 }}>{firma.ad}</span>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: dividerColor, margin: '8px 0' }} />

                  {/* Contact */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {personel.telefon && (
                      <a href={`tel:${personel.telefon}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: `${accent}15`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className="ri-phone-line" style={{ fontSize: '11px', color: accent }} />
                        </div>
                        <span style={{ fontSize: '12px', color: contactColor, fontWeight: 600 }}>{personel.telefon}</span>
                      </a>
                    )}
                    {personel.email && (
                      <a href={`mailto:${personel.email}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: `${accent}15`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className="ri-mail-line" style={{ fontSize: '11px', color: accent }} />
                        </div>
                        <span style={{ fontSize: '11.5px', color: subColor, fontWeight: 500 }}>{personel.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom accent */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
            </div>

            {/* ══════════════ BACK ══════════════ */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: '22px', overflow: 'hidden',
              background: cardBackBg, boxShadow: cardShadow,
            }}>
              {/* Dot pattern */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: dotPattern(dotColor), backgroundSize: '20px 20px', pointerEvents: 'none', opacity: 0.8 }} />

              {/* Glow */}
              <div style={{ position: 'absolute', bottom: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`, pointerEvents: 'none' }} />

              {/* Top accent */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `linear-gradient(90deg, transparent 0%, ${accent} 30%, ${accent}cc 70%, transparent 100%)` }} />

              {/* Magnetic stripe */}
              <div style={{ position: 'absolute', top: '44px', left: 0, right: 0, height: '46px', background: stripeBg }} />

              {/* Back content */}
              <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 'clamp(14px, 4vw, 24px)', paddingTop: 'clamp(80px, 20vw, 108px)' }}>
                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {personel.iseGirisTarihi && (
                    <div style={{ background: backInfoBg, border: `1px solid ${backInfoBorder}`, borderRadius: '12px', padding: '11px 13px' }}>
                      <p style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.1em', color: backLabelColor, textTransform: 'uppercase', marginBottom: '5px' }}>İşe Giriş</p>
                      <p style={{ fontSize: '12.5px', fontWeight: 700, color: backValueColor }}>
                        {new Date(personel.iseGirisTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {maskedTc && (
                    <div style={{ background: backInfoBg, border: `1px solid ${backInfoBorder}`, borderRadius: '12px', padding: '11px 13px' }}>
                      <p style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.1em', color: backLabelColor, textTransform: 'uppercase', marginBottom: '5px' }}>TC Kimlik</p>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: backValueColor, fontFamily: 'monospace' }}>{maskedTc}</p>
                    </div>
                  )}
                  {personel.acilKisi && (
                    <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', padding: '11px 13px' }}>
                      <p style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(248,113,113,0.65)', textTransform: 'uppercase', marginBottom: '5px' }}>Acil Kişi</p>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#F87171' }}>{personel.acilKisi}</p>
                    </div>
                  )}
                  {personel.acilTelefon && (
                    <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', padding: '11px 13px' }}>
                      <p style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(248,113,113,0.65)', textTransform: 'uppercase', marginBottom: '5px' }}>Acil Tel.</p>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#F87171' }}>{personel.acilTelefon}</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ri-shield-check-fill" style={{ fontSize: '13px', color: accent }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: backLabelColor, letterSpacing: '0.06em' }}>ISG Denetim Sistemi</span>
                  </div>
                  {/* Barcode decoration */}
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '22px' }}>
                    {[3,5,2,4,3,5,2,4,3,5,2,4,3,2,5].map((h, i) => (
                      <div key={i} style={{ width: '2px', height: `${h * 3.5}px`, background: barcodeColor, borderRadius: '1px' }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom accent */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {personel.telefon && (
            <a
              href={`tel:${personel.telefon}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, padding: '9px 18px', borderRadius: '12px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer' }}
              onClick={e => e.stopPropagation()}
            >
              <i className="ri-phone-line" />Ara
            </a>
          )}
          {personel.email && (
            <a
              href={`mailto:${personel.email}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, padding: '9px 18px', borderRadius: '12px', background: `${accent}15`, border: `1px solid ${accent}30`, color: accent, textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer' }}
              onClick={e => e.stopPropagation()}
            >
              <i className="ri-mail-line" />E-posta
            </a>
          )}
          <button
            onClick={close}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, padding: '9px 18px', borderRadius: '12px', background: btnCloseBg, border: `1px solid ${btnCloseBorder}`, color: btnCloseColor, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <i className="ri-close-line" />Kapat
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
