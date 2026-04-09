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

export default function OrgTable({ orgs, onSelect, search }: Props) {
  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.invite_code.toLowerCase().includes(search.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="w-14 h-14 flex items-center justify-center rounded-full bg-slate-800 mb-3">
          <i className="ri-building-2-line text-2xl"></i>
        </div>
        <p className="text-sm">Organizasyon bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">Organizasyon</th>
            <th className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">Durum</th>
            <th className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">Üyeler</th>
            <th className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">Oluşturulma</th>
            <th className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">Abonelik Bitiş</th>
            <th className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">Kalan</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {filtered.map(org => {
            const expired = isExpired(org.subscription_end);
            const days = daysLeft(org.subscription_end);

            return (
              <tr
                key={org.id}
                className="hover:bg-slate-800/40 transition-colors group"
              >
                {/* Ad */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                      <i className="ri-building-2-line text-amber-400 text-sm"></i>
                    </div>
                    <div>
                      <p className="text-white font-medium">{org.name}</p>
                      <p className="text-slate-500 text-xs font-mono">{org.invite_code}</p>
                    </div>
                  </div>
                </td>

                {/* Durum */}
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    !org.is_active
                      ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                      : expired
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      !org.is_active ? 'bg-red-400' : expired ? 'bg-orange-400' : 'bg-emerald-400'
                    }`}></span>
                    {!org.is_active ? 'Pasif' : expired ? 'Süresi Doldu' : 'Aktif'}
                  </span>
                </td>

                {/* Üye */}
                <td className="px-4 py-3.5 text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <i className="ri-user-line text-slate-500 text-xs"></i>
                    {org.member_count || 0}
                  </div>
                </td>

                {/* Oluşturulma */}
                <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">
                  {formatDate(org.created_at)}
                </td>

                {/* Bitiş */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span className={expired ? 'text-red-400' : 'text-slate-300'}>
                    {formatDate(org.subscription_end)}
                  </span>
                </td>

                {/* Kalan */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  {days === null ? (
                    <span className="text-slate-500">—</span>
                  ) : days < 0 ? (
                    <span className="text-red-400 text-xs font-medium">{Math.abs(days)} gün geçti</span>
                  ) : days <= 7 ? (
                    <span className="text-red-400 text-xs font-medium">{days} gün</span>
                  ) : days <= 30 ? (
                    <span className="text-yellow-400 text-xs font-medium">{days} gün</span>
                  ) : (
                    <span className="text-slate-400 text-xs">{days} gün</span>
                  )}
                </td>

                {/* Aksiyon */}
                <td className="px-4 py-3.5">
                  <button
                    onClick={() => onSelect(org)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-settings-3-line"></i>
                    Yönet
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
