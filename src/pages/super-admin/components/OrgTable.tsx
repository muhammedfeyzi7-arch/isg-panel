import { useState } from 'react';
import type { OrgAdmin } from '../hooks/useOrganizationAdmin';

interface Props {
  orgs: OrgAdmin[];
  onSelect: (org: OrgAdmin) => void;
  onToggleActive: (org: OrgAdmin) => Promise<void>;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysLeft(d: string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function orgInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function orgAvatarColor(name: string): string {
  const colors = [
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700',
    'bg-orange-100 text-orange-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

type OrgStatus = 'active' | 'expiring' | 'expired' | 'passive';

function getStatus(org: OrgAdmin): OrgStatus {
  if (!org.is_active) return 'passive';
  if (org.subscription_end && new Date(org.subscription_end) < new Date()) return 'expired';
  const days = daysLeft(org.subscription_end);
  if (days !== null && days <= 14) return 'expiring';
  return 'active';
}

function StatusBadge({ org }: { org: OrgAdmin }) {
  const s = getStatus(org);
  const map: Record<OrgStatus, { label: string; cls: string; dot?: string }> = {
    active:   { label: 'Aktif', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
    expiring: { label: 'Yaklaşıyor', cls: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
    expired:  { label: 'Doldu', cls: 'bg-red-50 text-red-600 border border-red-200', dot: 'bg-red-500' },
    passive:  { label: 'Pasif', cls: 'bg-slate-100 text-slate-500 border border-slate-200', dot: 'bg-slate-400' },
  };
  const cfg = map[s];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  );
}

function DaysCell({ org }: { org: OrgAdmin }) {
  const days = daysLeft(org.subscription_end);
  if (!org.is_active) return <span className="text-slate-400 text-xs">—</span>;
  if (days === null) return <span className="text-slate-400 text-xs">Sınırsız</span>;
  if (days < 0) return <span className="text-red-500 text-xs font-medium">{Math.abs(days)}g geçti</span>;
  if (days === 0) return <span className="text-red-500 text-xs font-semibold">Bugün!</span>;
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
      <i className="ri-alarm-warning-line text-xs"></i>{days} gün
    </span>
  );
  if (days <= 14) return <span className="text-amber-600 text-xs font-medium">{days} gün</span>;
  return <span className="text-slate-500 text-xs">{days} gün</span>;
}

function ActionButtons({ org, onSelect, onToggleActive }: {
  org: OrgAdmin;
  onSelect: (o: OrgAdmin) => void;
  onToggleActive: (o: OrgAdmin) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try { await onToggleActive(org); } finally { setToggling(false); }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Detaya Git */}
      <Tooltip label="Detaya Git">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(org); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
        >
          <i className="ri-eye-line text-sm"></i>
        </button>
      </Tooltip>

      {/* Aktif/Pasif toggle */}
      <Tooltip label={org.is_active ? 'Pasife Al' : 'Aktif Et'}>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
            org.is_active
              ? 'hover:bg-red-50 text-slate-400 hover:text-red-500'
              : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
          }`}
        >
          {toggling
            ? <i className="ri-loader-4-line animate-spin text-sm"></i>
            : <i className={`text-sm ${org.is_active ? 'ri-pause-circle-line' : 'ri-play-circle-line'}`}></i>
          }
        </button>
      </Tooltip>

      {/* Süre Uzat (opens detail) */}
      <Tooltip label="Süre Uzat">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(org); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 cursor-pointer transition-colors"
        >
          <i className="ri-calendar-line text-sm"></i>
        </button>
      </Tooltip>
    </div>
  );
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity z-10">
        {label}
      </div>
    </div>
  );
}

// Mobile card for each org row
function MobileOrgCard({ org, onSelect, onToggleActive }: {
  org: OrgAdmin;
  onSelect: (o: OrgAdmin) => void;
  onToggleActive: (o: OrgAdmin) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const initials = orgInitials(org.name);
  const avatarCls = orgAvatarColor(org.name);
  const days = daysLeft(org.subscription_end);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try { await onToggleActive(org); } finally { setToggling(false); }
  };

  return (
    <div className="flex items-start gap-3 p-4 border-b border-slate-100 last:border-0">
      <button
        onClick={() => onSelect(org)}
        className="flex items-start gap-3 flex-1 min-w-0 text-left"
      >
        <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 text-xs font-bold ${avatarCls}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-slate-800 font-semibold text-sm truncate">{org.name}</span>
            {org.org_type === 'osgb' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700">
                <i className="ri-hospital-line text-xs"></i>OSGB
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                <i className="ri-building-2-line text-xs"></i>Firma
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge org={org} />
            <span className="text-slate-400 text-xs">{org.member_count || 0} üye</span>
            {days !== null && (
              <span className="text-slate-400 text-xs">{formatDate(org.subscription_end)}</span>
            )}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
            org.is_active ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {toggling
            ? <i className="ri-loader-4-line animate-spin text-xs"></i>
            : <i className={`text-xs ${org.is_active ? 'ri-pause-circle-line' : 'ri-play-circle-line'}`}></i>
          }
        </button>
        <button
          onClick={() => onSelect(org)}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 cursor-pointer transition-colors hover:bg-slate-200"
        >
          <i className="ri-arrow-right-s-line text-sm"></i>
        </button>
      </div>
    </div>
  );
}

export default function OrgTableView({ orgs, onSelect, onToggleActive }: Props) {
  return (
    <>
      {/* Desktop tablo */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left text-slate-400 font-semibold text-xs px-5 py-3 whitespace-nowrap">Üye Adı</th>
              <th className="text-left text-slate-400 font-semibold text-xs px-4 py-3 whitespace-nowrap">Tür</th>
              <th className="text-left text-slate-400 font-semibold text-xs px-4 py-3 whitespace-nowrap">Üyeler</th>
              <th className="text-left text-slate-400 font-semibold text-xs px-4 py-3 whitespace-nowrap">Abonelik Bitiş</th>
              <th className="text-left text-slate-400 font-semibold text-xs px-4 py-3 whitespace-nowrap">Kalan Gün</th>
              <th className="text-left text-slate-400 font-semibold text-xs px-4 py-3 whitespace-nowrap">Durum</th>
              <th className="text-right text-slate-400 font-semibold text-xs px-4 py-3 whitespace-nowrap">Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => {
              const initials = orgInitials(org.name);
              const avatarCls = orgAvatarColor(org.name);
              const status = getStatus(org);

              return (
                <tr
                  key={org.id}
                  onClick={() => onSelect(org)}
                  className={`border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group cursor-pointer ${
                    status === 'expiring' ? 'bg-amber-50/30' : status === 'expired' ? 'bg-red-50/20' : ''
                  }`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-xs font-bold ${avatarCls}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-800 font-semibold text-sm leading-tight">{org.name}</p>
                        <p className="text-slate-400 text-xs font-mono mt-0.5">{org.invite_code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {org.org_type === 'osgb' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100 whitespace-nowrap">
                        <i className="ri-hospital-line text-xs"></i>OSGB
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                        <i className="ri-building-2-line text-xs"></i>Firma
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-600 text-sm">{org.member_count || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(org.subscription_end)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DaysCell org={org} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge org={org} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButtons org={org} onSelect={onSelect} onToggleActive={onToggleActive} />
                      <i className="ri-arrow-right-s-line text-slate-300 group-hover:text-slate-500 text-base transition-colors opacity-0 group-hover:opacity-100"></i>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile kartlar */}
      <div className="md:hidden">
        {orgs.map(org => (
          <MobileOrgCard
            key={org.id}
            org={org}
            onSelect={onSelect}
            onToggleActive={onToggleActive}
          />
        ))}
      </div>
    </>
  );
}
