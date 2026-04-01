/**
 * PersonelAvatar — Reusable avatar component
 * Shows a profile photo if available, otherwise an initials badge
 * with a deterministic gradient color based on the person's name.
 */

interface PersonelAvatarProps {
  adSoyad: string;
  fotoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  ring?: boolean;
}

const GRADIENTS = [
  'linear-gradient(135deg, #3B82F6, #6366F1)',
  'linear-gradient(135deg, #10B981, #059669)',
  'linear-gradient(135deg, #F59E0B, #D97706)',
  'linear-gradient(135deg, #EF4444, #DC2626)',
  'linear-gradient(135deg, #8B5CF6, #7C3AED)',
  'linear-gradient(135deg, #06B6D4, #0891B2)',
  'linear-gradient(135deg, #EC4899, #DB2777)',
  'linear-gradient(135deg, #14B8A6, #0D9488)',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

const SIZE_MAP: Record<NonNullable<PersonelAvatarProps['size']>, { box: string; text: string; ring: string }> = {
  xs:  { box: 'w-6 h-6',   text: 'text-[9px]',  ring: 'ring-1' },
  sm:  { box: 'w-8 h-8',   text: 'text-[11px]', ring: 'ring-1' },
  md:  { box: 'w-10 h-10', text: 'text-sm',     ring: 'ring-2' },
  lg:  { box: 'w-14 h-14', text: 'text-lg',     ring: 'ring-2' },
  xl:  { box: 'w-20 h-20', text: 'text-2xl',    ring: 'ring-[3px]' },
  '2xl': { box: 'w-28 h-28', text: 'text-3xl',  ring: 'ring-4' },
};

export default function PersonelAvatar({
  adSoyad,
  fotoUrl,
  size = 'md',
  className = '',
  ring = false,
}: PersonelAvatarProps) {
  const s = SIZE_MAP[size];
  const gradient = getGradient(adSoyad);
  const initials = getInitials(adSoyad);
  const ringClass = ring ? `${s.ring} ring-offset-2 ring-white/20` : '';

  if (fotoUrl) {
    return (
      <div
        className={`${s.box} rounded-full flex-shrink-0 overflow-hidden ${ringClass} ${className}`}
        style={{ background: gradient }}
      >
        <img
          src={fotoUrl}
          alt={adSoyad}
          className="w-full h-full object-cover object-top"
          onError={(e) => {
            // On image error, hide the img and show initials fallback
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`${s.box} rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white select-none ${ringClass} ${className}`}
      style={{ background: gradient }}
    >
      <span className={s.text}>{initials}</span>
    </div>
  );
}

export { getGradient, getInitials };
