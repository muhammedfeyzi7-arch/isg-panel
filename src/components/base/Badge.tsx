interface BadgeProps {
  label: string;
  color?: 'green' | 'red' | 'amber' | 'sky' | 'gray' | 'purple' | 'orange' | 'teal' | 'pink' | 'blue';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const colorMap: Record<string, { base: string; dot: string }> = {
  green:  { base: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 dark:text-emerald-400',   dot: 'bg-emerald-500' },
  red:    { base: 'bg-red-500/10 text-red-500 border-red-500/20 dark:text-red-400',                   dot: 'bg-red-500' },
  amber:  { base: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',           dot: 'bg-amber-500' },
  sky:    { base: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',                   dot: 'bg-sky-500' },
  blue:   { base: 'bg-blue-600/10 text-blue-500 border-blue-600/20 dark:text-blue-400',               dot: 'bg-blue-500' },
  gray:   { base: 'bg-slate-500/10 text-slate-500 border-slate-500/20 dark:text-slate-400',           dot: 'bg-slate-400' },
  purple: { base: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400',       dot: 'bg-violet-500' },
  orange: { base: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',       dot: 'bg-orange-500' },
  teal:   { base: 'bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-400',               dot: 'bg-teal-500' },
  pink:   { base: 'bg-pink-500/10 text-pink-600 border-pink-500/20 dark:text-pink-400',               dot: 'bg-pink-500' },
};

export function getFirmaStatusColor(s: string): BadgeProps['color'] {
  if (s === 'Aktif') return 'sky';
  if (s === 'Pasif') return 'gray';
  return 'sky';
}

export function getTehlikeColor(s: string): BadgeProps['color'] {
  if (s === 'Az Tehlikeli') return 'sky';
  if (s === 'Tehlikeli') return 'blue';
  return 'red';
}

export function getEvrakStatusColor(s: string): BadgeProps['color'] {
  if (s === 'Yüklü') return 'green';
  if (s === 'Eksik') return 'red';
  if (s === 'Süre Yaklaşıyor') return 'amber';
  return 'orange';
}

export function getPersonelStatusColor(s: string): BadgeProps['color'] {
  if (s === 'Aktif') return 'green';
  if (s === 'Ayrıldı') return 'red';
  // Eski 'Pasif' kayıtlar için fallback — 'Ayrıldı' gibi göster
  return 'red';
}

export function getUygunsuzlukSeverityColor(s: string): BadgeProps['color'] {
  if (s === 'Düşük') return 'sky';
  if (s === 'Orta') return 'amber';
  if (s === 'Yüksek') return 'orange';
  return 'red';
}

export function getEgitimStatusColor(s: string): BadgeProps['color'] {
  if (s === 'Tamamlandı') return 'green';
  if (s === 'Planlandı') return 'sky';
  return 'gray';
}

export default function Badge({ label, color = 'gray', size = 'md', dot = false }: BadgeProps) {
  const c = colorMap[color] ?? colorMap.gray;
  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-[3px] text-[11px] gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border whitespace-nowrap tracking-wide transition-all duration-150 ${sizeClass} ${c.base}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      )}
      {label}
    </span>
  );
}

/** Durum badge'i — Uygun/Uygun Değil/Bekliyor için tutarlı renk */
export function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? '';
  if (s === 'uygun' || s === 'aktif' || s === 'tamamlandı' || s === 'onaylandı') {
    return <Badge label={status} color="green" dot />;
  }
  if (s === 'uygun değil' || s === 'ayrıldı' || s === 'reddedildi' || s === 'süre dolmuş' || s === 'eksik') {
    return <Badge label={status} color="red" dot />;
  }
  if (s === 'bekliyor' || s === 'planlandı' || s === 'süre yaklaşıyor' || s === 'bakımda') {
    return <Badge label={status} color="amber" dot />;
  }
  if (s === 'hurda' || s === 'pasif') {
    return <Badge label={status} color="gray" dot />;
  }
  return <Badge label={status} color="gray" />;
}
