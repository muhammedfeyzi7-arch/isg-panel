import type { OrgAdmin } from '../hooks/useOrganizationAdmin';

interface Props {
  orgs: OrgAdmin[];
  onSelect: (org: OrgAdmin) => void;
  search: string;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpired(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function daysLeft(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

function orgInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function orgAvatarColor(name: string): string {
  const colors = [
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function StatusBadge({ org }: { org: OrgAdmin }) {
  const expired = isExpired(org.subscription_end);
  if (!org.is_active) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-xs font-medium">
        Pasif
      </span>
    );
  }
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-600 text-xs font-medium">
        Doldu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
      Aktif
    </span>
  );
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400 text-xs">—</span>;
  if (days < 0) return <span className="text-red-500 text-xs">{Math.abs(days)}g geçti</span>;
  if (days <= 7) return <span className="text-red-500 text-xs font-medium">{days}g kaldı</span>;
  if (days <= 30) return <span className="text-amber-600 text-xs font-medium">{days}g kaldı</span>;
  return <span className="text-slate-400 text-xs">{days}g kaldı</span>;
}

export default function OrgTable({ orgs, onSelect, search }: Props) {
  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.invite_code.toLowerCase().includes(search.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <i className="ri-building-2-line text-2xl mb-2 text-slate-300"></i>
        <p className="text-sm">Organizasyon bulunamadı.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop tablo */}
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-slate-400 font-medium text-xs px-5 py-3">Organizasyon</th>
              <th className="text-left text-slate-400 font-medium text-xs px-4 py-3">Durum</th>
              <th className="text-left text-slate-400 font-medium text-xs px-4 py-3">Üyeler</th>
              <th className="text-left text-slate-400 font-medium text-xs px-4 py-3">Oluşturulma</th>
              <th className="text-left text-slate-400 font-medium text-xs px-4 py-3">Bitiş</th>
              <th className="text-left text-slate-400 font-medium text-xs px-4 py-3">Kalan</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(org => {
              const days = daysLeft(org.subscription_end);
              const initials = orgInitials(org.name);
              const avatarCls = orgAvatarColor(org.name);

              return (
                <tr
                  key={org.id}
                  onClick={() => onSelect(org)}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors group cursor-pointer"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-xs font-semibold ${avatarCls}`}>
                        {initials}
                      </div>
                      <div>
                        <p className="text-slate-800 font-medium text-sm">{org.name}</p>
                        <p className="text-slate-400 text-xs font-mono">{org.invite_code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge org={org} />
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 text-sm">
                    {org.member_count || 0}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                    {formatDate(org.created_at)}
                  </td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                    <span className={isExpired(org.subscription_end) ? 'text-red-500' : 'text-slate-500'}>
                      {formatDate(org.subscription_end)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <DaysChip days={days} />
                  </td>
                  <td className="px-4 py-3.5">
                    <i className="ri-arrow-right-s-line text-slate-300 group-hover:text-slate-500 transition-colors text-base"></i>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile liste */}
      <div className="md:hidden divide-y divide-slate-100">
        {filtered.map(org => {
          const days = daysLeft(org.subscription_end);
          const initials = orgInitials(org.name);
          const avatarCls = orgAvatarColor(org.name);

          return (
            <div
              key={org.id}
              onClick={() => onSelect(org)}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 text-xs font-semibold ${avatarCls}`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-slate-800 font-medium text-sm truncate">{org.name}</p>
                  <StatusBadge org={org} />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono">{org.invite_code}</span>
                  <span>·</span>
                  <span>{org.member_count || 0} üye</span>
                  <span>·</span>
                  <DaysChip days={days} />
                </div>
              </div>
              <i className="ri-arrow-right-s-line text-slate-300 text-base flex-shrink-0"></i>
            </div>
          );
        })}
      </div>
    </>
  );
}
