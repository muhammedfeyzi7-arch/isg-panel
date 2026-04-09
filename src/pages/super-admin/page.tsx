import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useOrganizationAdmin, type OrgAdmin } from './hooks/useOrganizationAdmin';
import OrgTable from './components/OrgTable';
import OrgDetailSheet from './components/OrgDetailSheet';
import OrgCreateSheet from './components/OrgCreateSheet';

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrgAdmin | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'passive' | 'expired'>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { orgs, loading, error, fetchOrgs, updateSubscription, deleteOrg } = useOrganizationAdmin();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/super-admin/login', { replace: true }); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!profile?.is_super_admin) { navigate('/super-admin/login', { replace: true }); return; }
      setIsSuperAdmin(true);
      setAuthChecked(true);
    })();
  }, [navigate]);

  useEffect(() => {
    if (authChecked) fetchOrgs();
  }, [authChecked, fetchOrgs]);

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    navigate('/super-admin/login', { replace: true });
  };

  const filteredOrgs = orgs.filter(org => {
    if (filter === 'active') return org.is_active && (org.subscription_end ? new Date(org.subscription_end) >= new Date() : true);
    if (filter === 'passive') return !org.is_active;
    if (filter === 'expired') return org.is_active && org.subscription_end && new Date(org.subscription_end) < new Date();
    return true;
  });

  const stats = {
    total: orgs.length,
    active: orgs.filter(o => o.is_active && (o.subscription_end ? new Date(o.subscription_end) >= new Date() : true)).length,
    passive: orgs.filter(o => !o.is_active).length,
    expired: orgs.filter(o => o.is_active && o.subscription_end && new Date(o.subscription_end) < new Date()).length,
    expiringSoon: orgs.filter(o => {
      if (!o.is_active || !o.subscription_end) return false;
      const days = Math.ceil((new Date(o.subscription_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 14;
    }).length,
    totalMembers: orgs.reduce((acc, o) => acc + (o.member_count || 0), 0),
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm">Yetki kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0f]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20">
              <i className="ri-shield-keyhole-fill text-amber-400 text-xs"></i>
            </div>
            <span className="text-white font-semibold text-sm tracking-tight">Admin Panel</span>
            <span className="hidden sm:block text-white/20 text-xs">·</span>
            <span className="hidden sm:block text-slate-600 text-xs">isgdenetim.com.tr</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm"></i>
              Yeni Org.
            </button>
            <button
              onClick={fetchOrgs}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-slate-400 transition-all cursor-pointer"
            >
              <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-slate-400 transition-all cursor-pointer"
            >
              <i className="ri-logout-box-line text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Başlık */}
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Organizasyonlar</h1>
          <p className="text-slate-600 text-sm mt-0.5">Tüm müşteri organizasyonlarını yönetin</p>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: 'ri-building-2-line', label: 'Toplam', value: stats.total, key: 'all', color: 'amber' },
            { icon: 'ri-checkbox-circle-line', label: 'Aktif', value: stats.active, key: 'active', color: 'emerald' },
            { icon: 'ri-pause-circle-line', label: 'Pasif', value: stats.passive, key: 'passive', color: 'red' },
            { icon: 'ri-timer-flash-line', label: 'Süresi Doldu', value: stats.expired, key: 'expired', color: 'orange' },
            { icon: 'ri-alarm-warning-line', label: '14 Günde Doluyor', value: stats.expiringSoon, key: null, color: 'yellow' },
            { icon: 'ri-team-line', label: 'Toplam Üye', value: stats.totalMembers, key: null, color: 'slate' },
          ].map((s, i) => {
            const isActive = s.key && filter === s.key;
            const colorMap: Record<string, string> = {
              amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              red: 'text-red-400 bg-red-500/10 border-red-500/20',
              orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
              yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
              slate: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
            };
            return (
              <button
                key={i}
                onClick={() => s.key && setFilter(s.key as typeof filter)}
                className={`relative p-4 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'bg-white/8 border-white/15 ring-1 ring-white/10'
                    : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/10'
                } ${s.key ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-7 h-7 flex items-center justify-center rounded-lg border mb-3 ${colorMap[s.color]}`}>
                  <i className={`${s.icon} text-xs`}></i>
                </div>
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-slate-600 text-xs mt-0.5 leading-tight">{s.label}</p>
              </button>
            );
          })}
        </div>

        {/* Tablo */}
        <div className="bg-white/3 border border-white/6 rounded-2xl overflow-hidden">
          {/* Tablo Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <p className="text-white text-sm font-semibold">
                {filter === 'all' ? 'Tümü' : filter === 'active' ? 'Aktif' : filter === 'passive' ? 'Pasif' : 'Süresi Doldu'}
              </p>
              <span className="px-2 py-0.5 bg-white/8 text-slate-400 text-xs rounded-full">
                {filteredOrgs.length}
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-600">
                <i className="ri-search-line text-sm"></i>
              </div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ara..."
                className="bg-white/5 border border-white/8 text-white placeholder-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/10 transition-all w-52"
              />
            </div>
          </div>

          {loading && !orgs.length ? (
            <div className="flex items-center justify-center py-20 text-slate-600">
              <i className="ri-loader-4-line animate-spin text-xl mr-3"></i>
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-400 gap-3">
              <i className="ri-error-warning-line text-3xl"></i>
              <p className="text-sm">{error}</p>
              <button onClick={fetchOrgs} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm rounded-lg cursor-pointer">
                Tekrar Dene
              </button>
            </div>
          ) : (
            <OrgTable orgs={filteredOrgs} onSelect={org => setSelectedOrg(org)} search={search} />
          )}
        </div>
      </main>

      <OrgCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => { fetchOrgs(); }} />
      <OrgDetailSheet
        org={selectedOrg}
        onClose={() => setSelectedOrg(null)}
        onUpdate={async (id, fields) => {
          await updateSubscription(id, fields);
          setSelectedOrg(prev => prev ? { ...prev, ...fields } : null);
        }}
        onDelete={deleteOrg}
      />
    </div>
  );
}
