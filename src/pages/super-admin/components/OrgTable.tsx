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

// Org adından renk üret
function orgColor(name: string) {
  const colors = [
    'from-violet-500/20 to-purple-500/10 border-violet-500/20 text-violet-300',
    'from-amber-500/20 to-yellow-500/10 border-amber-500/20 text-amber-300',
    'from-emerald-500/20 to-teal-500/10 border-emerald-500/20 text-emerald-300',
    'from-rose-500/20 to-pink-500/10 border-rose-500/20 text-rose-300',
    'from-sky-500/20 to-cyan-500/10 border-sky-500/20 text-sky-300',
    'from-orange-500/20 to-red-500/10 border-orange-500/20 text-orange-300',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function OrgTable({ orgs, onSelect, search }: Props) {
  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.invite_code.toLowerCase().includes(search.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600">
        <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 mb-3">
          <i className="ri-building-2-line text-xl"></i>
        </div>
        <p className="text-sm">Organizasyon bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left text-slate-600 font-medium text-xs uppercase tracking-wider px-5 py-3 whitespace-nowrap">Organizasyon</th>
            <th className="text-left text-slate-600 font-medium text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Durum</th>
            <th className="text-left text-slate-600 font-medium text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Üyeler</th>
            <th className="text-left text-slate-600 font-medium text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Oluşturulma</th>
            <th className="text-left text-slate-600 font-medium text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Abonelik Bitiş</th>
            <th className="text-left text-slate-600 font-medium text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">Kalan</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {filtered.map(org => {
            const expired = isExpired(org.subscription_end);
            const days = daysLeft(org.subscription_end);
            const initials = org.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const colorCls = orgColor(org.name);

            return (
              <tr
                key={org.id}
                onClick={() => onSelect(org)}
                className="hover:bg-white/3 transition-colors group cursor-pointer"
              >
                {/* Ad */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br border flex-shrink-0 text-xs font-bold ${colorCls}`}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{org.name}</p>
                      <p className="text-slate-600 text-xs font-mono mt-0.5">{org.invite_code}</p>
                    </div>
                  </div>
                </td>

                {/* Durum */}
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    !org.is_active
                      ? 'bg-red-500/10 text-red-400 border border-red-500/15'
                      : expired
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/15'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      !org.is_active ? 'bg-red-400' : expired ? 'bg-orange-400' : 'bg-emerald-400 animate-pulse'
                    }`}></span>
                    {!org.is_active ? 'Pasif' : expired ? 'Süresi Doldu' : 'Aktif'}
                  </span>
                </td>

                {/* Üye */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                    <i className="ri-user-line text-slate-600 text-xs"></i>
                    {org.member_count || 0}
                  </div>
                </td>

                {/* Oluşturulma */}
                <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap">
                  {formatDate(org.created_at)}
                </td>

                {/* Bitiş */}
                <td className="px-4 py-4 whitespace-nowrap text-xs">
                  <span className={expired ? 'text-red-400' : 'text-slate-400'}>
                    {formatDate(org.subscription_end)}
                  </span>
                </td>

                {/* Kalan */}
                <td className="px-4 py-4 whitespace-nowrap">
                  {days === null ? (
                    <span className="text-slate-600 text-xs">—</span>
                  ) : days < 0 ? (
                    <span className="text-red-400 text-xs font-medium">{Math.abs(days)}g geçti</span>
                  ) : days <= 7 ? (
                    <span className="text-red-400 text-xs font-semibold">{days}g</span>
                  ) : days <= 30 ? (
                    <span className="text-yellow-400 text-xs font-medium">{days}g</span>
                  ) : (
                    <span className="text-slate-500 text-xs">{days}g</span>
                  )}
                </td>

                {/* Aksiyon */}
                <td className="px-4 py-4">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 text-slate-400 hover:text-white">
                    <i className="ri-arrow-right-s-line text-base"></i>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
