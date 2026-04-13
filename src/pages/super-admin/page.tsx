import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganizationAdmin, type OrgAdmin } from './hooks/useOrganizationAdmin';
import OrgDetailSheet from './components/OrgDetailSheet';
import OrgCreateSheet from './components/OrgCreateSheet';
import SupportTicketsPanel from './components/SupportTicketsPanel';
import OrgTableView from './components/OrgTable';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

async function saVerifyToken(userId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=is_super_admin&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return rows?.[0]?.is_super_admin === true;
  } catch { return false; }
}

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [superAdminUserId, setSuperAdminUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrgAdmin | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive' | 'expired' | 'expiring'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'osgb' | 'firma'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'orgs' | 'support'>('orgs');

  const { orgs, loading, error, fetchOrgs, updateSubscription, deleteOrg } = useOrganizationAdmin();

  useEffect(() => {
    (async () => {
      try {
        const saToken = sessionStorage.getItem('sa_access_token');
        const saUserId = sessionStorage.getItem('sa_user_id');
        if (!saToken || !saUserId) { navigate('/super-admin/login', { replace: true }); return; }
        const isSA = await saVerifyToken(saUserId, saToken);
        if (!isSA) {
          sessionStorage.removeItem('sa_access_token');
          sessionStorage.removeItem('sa_user_id');
          navigate('/super-admin/login', { replace: true });
          return;
        }
        setSuperAdminUserId(saUserId);
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

  const isExpiredFn = (o: OrgAdmin) =>
    o.is_active && o.subscription_end ? new Date(o.subscription_end) < new Date() : false;
  const isExpiringFn = (o: OrgAdmin) => {
    if (!o.is_active || !o.subscription_end) return false;
    const d = Math.ceil((new Date(o.subscription_end).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 14;
  };

  const stats = {
    total: orgs.length,
    active: orgs.filter(o => o.is_active && !isExpiredFn(o)).length,
    expired: orgs.filter(o => isExpiredFn(o)).length,
    expiring: orgs.filter(o => isExpiringFn(o)).length,
  };

  const filteredOrgs = orgs.filter(org => {
    if (statusFilter === 'active' && !(org.is_active && !isExpiredFn(org))) return false;
    if (statusFilter === 'passive' && org.is_active) return false;
    if (statusFilter === 'expired' && !isExpiredFn(org)) return false;
    if (statusFilter === 'expiring' && !isExpiringFn(org)) return false;
    if (typeFilter === 'osgb' && org.org_type !== 'osgb') return false;
    if (typeFilter === 'firma' && org.org_type !== 'firma') return false;
    if (search) {
      const q = search.toLowerCase();
      return org.name.toLowerCase().includes(q) || org.invite_code.toLowerCase().includes(q);
    }
    return true;
  });

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-400">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm">Yetki kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
              <i className="ri-shield-keyhole-fill text-white text-sm"></i>
            </div>
            <span className="text-slate-800 font-bold text-sm">Super Admin</span>
            <span className="hidden sm:block text-slate-300">·</span>
            <span className="hidden sm:block text-slate-400 text-xs">isgdenetim.com.tr</span>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'orgs' && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-add-line text-sm"></i>
                Yeni Hesap
              </button>
            )}
            <button onClick={fetchOrgs} disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 cursor-pointer transition-colors">
              <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            <button onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-400 cursor-pointer transition-colors">
              <i className="ri-logout-box-line text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 md:px-8 py-6 space-y-5">
        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl w-fit">
          {([
            { key: 'orgs' as const, icon: 'ri-building-line', label: 'Hesaplar' },
            { key: 'support' as const, icon: 'ri-customer-service-2-line', label: 'Destek' },
          ]).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <i className={`${t.icon} text-sm`}></i>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'support' && <SupportTicketsPanel />}

        {activeTab === 'orgs' && (
          <>
            {/* Uyarı barı */}
            {stats.expiring > 0 && (
              <button
                onClick={() => setStatusFilter('expiring')}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-left cursor-pointer hover:bg-amber-100 transition-colors group"
              >
                <div className="w-6 h-6 flex items-center justify-center rounded-lg bg-amber-100 flex-shrink-0">
                  <i className="ri-alarm-warning-line text-amber-600 text-sm"></i>
                </div>
                <p className="text-amber-700 text-xs font-medium flex-1">
                  <strong>{stats.expiring} üyenin</strong> abonelik süresi 14 gün içinde bitiyor
                </p>
                <span className="text-amber-500 text-xs font-semibold group-hover:underline whitespace-nowrap">
                  Filtrele →
                </span>
              </button>
            )}

            {/* İstatistik kartları */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Toplam Üye', value: stats.total, icon: 'ri-building-line', color: 'text-slate-600', bg: 'bg-slate-100', filter: 'all' as const },
                { label: 'Aktif Üye', value: stats.active, icon: 'ri-checkbox-circle-line', color: 'text-emerald-600', bg: 'bg-emerald-50', filter: 'active' as const },
                { label: 'Süresi Dolmuş', value: stats.expired, icon: 'ri-time-line', color: 'text-red-500', bg: 'bg-red-50', filter: 'expired' as const },
                { label: 'Süresi Yaklaşan', value: stats.expiring, icon: 'ri-alarm-warning-line', color: 'text-amber-600', bg: 'bg-amber-50', filter: 'expiring' as const },
              ].map((s) => (
                <button
                  key={s.filter}
                  onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
                  className={`flex items-center gap-3 p-4 bg-white border rounded-xl text-left cursor-pointer transition-all hover:border-slate-300 ${
                    statusFilter === s.filter ? 'border-slate-400 ring-1 ring-slate-300' : 'border-slate-200'
                  }`}
                >
                  <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${s.bg} flex-shrink-0`}>
                    <i className={`${s.icon} ${s.color} text-base`}></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-800 font-bold text-xl leading-none tabular-nums">{s.value}</p>
                    <p className="text-slate-500 text-xs mt-0.5 whitespace-nowrap">{s.label}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Arama + Filtre */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              {/* Tür filtresi */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl">
                {([
                  { key: 'all' as const, label: 'Tümü' },
                  { key: 'osgb' as const, label: 'OSGB' },
                  { key: 'firma' as const, label: 'Firma' },
                ]).map(f => (
                  <button key={f.key} onClick={() => setTypeFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      typeFilter === f.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Aktif filtre badge */}
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap"
                >
                  <i className="ri-filter-3-line text-xs"></i>
                  {statusFilter === 'active' ? 'Aktif' : statusFilter === 'passive' ? 'Pasif' : statusFilter === 'expired' ? 'Süresi Dolmuş' : 'Süresi Yaklaşan'}
                  <i className="ri-close-line text-xs"></i>
                </button>
              )}

              {/* Arama */}
              <div className="relative flex-1 sm:max-w-xs ml-auto">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="İsim veya kod ara..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <i className="ri-close-line text-sm"></i>
                  </button>
                )}
              </div>
              <span className="text-slate-400 text-xs whitespace-nowrap">{filteredOrgs.length} hesap</span>
            </div>

            {/* Tablo */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {loading && !orgs.length ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <i className="ri-loader-4-line animate-spin text-2xl mr-3"></i>
                  <span className="text-sm">Yükleniyor...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                    <i className="ri-error-warning-line text-xl text-red-400"></i>
                  </div>
                  <p className="text-slate-500 text-sm">{error}</p>
                  <button onClick={fetchOrgs} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer">Tekrar Dene</button>
                </div>
              ) : filteredOrgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                    <i className="ri-building-2-line text-2xl text-slate-300"></i>
                  </div>
                  <p className="text-slate-400 text-sm">Hesap bulunamadı.</p>
                  {search || statusFilter !== 'all' || typeFilter !== 'all' ? (
                    <button
                      onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); }}
                      className="text-slate-500 text-xs underline cursor-pointer"
                    >
                      Filtreleri temizle
                    </button>
                  ) : (
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-add-line"></i> Yeni Hesap Oluştur
                    </button>
                  )}
                </div>
              ) : (
                <OrgTableView
                  orgs={filteredOrgs}
                  onSelect={setSelectedOrg}
                  onToggleActive={async (org) => {
                    await updateSubscription(org.id, { is_active: !org.is_active });
                  }}
                />
              )}
            </div>
          </>
        )}
      </main>

      <OrgCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={fetchOrgs} />
      <OrgDetailSheet
        org={selectedOrg}
        superAdminUserId={superAdminUserId}
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
