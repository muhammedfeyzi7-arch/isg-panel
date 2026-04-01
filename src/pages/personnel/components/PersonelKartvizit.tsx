/**
 * PersonelKartvizit — Premium business card modal
 * Opens on clicking a personnel row. Shows a rich profile card.
 */
import { useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import PersonelAvatar from '@/components/base/PersonelAvatar';

interface Props {
  personelId: string | null;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  'Aktif':   { label: 'Aktif',   color: '#34D399', bg: 'rgba(52,211,153,0.15)',  dot: '#34D399' },
  'Pasif':   { label: 'Pasif',   color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', dot: '#94A3B8' },
  'Ayrıldı': { label: 'Ayrıldı', color: '#F87171', bg: 'rgba(248,113,113,0.15)', dot: '#F87171' },
};

function ContactRow({ icon, value, href }: { icon: string; value?: string; href?: string }) {
  if (!value) return null;
  const content = (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 group transition-all duration-200"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div
        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        <i className={`${icon} text-sm`} style={{ color: '#818CF8' }} />
      </div>
      <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors truncate">{value}</span>
      {href && <i className="ri-external-link-line text-xs ml-auto flex-shrink-0" style={{ color: '#475569' }} />}
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
        {content}
      </a>
    );
  }
  return content;
}

export default function PersonelKartvizit({ personelId, onClose }: Props) {
  const { personeller, firmalar, getPersonelFoto } = useApp();
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const personel = personelId ? personeller.find(p => p.id === personelId) ?? null : null;
  const firma = personel ? firmalar.find(f => f.id === personel.firmaId) : null;
  const fotoUrl = personelId ? getPersonelFoto(personelId) : undefined;

  // Animate in
  useEffect(() => {
    if (!personelId) return;
    requestAnimationFrame(() => {
      if (overlayRef.current) {
        overlayRef.current.style.opacity = '1';
      }
      if (cardRef.current) {
        cardRef.current.style.transform = 'translateY(0) scale(1)';
        cardRef.current.style.opacity = '1';
      }
    });
  }, [personelId]);

  const handleClose = () => {
    if (overlayRef.current) overlayRef.current.style.opacity = '0';
    if (cardRef.current) {
      cardRef.current.style.transform = 'translateY(24px) scale(0.96)';
      cardRef.current.style.opacity = '0';
    }
    setTimeout(onClose, 200);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  if (!personelId || !personel) return null;

  const statusCfg = STATUS_CONFIG[personel.durum] ?? STATUS_CONFIG['Pasif'];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(12px)',
        opacity: 0,
        transition: 'opacity 0.2s ease',
      }}
      onClick={handleOverlayClick}
    >
      <div
        ref={cardRef}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          transform: 'translateY(24px) scale(0.96)',
          opacity: 0,
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
          background: 'var(--bg-card)',
        }}
      >
        {/* ── Close button ── */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
          style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.7)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        >
          <i className="ri-close-line text-sm" />
        </button>

        {/* ── Avatar section (clean, no gradient) ── */}
        <div className="flex flex-col items-center pt-10 pb-2">
          <div
            className="rounded-full p-1"
            style={{
              background: 'var(--bg-card)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <PersonelAvatar
              adSoyad={personel.adSoyad}
              fotoUrl={fotoUrl}
              size="xl"
              ring
            />
          </div>
        </div>

        {/* ── Card body ── */}
        <div className="px-6 pb-6 pt-3 space-y-4">
          {/* Name & title */}
          <div className="text-center">
            <h2
              className="text-xl font-bold leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {personel.adSoyad}
            </h2>
            {personel.gorev && (
              <p className="text-sm mt-0.5 font-medium" style={{ color: '#818CF8' }}>
                {personel.gorev}
                {personel.departman ? ` · ${personel.departman}` : ''}
              </p>
            )}
            {/* Status badge */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}30` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: statusCfg.dot, boxShadow: personel.durum === 'Aktif' ? `0 0 6px ${statusCfg.dot}` : 'none' }}
                />
                {statusCfg.label}
              </span>
              {personel.kanGrubu && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  {personel.kanGrubu}
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Contact info */}
          <div className="space-y-2">
            {firma?.ad && (
              <ContactRow icon="ri-building-2-line" value={firma.ad} />
            )}
            {personel.telefon && (
              <ContactRow
                icon="ri-phone-line"
                value={personel.telefon}
                href={`tel:${personel.telefon}`}
              />
            )}
            {personel.email && (
              <ContactRow
                icon="ri-mail-line"
                value={personel.email}
                href={`mailto:${personel.email}`}
              />
            )}
          </div>

          {/* Footer info */}
          {(personel.iseGirisTarihi || personel.tc) && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-2.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {personel.iseGirisTarihi && (
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                    İşe Giriş
                  </p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: '#94A3B8' }}>
                    {new Date(personel.iseGirisTarihi).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              )}
              {personel.iseGirisTarihi && personel.tc && (
                <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.08)' }} />
              )}
              {personel.tc && (
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                    TC Kimlik
                  </p>
                  <p className="text-xs font-medium mt-0.5 font-mono" style={{ color: '#94A3B8' }}>
                    {personel.tc.replace(/(.{3})(.{4})(.{4})/, '$1 $2 $3')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
