/**
 * PersonelKartvizit — Horizontal premium business card modal
 * Modern SaaS-style horizontal layout with dark/light mode support.
 */
import { useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import PersonelAvatar from '@/components/base/PersonelAvatar';

interface Props {
  personelId: string | null;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string; dot: string; glow: boolean;
}> = {
  'Aktif':   { label: 'Aktif',   color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)',  dot: '#34D399', glow: true },
  'Pasif':   { label: 'Pasif',   color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)', dot: '#94A3B8', glow: false },
  'Ayrıldı': { label: 'Ayrıldı', color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', dot: '#F87171', glow: false },
};

interface InfoChipProps {
  icon: string;
  label: string;
  value: string;
  href?: string;
  isDark: boolean;
}

function InfoChip({ icon, label, value, href, isDark }: InfoChipProps) {
  const chipBg     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const labelColor = isDark ? '#475569' : '#94A3B8';
  const valueColor = isDark ? '#CBD5E1' : '#334155';

  const inner = (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 group"
      style={{ background: chipBg, border: `1px solid ${chipBorder}` }}
      onMouseEnter={e => {
        if (href) {
          (e.currentTarget as HTMLDivElement).style.borderColor = isDark ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.25)';
          (e.currentTarget as HTMLDivElement).style.background = isDark ? 'rgba(99,102,241,0.08)' : 'rgba(59,130,246,0.05)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = chipBorder;
        (e.currentTarget as HTMLDivElement).style.background = chipBg;
      }}
    >
      <div
        className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(59,130,246,0.08)', border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(59,130,246,0.15)'}` }}
      >
        <i className={`${icon} text-xs`} style={{ color: isDark ? '#818CF8' : '#3B82F6' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9.5px] font-bold uppercase tracking-wider leading-none mb-0.5" style={{ color: labelColor }}>{label}</p>
        <p className="text-[12px] font-medium truncate leading-tight" style={{ color: valueColor }}>{value}</p>
      </div>
      {href && (
        <i className="ri-external-link-line text-[10px] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: isDark ? '#818CF8' : '#3B82F6' }} />
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
        {inner}
      </a>
    );
  }
  return inner;
}

export default function PersonelKartvizit({ personelId, onClose }: Props) {
  const { personeller, firmalar, getPersonelFoto, theme } = useApp();
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef    = useRef<HTMLDivElement>(null);
  const isDark     = theme === 'dark';

  const personel = personelId ? personeller.find(p => p.id === personelId) ?? null : null;
  const firma    = personel ? firmalar.find(f => f.id === personel.firmaId) : null;
  const fotoUrl  = personelId ? getPersonelFoto(personelId) : undefined;

  // ── Animate in ──
  useEffect(() => {
    if (!personelId) return;
    requestAnimationFrame(() => {
      if (overlayRef.current) overlayRef.current.style.opacity = '1';
      if (cardRef.current) {
        cardRef.current.style.transform = 'translateY(0) scale(1)';
        cardRef.current.style.opacity   = '1';
      }
    });
  }, [personelId]);

  const handleClose = () => {
    if (overlayRef.current) overlayRef.current.style.opacity = '0';
    if (cardRef.current) {
      cardRef.current.style.transform = 'translateY(20px) scale(0.97)';
      cardRef.current.style.opacity   = '0';
    }
    setTimeout(onClose, 200);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  if (!personelId || !personel) return null;

  const statusCfg = STATUS_CONFIG[personel.durum] ?? STATUS_CONFIG['Pasif'];

  // ── Theme tokens ──
  const cardBg      = isDark ? 'rgba(13,20,35,0.98)'   : 'rgba(255,255,255,0.99)';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)';
  const cardShadow  = isDark
    ? '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)'
    : '0 24px 60px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.08)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)';
  const nameColor    = isDark ? '#F1F5F9' : '#0F172A';
  const roleColor    = isDark ? '#818CF8' : '#4F46E5';
  const metaColor    = isDark ? '#475569' : '#94A3B8';
  const leftBg       = isDark
    ? 'linear-gradient(160deg, rgba(30,40,65,0.9) 0%, rgba(15,22,40,0.95) 100%)'
    : 'linear-gradient(160deg, rgba(238,242,255,0.9) 0%, rgba(224,231,255,0.6) 100%)';
  const leftBorder   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.12)';
  const avatarRing   = isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.25)';
  const closeBg      = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)';
  const closeBorder  = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(15,23,42,0.1)';
  const closeColor   = isDark ? '#94A3B8' : '#64748B';

  // Masked TC
  const maskedTc = personel.tc
    ? personel.tc.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 **** $3')
    : null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        opacity: 0,
        transition: 'opacity 0.22s ease',
      }}
      onClick={handleOverlayClick}
    >
      <div
        ref={cardRef}
        className="relative w-full"
        style={{
          maxWidth: '640px',
          transform: 'translateY(20px) scale(0.97)',
          opacity: 0,
          transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease',
          borderRadius: '20px',
          overflow: 'hidden',
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          boxShadow: cardShadow,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px) scale(1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0) scale(1)'; }}
      >
        {/* ── Close button ── */}
        <button
          onClick={handleClose}
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200"
          style={{ background: closeBg, border: `1px solid ${closeBorder}`, color: closeColor }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
            e.currentTarget.style.color = '#EF4444';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = closeBg;
            e.currentTarget.style.borderColor = closeBorder;
            e.currentTarget.style.color = closeColor;
          }}
        >
          <i className="ri-close-line text-sm" />
        </button>

        {/* ══════════════════════════════════════════
            HORIZONTAL LAYOUT
        ══════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row">

          {/* ── LEFT — Avatar panel ── */}
          <div
            className="flex flex-col items-center justify-center gap-4 p-7 sm:p-8"
            style={{
              background: leftBg,
              borderRight: `1px solid ${leftBorder}`,
              minWidth: '180px',
              flexShrink: 0,
            }}
          >
            {/* Avatar with ring */}
            <div
              className="rounded-full p-[3px]"
              style={{
                background: `linear-gradient(135deg, ${avatarRing}, transparent)`,
                boxShadow: `0 0 0 1px ${avatarRing}, 0 8px 28px rgba(0,0,0,0.25)`,
              }}
            >
              <PersonelAvatar
                adSoyad={personel.adSoyad}
                fotoUrl={fotoUrl}
                size="xl"
                ring={false}
              />
            </div>

            {/* Status badge */}
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
              style={{
                background: statusCfg.bg,
                color: statusCfg.color,
                border: `1px solid ${statusCfg.border}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: statusCfg.dot,
                  boxShadow: statusCfg.glow ? `0 0 6px ${statusCfg.dot}` : 'none',
                }}
              />
              {statusCfg.label}
            </span>

            {/* Blood type */}
            {personel.kanGrubu && (
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  color: '#F87171',
                  border: '1px solid rgba(239,68,68,0.22)',
                }}
              >
                <i className="ri-drop-line mr-1 text-[10px]" />
                {personel.kanGrubu}
              </span>
            )}
          </div>

          {/* ── RIGHT — Info panel ── */}
          <div className="flex-1 min-w-0 p-6 flex flex-col gap-4">

            {/* Name + role */}
            <div className="pr-8">
              <h2
                className="text-[20px] font-extrabold leading-tight"
                style={{ color: nameColor, letterSpacing: '-0.02em' }}
              >
                {personel.adSoyad}
              </h2>
              {(personel.gorev || personel.departman) && (
                <p className="text-[13px] font-semibold mt-1" style={{ color: roleColor }}>
                  {personel.gorev}
                  {personel.gorev && personel.departman && (
                    <span style={{ color: metaColor }}> · </span>
                  )}
                  {personel.departman && (
                    <span style={{ color: metaColor }}>{personel.departman}</span>
                  )}
                </p>
              )}
              {firma?.ad && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <i className="ri-building-2-line text-[11px]" style={{ color: metaColor }} />
                  <p className="text-[12px] font-medium" style={{ color: metaColor }}>{firma.ad}</p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: dividerColor }} />

            {/* Contact chips */}
            <div className="grid grid-cols-1 gap-2">
              {personel.telefon && (
                <InfoChip
                  icon="ri-phone-line"
                  label="Telefon"
                  value={personel.telefon}
                  href={`tel:${personel.telefon}`}
                  isDark={isDark}
                />
              )}
              {personel.email && (
                <InfoChip
                  icon="ri-mail-line"
                  label="E-posta"
                  value={personel.email}
                  href={`mailto:${personel.email}`}
                  isDark={isDark}
                />
              )}
            </div>

            {/* Footer meta row */}
            {(personel.iseGirisTarihi || maskedTc) && (
              <div
                className="flex items-center gap-0 rounded-xl overflow-hidden"
                style={{ border: `1px solid ${dividerColor}` }}
              >
                {personel.iseGirisTarihi && (
                  <div
                    className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5"
                    style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)' }}
                  >
                    <div
                      className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)' }}
                    >
                      <i className="ri-calendar-check-line text-[10px]" style={{ color: '#10B981' }} />
                    </div>
                    <div>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: metaColor }}>İşe Giriş</p>
                      <p className="text-[11.5px] font-semibold mt-0.5" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>
                        {new Date(personel.iseGirisTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {personel.iseGirisTarihi && maskedTc && (
                  <div style={{ width: '1px', alignSelf: 'stretch', background: dividerColor }} />
                )}

                {maskedTc && (
                  <div
                    className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5"
                    style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)' }}
                  >
                    <div
                      className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)' }}
                    >
                      <i className="ri-shield-keyhole-line text-[10px]" style={{ color: isDark ? '#818CF8' : '#6366F1' }} />
                    </div>
                    <div>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: metaColor }}>TC Kimlik</p>
                      <p className="text-[11.5px] font-semibold mt-0.5 font-mono" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>
                        {maskedTc}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
