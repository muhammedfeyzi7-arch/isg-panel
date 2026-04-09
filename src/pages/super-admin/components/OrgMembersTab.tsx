import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Member {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  joined_at: string;
}

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin:      { label: 'Admin',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  denetci:    { label: 'Saha Pers.',  cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  member:     { label: 'Üye',         cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  firma_user: { label: 'Firma Yet.',  cls: 'bg-violet-50 text-violet-700 border-violet-200' },
};

export default function OrgMembersTab({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      const { data, error: err } = await supabase
        .from('user_organizations')
        .select('user_id, display_name, email, role, is_active, joined_at')
        .eq('organization_id', orgId)
        .order('joined_at', { ascending: true });

      if (err) { setError(err.message); }
      else { setMembers(data || []); }
      setLoading(false);
    })();
  }, [orgId]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <i className="ri-loader-4-line animate-spin text-xl mr-2"></i>
      <span className="text-sm font-medium">Yükleniyor...</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-12 text-red-500 text-sm font-medium">
      <i className="ri-error-warning-line mr-2"></i>{error}
    </div>
  );

  if (members.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 mb-3">
        <i className="ri-team-line text-xl text-slate-400"></i>
      </div>
      <p className="text-sm font-medium">Henüz üye yok.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {members.map(m => {
        const roleCfg = ROLE_LABELS[m.role] ?? { label: m.role, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
        const initials = (m.display_name || m.email || '?').charAt(0).toUpperCase();
        return (
          <div key={m.user_id} className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            {/* Avatar */}
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 text-sm font-black flex-shrink-0">
              {initials}
            </div>
            {/* Bilgi */}
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm font-semibold truncate">{m.display_name || '—'}</p>
              <p className="text-slate-400 text-xs truncate">{m.email || '—'}</p>
            </div>
            {/* Rol */}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${roleCfg.cls}`}>
              {roleCfg.label}
            </span>
            {/* Durum */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.is_active ? 'bg-emerald-500' : 'bg-red-400'}`}></div>
          </div>
        );
      })}
      <p className="text-slate-400 text-xs text-center pt-1 font-medium">{members.length} üye</p>
    </div>
  );
}
