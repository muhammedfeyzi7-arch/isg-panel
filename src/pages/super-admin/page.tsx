import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useOrganizationAdmin, type OrgAdmin } from './hooks/useOrganizationAdmin';
import OrgTable from './components/OrgTable';
import OrgDetailSheet from './components/OrgDetailSheet';
import OrgCreateSheet from './components/OrgCreateSheet';
import SupportTicketsPanel from './components/SupportTicketsPanel';

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrgAdmin | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'passive' | 'expired'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'orgs' | 'support'>('orgs');

  const { orgs, loading, error, fetchOrgs, updateSubscription, deleteOrg } = useOrganizationAdmin();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/super-admin/login', { replace: true }); return; }
      const { data: profile } = await supabase
        .from('profiles').select('is_super_admin').eq('user_id', session.user.id).maybeSingle();
      if (!profile?.is_super_admin) { navigate('/super-admin/login', { replace: true }); return; }
      setIsSuperAdmin(true);
      setAuthChecked(true);
    })();
  }, [navigate]);

  useEffect(() => { if (authChecked) fetchOrgs(); }, [authChecked, fetchOrgs]);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm font-medium">Yetki kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-400/25">
              <i className="ri-shield-keyhole-fill text-white text-sm"></i>
            </div>
            <div>
              <span className="text-slate-900 font-black text-sm tracking-tight">Admin Panel</span>
              <span className="hidden sm:inline text-slate-400 text-xs ml-2">isgdenetim.com.tr</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'orgs' && (
              <button onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md shadow-amber-400/20">
                <i className="ri-add-line text-sm"></i>Yeni Org.
              </button>
            )}
            <button onClick={fetchOrgs} disabled={loading}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 transition-all cursor-pointer">
              <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            <button onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-red-50 hover:border-red-200 border border-slate-200 text-slate-500 hover:text-red-500 transition-all cursor-pointer">
              <i className="ri-logout-box-line text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Sekmeler */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
          {(['orgs', 'support'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {t === 'orgs' ? 'Organizasyonlar' : 'Destek Talepleri'}
            </button>
          ))}
        </div>

        {/* Destek Talepleri */}
        {activeTab === 'support' && <SupportTicketsPanel />}

        {/* Organizasyonlar */}
        {activeTab === 'orgs' && (
          <>
            {/* İstatistik Kartları */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { icon: 'ri-building-2-line', label: 'Toplam', value: stats.total, key: 'all', iconColor: 'text-slate-600', iconBg: 'bg-slate-100' },
                { icon: 'ri-checkbox-circle-line', label: 'Aktif', value: stats.active, key: 'active', iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50' },
                { icon: 'ri-pause-circle-line', label: 'Pasif', value: stats.passive, key: 'passive', iconColor: 'text-red-500', iconBg: 'bg-red-50' },
                { icon: 'ri-timer-flash-line', label: 'Süresi Doldu', value: stats.expired, key: 'expired', iconColor: 'text-orange-500', iconBg: 'bg-orange-50' },
                { icon: 'ri-alarm-warning-line', label: '14 Günde Doluyor', value: stats.expiringSoon, key: null, iconColor: 'text-amber-500', iconBg: 'bg-amber-50' },
                { icon: 'ri-team-line', label: 'Toplam Üye', value: stats.totalMembers, key: null, iconColor: 'text-slate-500', iconBg: 'bg-slate-100' },
              ].map((s, i) => {
                const isActive = s.key && filter === s.key;
                return (
                  <button key={i} onClick={() => s.key && setFilter(s.key as typeof filter)}
                    className={`relative p-4 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'bg-slate-900 border-slate-900 shadow-lg'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm shadow-sm'
                    } ${s.key ? 'cursor-pointer' : 'cursor-default'}`}>
                    <div className={`w-8 h-8 flex items-center justify-center rounded-xl mb-3 ${isActive ? 'bg-white/15' : s.iconBg}`}>
                      <i className={`${s.icon} text-sm ${isActive ? 'text-white' : s.iconColor}`}></i>
                    </div>
                    <p className={`text-2xl font-black ${isActive ? 'text-white' : 'text-slate-900'}`}>{s.value}</p>
                    <p className={`text-xs mt-0.5 leading-tight font-medium ${isActive ? 'text-white/60' : 'text-slate-500'}`}>{s.label}</p>
                  </button>
                );
              })}
            </div>

            {/* Tablo */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-slate-900 text-sm font-bold">
                    {filter === 'all' ? 'Tüm Organizasyonlar' : filter === 'active' ? 'Aktif' : filter === 'passive' ? 'Pasif' : 'Süresi Doldu'}
                  </p>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full font-semibold">{filteredOrgs.length}</span>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                    <i className="ri-search-line text-sm"></i>
                  </div>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..."
                    className="bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 transition-all w-52" />
                </div>
              </div>

              {loading && !orgs.length ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <i className="ri-loader-4-line animate-spin text-xl mr-3"></i>
                  <span className="text-sm">Yükleniyor...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-red-500 gap-3">
                  <i className="ri-error-warning-line text-3xl"></i>
                  <p className="text-sm">{error}</p>
                  <button onClick={fetchOrgs} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-xl cursor-pointer font-medium">Tekrar Dene</button>
                </div>
              ) : (
                <OrgTable orgs={filteredOrgs} onSelect={org => setSelectedOrg(org)} search={search} />
              )}
            </div>
          </>
        )}
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
