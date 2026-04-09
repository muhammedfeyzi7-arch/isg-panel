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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm font-medium">Yetki kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  const statCards = [
    { icon: 'ri-building-2-line', label: 'Toplam Org.', value: stats.total, key: 'all' as const, color: '#6366F1', bg: '#EEF2FF' },
    { icon: 'ri-checkbox-circle-line', label: 'Aktif', value: stats.active, key: 'active' as const, color: '#10B981', bg: '#ECFDF5' },
    { icon: 'ri-pause-circle-line', label: 'Pasif', value: stats.passive, key: 'passive' as const, color: '#EF4444', bg: '#FEF2F2' },
    { icon: 'ri-timer-flash-line', label: 'Süresi Doldu', value: stats.expired, key: 'expired' as const, color: '#F97316', bg: '#FFF7ED' },
    { icon: 'ri-alarm-warning-line', label: '14 Günde Doluyor', value: stats.expiringSoon, key: null, color: '#F59E0B', bg: '#FFFBEB' },
    { icon: 'ri-team-line', label: 'Toplam Üye', value: stats.totalMembers, key: null, color: '#64748B', bg: '#F8FAFC' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}>
              <i className="ri-shield-keyhole-fill text-white text-sm"></i>
            </div>
            <div>
              <p className="text-slate-900 font-bold text-sm leading-none">Admin Panel</p>
              <p className="text-slate-400 text-xs mt-0.5">isgdenetim.com.tr</p>
            </div>
          </div>

          {/* Sağ aksiyonlar */}
          <div className="flex items-center gap-2">
            {activeTab === 'orgs' && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold cursor-pointer whitespace-nowrap transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}
              >
                <i className="ri-add-line"></i>
                Yeni Organizasyon
              </button>
            )}
            <button
              onClick={fetchOrgs}
              disabled={loading}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 cursor-pointer transition-all"
            >
              <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            <button
              onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-500 cursor-pointer transition-all"
            >
              <i className="ri-logout-box-line text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-8 py-8 space-y-6">

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl w-fit">
          {(['orgs', 'support'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {statCards.map((s, i) => {
                const isActive = s.key !== null && filter === s.key;
                return (
                  <button
                    key={i}
                    onClick={() => s.key && setFilter(s.key)}
                    className={`p-5 rounded-2xl border text-left transition-all ${s.key ? 'cursor-pointer' : 'cursor-default'} ${
                      isActive
                        ? 'border-slate-900 bg-slate-900'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: isActive ? 'rgba(255,255,255,0.15)' : s.bg }}
                    >
                      <i className={`${s.icon} text-sm`} style={{ color: isActive ? '#fff' : s.color }}></i>
                    </div>
                    <p className={`text-2xl font-black mb-1 ${isActive ? 'text-white' : 'text-slate-900'}`}>{s.value}</p>
                    <p className={`text-xs font-medium leading-tight ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</p>
                  </button>
                );
              })}
            </div>

            {/* Tablo kartı */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* Tablo başlığı */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h2 className="text-slate-900 font-bold text-sm">
                    {filter === 'all' ? 'Tüm Organizasyonlar' : filter === 'active' ? 'Aktif Organizasyonlar' : filter === 'passive' ? 'Pasif Organizasyonlar' : 'Süresi Dolmuş'}
                  </h2>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                    {filteredOrgs.length}
                  </span>
                </div>
                <div className="relative">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Organizasyon ara..."
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 transition-all w-56"
                  />
                </div>
              </div>

              {loading && !orgs.length ? (
                <div className="flex items-center justify-center py-24 text-slate-400">
                  <i className="ri-loader-4-line animate-spin text-2xl mr-3"></i>
                  <span className="text-sm">Yükleniyor...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <i className="ri-error-warning-line text-3xl text-red-400"></i>
                  <p className="text-sm text-slate-500">{error}</p>
                  <button onClick={fetchOrgs} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-xl cursor-pointer font-medium">
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
