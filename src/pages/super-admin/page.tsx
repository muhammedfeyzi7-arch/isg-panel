import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Organization {
  id: string;
  name: string;
  invite_code: string;
  is_active: boolean;
  subscription_start: string | null;
  subscription_end: string | null;
  created_at: string;
  member_count?: number;
}

interface EditForm {
  is_active: boolean;
  subscription_start: string;
  subscription_end: string;
}

export default function SuperAdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [currentEmail, setCurrentEmail] = useState('');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ is_active: true, subscription_start: '', subscription_end: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const checkAuth = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email ?? '';
    setCurrentEmail(email);
    setAuthorized(!!email);
  }, []);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, invite_code, is_active, subscription_start, subscription_end, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orgsWithCount = await Promise.all(
        (data ?? []).map(async (org) => {
          const { count } = await supabase
            .from('user_organizations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_active', true);
          return { ...org, member_count: count ?? 0 };
        })
      );

      setOrgs(orgsWithCount);
    } catch (e) {
      showToast('Organizasyonlar yüklenemedi: ' + String(e), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authorized) loadOrgs();
  }, [authorized, loadOrgs]);

  const startEdit = (org: Organization) => {
    setEditingId(org.id);
    setEditForm({
      is_active: org.is_active,
      subscription_start: org.subscription_start ? org.subscription_start.slice(0, 10) : new Date().toISOString().slice(0, 10),
      subscription_end: org.subscription_end ? org.subscription_end.slice(0, 10) : '',
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (orgId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          is_active: editForm.is_active,
          subscription_start: editForm.subscription_start || null,
          subscription_end: editForm.subscription_end || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId);

      if (error) throw error;
      showToast('Kaydedildi!', 'success');
      setEditingId(null);
      await loadOrgs();
    } catch (e) {
      showToast('Kayıt hatası: ' + String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const getStatus = (org: Organization) => {
    if (!org.is_active) return { label: 'Pasif', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' };
    if (!org.subscription_end) return { label: 'Aktif', color: 'bg-green-50 text-green-700', dot: 'bg-green-500' };
    const end = new Date(org.subscription_end);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (end < now) return { label: 'Süresi Doldu', color: 'bg-red-50 text-red-700', dot: 'bg-red-500' };
    if (diffDays <= 30) return { label: `${diffDays} gün kaldı`, color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' };
    return { label: 'Aktif', color: 'bg-green-50 text-green-700', dot: 'bg-green-500' };
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.invite_code.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: orgs.length,
    active: orgs.filter(o => getStatus(o).label === 'Aktif').length,
    expired: orgs.filter(o => getStatus(o).label === 'Süresi Doldu').length,
    expiringSoon: orgs.filter(o => getStatus(o).label.includes('gün')).length,
    passive: orgs.filter(o => !o.is_active).length,
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 bg-red-100 rounded-full">
            <i className="ri-lock-line text-2xl text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Erişim Reddedildi</h1>
          <p className="text-gray-500 text-sm">Önce giriş yapmanız gerekmektedir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <i className="ri-check-line mr-2" /> : <i className="ri-error-warning-line mr-2" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-gray-900 rounded-lg">
              <i className="ri-shield-keyhole-line text-white text-sm" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Super Admin Paneli</h1>
              <p className="text-xs text-gray-400">{currentEmail}</p>
            </div>
          </div>
          <button
            onClick={loadOrgs}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* İstatistik kartları */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Toplam', value: stats.total, icon: 'ri-building-2-line', bg: 'bg-gray-100', text: 'text-gray-700' },
            { label: 'Aktif', value: stats.active, icon: 'ri-checkbox-circle-line', bg: 'bg-green-100', text: 'text-green-700' },
            { label: 'Süresi Doldu', value: stats.expired, icon: 'ri-close-circle-line', bg: 'bg-red-100', text: 'text-red-700' },
            { label: 'Yakında Dolacak', value: stats.expiringSoon, icon: 'ri-time-line', bg: 'bg-amber-100', text: 'text-amber-700' },
            { label: 'Pasif', value: stats.passive, icon: 'ri-pause-circle-line', bg: 'bg-gray-100', text: 'text-gray-500' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${card.bg} mb-3`}>
                <i className={`${card.icon} ${card.text} text-sm`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Arama */}
        <div className="mb-4">
          <div className="relative max-w-xs">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Organizasyon veya kod ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
        </div>

        {/* Tablo */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Yükleniyor...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
                <i className="ri-building-line text-gray-400 text-xl" />
              </div>
              <p className="text-sm text-gray-400">Organizasyon bulunamadı</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Organizasyon</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Durum</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Başlangıç</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Bitiş</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Üye</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(org => {
                  const status = getStatus(org);
                  const isEditing = editingId === org.id;
                  return (
                    <tr key={org.id} className={`transition-colors ${isEditing ? 'bg-amber-50/60' : 'hover:bg-gray-50/60'}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{org.invite_code}</p>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {isEditing ? (
                          <div
                            onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                            className="flex items-center gap-2 cursor-pointer w-fit"
                          >
                            <div className={`w-10 h-5 rounded-full transition-colors relative ${editForm.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${editForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">{editForm.is_active ? 'Aktif' : 'Pasif'}</span>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.subscription_start}
                            onChange={e => setEditForm(f => ({ ...f, subscription_start: e.target.value }))}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 w-36"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{formatDate(org.subscription_start)}</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.subscription_end}
                            onChange={e => setEditForm(f => ({ ...f, subscription_end: e.target.value }))}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 w-36"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{formatDate(org.subscription_end)}</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <i className="ri-user-line text-gray-400 text-xs" />
                          </div>
                          <span className="text-sm text-gray-600">{org.member_count}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              İptal
                            </button>
                            <button
                              onClick={() => saveEdit(org.id)}
                              disabled={saving}
                              className="px-4 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                            >
                              {saving ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                                  Kaydediliyor
                                </span>
                              ) : 'Kaydet'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(org)}
                            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-edit-line mr-1" />
                            Düzenle
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bilgi notu */}
        <div className="mt-5 bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
          <div className="w-5 h-5 flex items-center justify-center mt-0.5 shrink-0">
            <i className="ri-information-line text-amber-500 text-sm" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800 mb-1">Nasıl Çalışır?</p>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• <strong>Bitiş tarihi</strong> geçmiş organizasyonlar bir sonraki girişte sisteme giremez</li>
              <li>• <strong>Pasif</strong> yapılan organizasyonlar bir sonraki girişte anında engellenir</li>
              <li>• Tarih boş bırakılırsa o organizasyon süresiz aktif sayılır</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
