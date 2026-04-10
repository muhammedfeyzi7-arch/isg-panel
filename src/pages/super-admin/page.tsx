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
      try {
        const saToken = sessionStorage.getItem('sa_access_token');
        const saUserId = sessionStorage.getItem('sa_user_id');
        if (!saToken || !saUserId) { navigate('/super-admin/login', { replace: true }); return; }
        const { data: { user }, error: userErr } = await supabase.auth.getUser(saToken);
        if (userErr || !user || user.id !== saUserId) {
          sessionStorage.removeItem('sa_access_token');
          sessionStorage.removeItem('sa_user_id');
          navigate('/super-admin/login', { replace: true });
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('user_id', user.id).maybeSingle();
        if (!profile?.is_super_admin) {
          sessionStorage.removeItem('sa_access_token');
          sessionStorage.removeItem('sa_user_id');
          navigate('/super-admin/login', { replace: true });
          return;
        }
        setIsSuperAdmin(true);
        setAuthChecked(true);
      } catch {
        sessionStorage.removeItem('sa_access_token');
        sessionStorage.removeItem('sa_user_id');
        navigate('/super-admin/login', { replace: true });
      }
    })();
  }, [navigate]);

  useEffect(() => { if (authChecked) fetchOrgs(); }, [authChecked, fetchOrgs]);

  const handleLogout = () => {
    sessionStorage.removeItem('sa_access_token');
    sessionStorage.removeItem('sa_user_id');
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
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-400">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">Yetki kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  const statCards = [
    { label: 'Toplam',        value: stats.total,         key: 'all' as const,     dot: '#94a3b8' },
    { label: 'Aktif',         value: stats.active,        key: 'active' as const,  dot: '#10b981' },
    { label: 'Pasif',         value: stats.passive,       key: 'passive' as const, dot: '#f87171' },
    { label: 'Süresi Doldu',  value: stats.expired,       key: 'expired' as const, dot: '#fb923c' },
    { label: '14 Günde Doluyor', value: stats.expiringSoon, key: null,             dot: '#fbbf24' },
    { label: 'Toplam Üye',   value: stats.totalMembers,  key: null,               dot: '#94a3b8' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-900">
              <i className="ri-shield-keyhole-fill text-white text-xs"></i>
            </div>
            <span className="text-slate-800 font-semibold text-sm">Admin Panel</span>
            <span className="hidden sm:block text-slate-300 text-sm">·</span>
            <span className="hidden sm:block text-slate-400 text-xs">isgdenetim.com.tr</span>
          </div>

          {/* Sağ */}
          <div className="flex items-center gap-2">
            {activeTab === 'orgs' && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-add-line text-sm"></i>
                <span className="hidden sm:inline">Yeni Organizasyon</span>
                <span className="sm:hidden">Yeni</span>
              </button>
            )}
            <button
              onClick={fetchOrgs}
              disabled={loading}
              title="Yenile"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 cursor-pointer transition-colors"
            >
              <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            <button
              onClick={handleLogout}
              title="Çıkış"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-400 cursor-pointer transition-colors"
            >
              <i className="ri-logout-box-line text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">

        {/* Tab bar */}
        <div className="flex items-center gap-1">
          {(['orgs', 'support'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === t
                  ? 'bg-white border border-slate-200 text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
              }`}
            >
              {t === 'orgs' ? 'Organizasyonlar' : 'Destek Talepleri'}
            </button>
          ))}
        </div>

        {activeTab === 'support' && <SupportTicketsPanel />}

        {activeTab === 'orgs' && (
          <>
            {/* Stat kartları */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {statCards.map((s, i) => {
                const isActive = s.key !== null && filter === s.key;
                return (
                  <button
                    key={i}
                    onClick={() => s.key && setFilter(s.key)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      s.key ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      isActive
                        ? 'bg-slate-900 border-slate-900'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-3">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: isActive ? 'rgba(255,255,255,0.5)' : s.dot }}
                      />
                      <span className={`text-xs font-medium truncate ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                        {s.label}
                      </span>
                    </div>
                    <p className={`text-2xl font-semibold tracking-tight ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {s.value}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Tablo kartı */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Tablo başlığı */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-slate-800 font-semibold text-sm">
                    {filter === 'all' ? 'Tüm Organizasyonlar' : filter === 'active' ? 'Aktif' : filter === 'passive' ? 'Pasif' : 'Süresi Dolmuş'}
                  </h2>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-md">
                    {filteredOrgs.length}
                  </span>
                </div>
                <div className="relative w-full sm:w-auto">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Ara..."
                    className="w-full sm:w-52 pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {loading && !orgs.length ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <i className="ri-loader-4-line animate-spin text-xl mr-2.5"></i>
                  <span className="text-sm">Yükleniyor...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <i className="ri-error-warning-line text-2xl text-red-400"></i>
                  <p className="text-sm text-slate-500">{error}</p>
                  <button onClick={fetchOrgs} className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg cursor-pointer font-medium transition-colors">
                    Tekrar Dene
                  </button>
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
