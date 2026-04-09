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

  // Auth kontrolü
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/super-admin/login', { replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!profile?.is_super_admin) {
        navigate('/super-admin/login', { replace: true });
        return;
      }
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

  // Filtrele
  const filteredOrgs = orgs.filter(org => {
    if (filter === 'active') return org.is_active && (org.subscription_end ? new Date(org.subscription_end) >= new Date() : true);
    if (filter === 'passive') return !org.is_active;
    if (filter === 'expired') return org.is_active && org.subscription_end && new Date(org.subscription_end) < new Date();
    return true;
  });

  // İstatistikler
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span>Yetki kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <i className="ri-shield-keyhole-line text-amber-400 text-sm"></i>
            </div>
            <div>
              <span className="text-white font-bold text-base tracking-tight">Süper Admin Paneli</span>
              <span className="text-slate-500 text-xs ml-2">isgdenetim.com.tr</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm"></i>
              Yeni Organizasyon
            </button>
            <button
              onClick={fetchOrgs}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
              Yenile
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-logout-box-line text-sm"></i>
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            icon="ri-building-2-line"
            label="Toplam Org."
            value={stats.total}
            color="amber"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <StatCard
            icon="ri-checkbox-circle-line"
            label="Aktif"
            value={stats.active}
            color="emerald"
            active={filter === 'active'}
            onClick={() => setFilter('active')}
          />
          <StatCard
            icon="ri-pause-circle-line"
            label="Pasif"
            value={stats.passive}
            color="red"
            active={filter === 'passive'}
            onClick={() => setFilter('passive')}
          />
          <StatCard
            icon="ri-timer-flash-line"
            label="Süresi Doldu"
            value={stats.expired}
            color="orange"
            active={filter === 'expired'}
            onClick={() => setFilter('expired')}
          />
          <StatCard
            icon="ri-alarm-warning-line"
            label="14 Günde Doluyor"
            value={stats.expiringSoon}
            color="yellow"
            active={false}
            onClick={() => {}}
          />
          <StatCard
            icon="ri-team-line"
            label="Toplam Üye"
            value={stats.totalMembers}
            color="slate"
            active={false}
            onClick={() => {}}
          />
        </div>

        {/* Tablo Bölümü */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden">
          {/* Tablo Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40 flex-wrap gap-3">
            <div>
              <h2 className="text-white font-semibold">Organizasyonlar</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                {filteredOrgs.length} organizasyon listeleniyor
              </p>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                <i className="ri-search-line text-sm"></i>
              </div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Organizasyon ara..."
                className="bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all w-64"
              />
            </div>
          </div>

          {/* Loading / Error / Table */}
          {loading && !orgs.length ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <i className="ri-loader-4-line animate-spin text-2xl mr-3"></i>
              Yükleniyor...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-red-400 flex-col gap-3">
              <i className="ri-error-warning-line text-3xl"></i>
              <p className="text-sm">{error}</p>
              <button
                onClick={fetchOrgs}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg cursor-pointer"
              >
                Tekrar Dene
              </button>
            </div>
          ) : (
            <OrgTable
              orgs={filteredOrgs}
              onSelect={org => setSelectedOrg(org)}
              search={search}
            />
          )}
        </div>
      </main>

      {/* Create Sheet */}
      <OrgCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { fetchOrgs(); }}
      />

      {/* Detail Sheet */}
      <OrgDetailSheet
        org={selectedOrg}
        onClose={() => setSelectedOrg(null)}
        onUpdate={async (id, fields) => {
          await updateSubscription(id, fields);
          // Seçili org'u güncelle
          setSelectedOrg(prev => prev ? { ...prev, ...fields } : null);
        }}
        onDelete={deleteOrg}
      />
    </div>
  );
}

// Stat kart bileşeni
function StatCard({
  icon,
  label,
  value,
  color,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  value: number;
  color: 'amber' | 'emerald' | 'red' | 'orange' | 'yellow' | 'slate';
  active: boolean;
  onClick: () => void;
}) {
  const colorMap = {
    amber: { bg: 'bg-amber-500/10', border: active ? 'border-amber-500/50' : 'border-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500/30' },
    emerald: { bg: 'bg-emerald-500/10', border: active ? 'border-emerald-500/50' : 'border-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
    red: { bg: 'bg-red-500/10', border: active ? 'border-red-500/50' : 'border-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30' },
    orange: { bg: 'bg-orange-500/10', border: active ? 'border-orange-500/50' : 'border-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/30' },
    yellow: { bg: 'bg-yellow-500/10', border: active ? 'border-yellow-500/50' : 'border-yellow-500/20', text: 'text-yellow-400', ring: 'ring-yellow-500/30' },
    slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400', ring: 'ring-slate-500/30' },
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      className={`bg-slate-800/50 border ${c.border} rounded-xl p-4 text-left transition-all cursor-pointer ${active ? `ring-1 ${c.ring}` : 'hover:bg-slate-800'}`}
    >
      <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${c.bg} mb-3`}>
        <i className={`${icon} ${c.text} text-sm`}></i>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-slate-400 text-xs mt-0.5">{label}</p>
    </button>
  );
}
