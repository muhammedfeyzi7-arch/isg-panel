import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganizationAdmin, type OrgAdmin } from './hooks/useOrganizationAdmin';
import OrgDetailSheet from './components/OrgDetailSheet';
import OrgCreateSheet from './components/OrgCreateSheet';
import SupportTicketsPanel from './components/SupportTicketsPanel';

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

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysLeft(d: string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000);
}

const CARD_COLORS = [
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
];

function orgColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}

function orgInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function OrgCard({ org, onSelect }: { org: OrgAdmin; onSelect: (o: OrgAdmin) => void }) {
  const days = daysLeft(org.subscription_end);
  const isExpired = org.subscription_end ? new Date(org.subscription_end) < new Date() : false;
  const color = orgColor(org.name);

  let statusLabel = 'Aktif';
  let statusCls = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (!org.is_active) { statusLabel = 'Pasif'; statusCls = 'bg-red-50 text-red-600 border border-red-200'; }
  else if (isExpired) { statusLabel = 'Doldu'; statusCls = 'bg-orange-50 text-orange-600 border border-orange-200'; }
  else if (days !== null && days <= 14) { statusLabel = `${days}g kaldı`; statusCls = 'bg-amber-50 text-amber-700 border border-amber-200'; }

  return (
    <button
      onClick={() => onSelect(org)}
      className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group w-full"
    >
      {/* Üst: avatar + rozetler */}
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${color.bg} ${color.text} flex items-center justify-center text-sm font-black flex-shrink-0`}>
          {orgInitials(org.name)}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${statusCls}`}>
            {statusLabel}
          </span>
          {org.org_type === 'osgb' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              <i className="ri-hospital-line text-xs"></i>OSGB
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
              <i className="ri-building-2-line text-xs"></i>Firma
            </span>
          )}
        </div>
      </div>

      {/* İsim & kod */}
      <div className="mb-4">
        <h3 className="text-slate-800 font-bold text-sm leading-snug line-clamp-2 mb-1 group-hover:text-slate-900">
          {org.name}
        </h3>
        <p className="text-slate-400 text-xs font-mono">{org.invite_code}</p>
      </div>

      {/* Alt bilgi */}
      <div className="flex items-center justify-between pt-3.5 border-t border-slate-100">
        <div className="flex items-center gap-1 text-slate-400">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-user-line text-xs"></i>
          </div>
          <span className="text-xs">{org.member_count || 0} üye</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 flex items-center justify-center text-slate-400">
            <i className="ri-calendar-line text-xs"></i>
          </div>
          <span className={`text-xs ${isExpired ? 'text-orange-500' : 'text-slate-400'}`}>
            {formatDate(org.subscription_end)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [superAdminUserId, setSuperAdminUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrgAdmin | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive' | 'expired'>('all');
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

  const stats = {
    total: orgs.length,
    active: orgs.filter(o => o.is_active && (o.subscription_end ? new Date(o.subscription_end) >= new Date() : true)).length,
    passive: orgs.filter(o => !o.is_active).length,
    expired: orgs.filter(o => o.is_active && o.subscription_end && new Date(o.subscription_end) < new Date()).length,
    osgb: orgs.filter(o => o.org_type === 'osgb').length,
    firma: orgs.filter(o => o.org_type === 'firma').length,
    totalMembers: orgs.reduce((acc, o) => acc + (o.member_count || 0), 0),
    expiringSoon: orgs.filter(o => {
      if (!o.is_active || !o.subscription_end) return false;
      const d = Math.ceil((new Date(o.subscription_end).getTime() - Date.now()) / 86400000);
      return d >= 0 && d <= 14;
    }).length,
  };

  const filteredOrgs = orgs.filter(org => {
    if (statusFilter === 'active' && !(org.is_active && (org.subscription_end ? new Date(org.subscription_end) >= new Date() : true))) return false;
    if (statusFilter === 'passive' && org.is_active) return false;
    if (statusFilter === 'expired' && !(org.is_active && org.subscription_end && new Date(org.subscription_end) < new Date())) return false;
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

  const statItems = [
    { label: 'Toplam',       value: stats.total,         icon: 'ri-grid-line',            iconCls: 'text-slate-500',   bgCls: 'bg-slate-100' },
    { label: 'Aktif',        value: stats.active,        icon: 'ri-checkbox-circle-line', iconCls: 'text-emerald-600', bgCls: 'bg-emerald-50' },
    { label: 'Pasif',        value: stats.passive,       icon: 'ri-close-circle-line',    iconCls: 'text-red-500',     bgCls: 'bg-red-50' },
    { label: 'Doldu',        value: stats.expired,       icon: 'ri-time-line',            iconCls: 'text-orange-500',  bgCls: 'bg-orange-50' },
    { label: '14g Dolacak',  value: stats.expiringSoon,  icon: 'ri-alarm-warning-line',   iconCls: 'text-amber-600',   bgCls: 'bg-amber-50' },
    { label: 'OSGB',         value: stats.osgb,          icon: 'ri-hospital-line',        iconCls: 'text-teal-600',    bgCls: 'bg-teal-50' },
    { label: 'Firma',        value: stats.firma,         icon: 'ri-building-2-line',      iconCls: 'text-indigo-600',  bgCls: 'bg-indigo-50' },
    { label: 'Toplam Üye',   value: stats.totalMembers,  icon: 'ri-team-line',            iconCls: 'text-slate-500',   bgCls: 'bg-slate-100' },
  ];

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

      <main className="max-w-screen-xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl w-fit">
          {([
            { key: 'orgs' as const, icon: 'ri-building-line', label: 'Hesaplar' },
            { key: 'support' as const, icon: 'ri-customer-service-2-line', label: 'Destek' },
          ]).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              <i className={`${t.icon} text-sm`}></i>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'support' && <SupportTicketsPanel />}

        {activeTab === 'orgs' && (
          <>
            {/* Stat kartları */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {statItems.map((s, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className={`w-7 h-7 flex items-center justify-center rounded-lg ${s.bgCls} mb-3`}>
                    <i className={`${s.icon} text-sm ${s.iconCls}`}></i>
                  </div>
                  <p className="text-slate-800 font-black text-xl leading-none mb-1">{s.value}</p>
                  <p className="text-slate-400 text-xs">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Filtre + Arama */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              {/* Durum filtresi */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl">
                {([
                  { key: 'all' as const, label: 'Tümü' },
                  { key: 'active' as const, label: 'Aktif' },
                  { key: 'passive' as const, label: 'Pasif' },
                  { key: 'expired' as const, label: 'Doldu' },
                ]).map(f => (
                  <button key={f.key} onClick={() => setStatusFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      statusFilter === f.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Tür filtresi */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl">
                {([
                  { key: 'all' as const, label: 'Tümü' },
                  { key: 'osgb' as const, label: 'OSGB' },
                  { key: 'firma' as const, label: 'Firma' },
                ]).map(f => (
                  <button key={f.key} onClick={() => setTypeFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      typeFilter === f.key
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Arama */}
              <div className="relative flex-1 sm:max-w-xs ml-auto">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="İsim veya kod ara..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all" />
              </div>

              <span className="text-slate-400 text-xs whitespace-nowrap">{filteredOrgs.length} hesap</span>
            </div>

            {/* Kartlar */}
            {loading && !orgs.length ? (
              <div className="flex items-center justify-center py-28 text-slate-400">
                <i className="ri-loader-4-line animate-spin text-2xl mr-3"></i>
                <span className="text-sm">Yükleniyor...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-28 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                  <i className="ri-error-warning-line text-2xl text-red-400"></i>
                </div>
                <p className="text-slate-500 text-sm">{error}</p>
                <button onClick={fetchOrgs}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer">
                  Tekrar Dene
                </button>
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <i className="ri-building-2-line text-2xl text-slate-300"></i>
                </div>
                <p className="text-slate-400 text-sm">Henüz hesap yok.</p>
                <button onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer whitespace-nowrap">
                  <i className="ri-add-line"></i> Yeni Hesap Oluştur
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredOrgs.map(org => (
                  <OrgCard key={org.id} org={org} onSelect={setSelectedOrg} />
                ))}
              </div>
            )}
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
