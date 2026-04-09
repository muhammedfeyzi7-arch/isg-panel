import type { OrgAdmin } from '../hooks/useOrganizationAdmin';

interface Props {
  orgs: OrgAdmin[];
  onSelect: (org: OrgAdmin) => void;
  search: string;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function isExpired(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function daysLeft(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function orgInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function orgColorClass(name: string) {
  const palettes = [
    { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
    { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
    { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
    { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

function DaysLeftBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400 text-xs">—</span>;
  if (days < 0) return <span className="text-red-500 text-xs font-bold">{Math.abs(days)}g geçti</span>;
  if (days <= 7) return <span className="text-red-500 text-xs font-bold">{days}g</span>;
  if (days <= 30) return <span className="text-amber-600 text-xs font-semibold">{days}g</span>;
  return <span className="text-slate-500 text-xs font-medium">{days}g</span>;
}

export default function OrgTable({ orgs, onSelect, search }: Props) {
  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.invite_code.toLowerCase().includes(search.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 mb-3">
          <i className="ri-building-2-line text-xl text-slate-400"></i>
        </div>
        <p className="text-sm font-medium">Organizasyon bulunamadı.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop tablo - md ve üzeri */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider px-5 py-3 whitespace-nowrap">Organizasyon</th>
              <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Durum</th>
              <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Üyeler</th>
              <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Oluşturulma</th>
              <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Abonelik Bitiş</th>
              <th className="text-left text-slate-500 font-semibold text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Kalan</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(org => {
              const expired = isExpired(org.subscription_end);
              const days = daysLeft(org.subscription_end);
              const initials = orgInitials(org.name);
              const palette = orgColorClass(org.name);

              return (
                <tr
                  key={org.id}
                  onClick={() => onSelect(org)}
                  className="hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-xl border flex-shrink-0 text-xs font-black ${palette.bg} ${palette.text} ${palette.border}`}>
                        {initials}
                      </div>
                      <div>
                        <p className="text-slate-900 font-semibold text-sm">{org.name}</p>
                        <p className="text-slate-400 text-xs font-mono mt-0.5">{org.invite_code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      !org.is_active
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : expired
                        ? 'bg-orange-50 text-orange-600 border border-orange-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        !org.is_active ? 'bg-red-500' : expired ? 'bg-orange-500' : 'bg-emerald-500 animate-pulse'
                      }`}></span>
                      {!org.is_active ? 'Pasif' : expired ? 'Süresi Doldu' : 'Aktif'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-slate-600 text-sm font-medium">
                      <i className="ri-user-line text-slate-400 text-xs"></i>
                      {org.member_count || 0}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap font-medium">
                    {formatDate(org.created_at)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-xs font-medium">
                    <span className={expired ? 'text-red-500' : 'text-slate-600'}>
                      {formatDate(org.subscription_end)}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <DaysLeftBadge days={days} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500">
                      <i className="ri-arrow-right-s-line text-base"></i>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile kart listesi - md altı */}
      <div className="md:hidden divide-y divide-slate-100">
        {filtered.map(org => {
          const expired = isExpired(org.subscription_end);
          const days = daysLeft(org.subscription_end);
          const initials = orgInitials(org.name);
          const palette = orgColorClass(org.name);

          return (
            <div
              key={org.id}
              onClick={() => onSelect(org)}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
            >
              {/* Avatar */}
              <div className={`w-10 h-10 flex items-center justify-center rounded-xl border flex-shrink-0 text-xs font-black ${palette.bg} ${palette.text} ${palette.border}`}>
                {initials}
              </div>

              {/* İçerik */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-900 font-semibold text-sm truncate">{org.name}</p>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    !org.is_active
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : expired
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      !org.is_active ? 'bg-red-500' : expired ? 'bg-orange-500' : 'bg-emerald-500 animate-pulse'
                    }`}></span>
                    {!org.is_active ? 'Pasif' : expired ? 'Doldu' : 'Aktif'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-slate-400 text-xs font-mono">{org.invite_code}</p>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400 text-xs flex items-center gap-1">
                    <i className="ri-user-line text-xs"></i>{org.member_count || 0} üye
                  </span>
                  <span className="text-slate-300">·</span>
                  <DaysLeftBadge days={days} />
                </div>
              </div>

              {/* Ok */}
              <div className="w-5 h-5 flex items-center justify-center text-slate-300 flex-shrink-0">
                <i className="ri-arrow-right-s-line text-base"></i>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
