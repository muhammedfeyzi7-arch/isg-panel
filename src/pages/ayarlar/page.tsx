import { useState, useEffect } from 'react';
import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import Button from '@/components/base/Button';
import Drawer from '@/components/base/Drawer';
import EmptyState from '@/components/base/EmptyState';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import { listOrgProfiles, createUser, updateProfile } from '@/services/authService';
import { getOrganization, updateOrganization } from '@/services/organizationService';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getDeletedFirms, restoreFirm, deleteFirm,
} from '@/services/firmService';
import {
  getDeletedPersonnel, restorePersonnel, hardDeletePersonnel,
} from '@/services/personnelService';
import type {
  MemberRole, SpecializationClass, OrganizationRow, ProfileRow, ProfileStatus, AppFirm, AppPersonnel,
} from '@/types/database';

const roleMap: Record<string, string> = { owner: 'Sahip', admin: 'Yönetici', specialist: 'Uzman', doctor: 'Hekim' };

interface MemberDisplay {
  id: string; name: string; email: string; phone: string; role: MemberRole; status: ProfileStatus;
}

type ActiveTab = 'osgb' | 'ekip' | 'cop';

export default function AyarlarPage() {
  const { session, canManage } = useAuth();
  const { showToast, refreshFirms, refreshPersonnel } = useApp();
  const configured = isSupabaseConfigured();

  const [activeTab, setActiveTab] = useState<ActiveTab>('osgb');

  // ── Ekip ──────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editMember, setEditMember] = useState<MemberDisplay | null>(null);
  const [newUser, setNewUser] = useState({
    name: '', role: 'specialist' as 'specialist' | 'doctor',
    email: '', phone: '', password: '',
    specializationClass: 'A' as SpecializationClass,
  });
  const [userErrors, setUserErrors] = useState<Record<string, string>>({});
  const [userSaving, setUserSaving] = useState(false);

  // ── OSGB ──────────────────────────────────────────────────────────────────
  const [org, setOrg] = useState<OrganizationRow | null>(null);
  const [osgbForm, setOsgbForm] = useState({ name: '', taxNo: '', address: '', phone: '', email: '', website: '', authorizationNo: '' });
  const [orgSaving, setOrgSaving] = useState(false);

  // ── Çöp Kutusu ────────────────────────────────────────────────────────────
  const [trashFirms, setTrashFirms] = useState<AppFirm[]>([]);
  const [trashPersonnel, setTrashPersonnel] = useState<AppPersonnel[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashTab, setTrashTab] = useState<'firms' | 'personnel'>('firms');
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<{ type: 'firm' | 'personnel'; id: string; name: string } | null>(null);

  const loadMembers = async () => {
    if (!configured || !session?.organizationId) return;
    setMembersLoading(true);
    try {
      const data = await listOrgProfiles(session.organizationId);
      setMembers(data.map((p: ProfileRow) => ({
        id: p.id, name: p.full_name, email: p.email, phone: p.phone ?? '—', role: p.role, status: p.status,
      })));
    } finally {
      setMembersLoading(false);
    }
  };

  const loadTrash = async () => {
    if (!configured || !session?.organizationId) return;
    setTrashLoading(true);
    try {
      const [firms, personnel] = await Promise.all([
        getDeletedFirms(session.organizationId),
        getDeletedPersonnel(session.organizationId),
      ]);
      setTrashFirms(firms);
      setTrashPersonnel(personnel);
    } catch {
      showToast('Çöp kutusu yüklenemedi', 'error');
    } finally {
      setTrashLoading(false);
    }
  };

  useEffect(() => {
    if (!configured || !session?.organizationId) return;
    getOrganization(session.organizationId).then((o) => {
      if (o) {
        setOrg(o);
        setOsgbForm({ name: o.name ?? '', taxNo: o.tax_no ?? '', address: o.address ?? '', phone: o.phone ?? '', email: o.email ?? '', website: o.website ?? '', authorizationNo: o.auth_no ?? '' });
      }
    });
    loadMembers();
  }, [configured, session?.organizationId]);

  useEffect(() => {
    if (activeTab === 'cop') loadTrash();
  }, [activeTab]);

  // ── OSGB kaydet ───────────────────────────────────────────────────────────
  const handleSaveOrg = async () => {
    if (!session?.organizationId) return;
    setOrgSaving(true);
    try {
      await updateOrganization(session.organizationId, { name: osgbForm.name, taxNo: osgbForm.taxNo, address: osgbForm.address, phone: osgbForm.phone, email: osgbForm.email, website: osgbForm.website, authNo: osgbForm.authorizationNo });
      showToast('OSGB bilgileri güncellendi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Güncelleme başarısız', 'error');
    } finally {
      setOrgSaving(false);
    }
  };

  // ── Kullanıcı ekle ────────────────────────────────────────────────────────
  const validateUser = () => {
    const errs: Record<string, string> = {};
    if (!newUser.name.trim()) errs.name = 'Ad Soyad zorunludur';
    if (!newUser.email.trim()) errs.email = 'E-posta zorunludur';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) errs.email = 'Geçerli e-posta girin';
    if (!newUser.password || newUser.password.length < 8) errs.password = 'En az 8 karakter şifre girin';
    setUserErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveUser = async () => {
    if (!validateUser() || !session?.organizationId) return;
    setUserSaving(true);
    try {
      if (configured) {
        await createUser({ email: newUser.email, password: newUser.password, fullName: newUser.name, phone: newUser.phone, role: newUser.role, organizationId: session.organizationId, specializationClass: newUser.role === 'specialist' ? newUser.specializationClass : undefined });
        await loadMembers();
      } else {
        setMembers((prev) => [...prev, { id: String(Date.now()), name: newUser.name, email: newUser.email, phone: newUser.phone, role: newUser.role, status: 'active' }]);
      }
      showToast(`"${newUser.name}" kullanıcısı oluşturuldu`);
      setNewUser({ name: '', role: 'specialist', email: '', phone: '', password: '', specializationClass: 'A' });
      setUserErrors({});
      setAddUserOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kullanıcı oluşturulamadı', 'error');
    } finally {
      setUserSaving(false);
    }
  };

  const handleToggleStatus = async (member: MemberDisplay) => {
    const newStatus: ProfileStatus = member.status === 'active' ? 'passive' : 'active';
    try {
      if (configured) await updateProfile(member.id, { status: newStatus });
      setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, status: newStatus } : m));
      showToast(`${member.name} ${newStatus === 'active' ? 'aktif edildi' : 'pasif yapıldı'}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Güncelleme başarısız', 'error');
    }
  };

  const handleChangeRole = async (member: MemberDisplay, role: MemberRole) => {
    try {
      if (configured) await updateProfile(member.id, { role });
      setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role } : m));
      setEditMember(null);
      showToast(`${member.name} rolü güncellendi`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Güncelleme başarısız', 'error');
    }
  };

  // ── Çöp Kutusu işlemleri ──────────────────────────────────────────────────
  const handleRestoreFirm = async (id: string, name: string) => {
    try {
      await restoreFirm(id);
      setTrashFirms((prev) => prev.filter((f) => f.id !== id));
      // AppContext'teki firms listesini de güncelle
      await refreshFirms();
      showToast(`"${name}" geri yüklendi — Firmalar listesine eklendi`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Geri yükleme başarısız', 'error');
    }
  };

  const handleRestorePersonnel = async (id: string, name: string) => {
    try {
      await restorePersonnel(id);
      setTrashPersonnel((prev) => prev.filter((p) => p.id !== id));
      // AppContext'teki personnel listesini de güncelle
      await refreshPersonnel();
      showToast(`"${name}" geri yüklendi — Personel listesine eklendi`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Geri yükleme başarısız', 'error');
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteConfirm) return;
    try {
      if (hardDeleteConfirm.type === 'firm') {
        await deleteFirm(hardDeleteConfirm.id);
        setTrashFirms((prev) => prev.filter((f) => f.id !== hardDeleteConfirm.id));
        await refreshFirms();
      } else {
        await hardDeletePersonnel(hardDeleteConfirm.id);
        setTrashPersonnel((prev) => prev.filter((p) => p.id !== hardDeleteConfirm.id));
        await refreshPersonnel();
      }
      showToast(`"${hardDeleteConfirm.name}" kalıcı olarak silindi`, 'error');
      setHardDeleteConfirm(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silme başarısız', 'error');
    }
  };

  const errorStyle: React.CSSProperties = { color: 'var(--danger)', fontSize: '11px', marginTop: '4px' };

  const tabs: { key: ActiveTab; label: string; icon: string }[] = [
    { key: 'osgb', label: 'OSGB Bilgileri', icon: 'ri-building-line' },
    { key: 'ekip', label: 'Ekip Yönetimi', icon: 'ri-team-line' },
    { key: 'cop', label: 'Çöp Kutusu', icon: 'ri-delete-bin-line' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Ayarlar" description="OSGB bilgileri, ekip yönetimi ve çöp kutusu" />

      {/* Tab Switcher */}
      <div className="flex items-center rounded-full p-1 mb-4 md:mb-6 w-full md:w-auto overflow-x-auto" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: activeTab === key ? 'var(--card)' : 'transparent',
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
              border: activeTab === key ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            <div className="w-4 h-4 flex items-center justify-center"><i className={`${icon} text-sm`} /></div>
            {label}
          </button>
        ))}
      </div>

      {/* ── OSGB Tab ── */}
      {activeTab === 'osgb' && (
        <div className="max-w-2xl">
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="card-header">
              <div>
                <p className="card-title">OSGB Bilgileri</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Kurum bilgilerini güncelleyin</p>
              </div>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <i className="ri-building-line text-sm" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">OSGB Adı</label>
                <input className="input" placeholder="Örn: Feyzi OSGB" value={osgbForm.name} onChange={(e) => setOsgbForm({ ...osgbForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Vergi No</label>
                  <input className="input" placeholder="0000000000" value={osgbForm.taxNo} onChange={(e) => setOsgbForm({ ...osgbForm, taxNo: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Yetki Belgesi No</label>
                  <input className="input" placeholder="OSGB-0000-00000" value={osgbForm.authorizationNo} onChange={(e) => setOsgbForm({ ...osgbForm, authorizationNo: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Adres</label>
                <textarea className="input resize-none" rows={2} placeholder="Mahalle, cadde, bina no, ilçe/il" value={osgbForm.address} onChange={(e) => setOsgbForm({ ...osgbForm, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Telefon</label>
                  <input className="input" placeholder="0212 000 00 00" value={osgbForm.phone} onChange={(e) => setOsgbForm({ ...osgbForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">E-posta</label>
                  <input className="input" type="email" placeholder="info@osgb.com" value={osgbForm.email} onChange={(e) => setOsgbForm({ ...osgbForm, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Web Sitesi</label>
                <input className="input" placeholder="www.osgb.com" value={osgbForm.website} onChange={(e) => setOsgbForm({ ...osgbForm, website: e.target.value })} />
              </div>
              <div className="pt-2">
                <Button variant="primary" onClick={handleSaveOrg}>
                  {orgSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Ekip Tab ── */}
      {activeTab === 'ekip' && (
        <div className="max-w-3xl">
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="card-header">
              <div>
                <p className="card-title">Ekip Yönetimi</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Sisteme erişim yetkisi olan kullanıcılar</p>
              </div>
              {canManage && (
                <Button variant="primary" size="sm" icon="ri-add-line" onClick={() => setAddUserOpen(true)}>
                  Yeni Kullanıcı
                </Button>
              )}
            </div>

            {!configured && (
              <div className="mx-6 mb-4 p-3 rounded-lg text-xs" style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--warning-text)' }}>
                Demo modunda kullanıcı yönetimi görseldir. Gerçek hesap yönetimi için Supabase bağlayın.
              </div>
            )}

            {membersLoading ? (
              <div className="py-12 text-center"><i className="ri-loader-4-line animate-spin text-xl" style={{ color: 'var(--text-muted)' }} /></div>
            ) : members.length === 0 ? (
              <EmptyState icon="ri-user-line" title="Henüz kullanıcı eklenmedi" description="Sisteme erişim yetkisi verilecek kullanıcıları buradan yönetin." actionLabel={canManage ? 'Kullanıcı Ekle' : undefined} onAction={canManage ? () => setAddUserOpen(true) : undefined} />
            ) : (
              <div>
                {members.map((user) => (
                  <div key={user.id} className="px-6 py-4 flex items-center gap-4 transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {roleMap[user.role] ?? user.role}
                      </span>
                      <StatusBadge status={user.status === 'active' ? 'Aktif' : 'Pasif'} />
                    </div>
                    {canManage && user.role !== 'owner' && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setEditMember(user)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          title="Rol Değiştir"
                        ><i className="ri-edit-line text-sm" /></button>
                        <button onClick={() => handleToggleStatus(user)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = user.status === 'active' ? 'var(--danger)' : 'var(--success)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          title={user.status === 'active' ? 'Pasif Yap' : 'Aktif Et'}
                        ><i className={`text-sm ${user.status === 'active' ? 'ri-user-unfollow-line' : 'ri-user-follow-line'}`} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Çöp Kutusu Tab ── */}
      {activeTab === 'cop' && (
        <div className="max-w-3xl">
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="card-header">
              <div>
                <p className="card-title">Çöp Kutusu</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Silinen firmalar ve personel — geri yükleyebilir veya kalıcı silebilirsiniz</p>
              </div>
              <button onClick={loadTrash} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                <i className="ri-refresh-line text-xs" /> Yenile
              </button>
            </div>

            {/* Alt sekme: Firmalar / Personel */}
            <div className="px-6 pb-0 pt-2">
              <div className="flex gap-1 p-1 rounded-full w-fit" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                {([['firms', 'Firmalar', 'ri-building-2-line'], ['personnel', 'Personel', 'ri-team-line']] as [string, string, string][]).map(([key, label, icon]) => (
                  <button key={key} onClick={() => setTrashTab(key as 'firms' | 'personnel')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: trashTab === key ? 'var(--card)' : 'transparent',
                      color: trashTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: trashTab === key ? '1px solid var(--border)' : '1px solid transparent',
                    }}
                  >
                    <i className={`${icon} text-xs`} />{label}
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {key === 'firms' ? trashFirms.length : trashPersonnel.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {trashLoading ? (
                <div className="py-10 text-center"><i className="ri-loader-4-line animate-spin text-xl" style={{ color: 'var(--text-muted)' }} /></div>
              ) : trashTab === 'firms' ? (
                trashFirms.length === 0 ? (
                  <EmptyState icon="ri-building-2-line" title="Çöp kutusunda firma yok" description="Silinen firmalar burada görünür." />
                ) : (
                  <div className="space-y-2">
                    {trashFirms.map((firm) => (
                      <div key={firm.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                          <i className="ri-building-2-line text-sm" style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{firm.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{firm.sector} · {firm.dangerClass}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleRestoreFirm(firm.id, firm.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.color = 'var(--success)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                          >
                            <i className="ri-arrow-go-back-line text-xs" /> Geri Yükle
                          </button>
                          <button onClick={() => setHardDeleteConfirm({ type: 'firm', id: firm.id, name: firm.name })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', backgroundColor: 'transparent' }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <i className="ri-delete-bin-2-line text-xs" /> Kalıcı Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                trashPersonnel.length === 0 ? (
                  <EmptyState icon="ri-team-line" title="Çöp kutusunda personel yok" description="Silinen personel burada görünür." />
                ) : (
                  <div className="space-y-2">
                    {trashPersonnel.map((person) => (
                      <div key={person.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                          <i className={`text-sm ${person.role === 'doctor' ? 'ri-stethoscope-line' : 'ri-shield-check-line'}`} style={{ color: person.role === 'doctor' ? 'var(--purple)' : 'var(--info)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{person.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{person.role === 'doctor' ? 'Hekim' : 'Uzman'} · {person.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleRestorePersonnel(person.id, person.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.color = 'var(--success)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                          >
                            <i className="ri-arrow-go-back-line text-xs" /> Geri Yükle
                          </button>
                          <button onClick={() => setHardDeleteConfirm({ type: 'personnel', id: person.id, name: person.name })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', backgroundColor: 'transparent' }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <i className="ri-delete-bin-2-line text-xs" /> Kalıcı Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Kalıcı Silme Onay Modalı ── */}
      {hardDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="rounded-xl p-6 w-[380px]" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-full mb-4" style={{ backgroundColor: 'var(--danger-bg)' }}>
              <i className="ri-error-warning-line text-lg" style={{ color: 'var(--danger)' }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Kalıcı olarak silinecek!</p>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              <strong>"{hardDeleteConfirm.name}"</strong> veritabanından tamamen silinecek.
            </p>
            <p className="text-xs mb-4 font-medium" style={{ color: 'var(--danger)' }}>
              Bu işlem geri alınamaz. Emin misiniz?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setHardDeleteConfirm(null)}
                className="flex-1 py-2 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                İptal
              </button>
              <button onClick={handleHardDelete}
                className="flex-1 py-2 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>
                Evet, Kalıcı Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rol Değiştir Drawer ── */}
      <Drawer open={!!editMember} onClose={() => setEditMember(null)} title="Rol Değiştir" width="w-[380px]"
        footer={<Button variant="secondary" className="flex-1" onClick={() => setEditMember(null)}>Kapat</Button>}
      >
        {editMember && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-9 h-9 flex items-center justify-center rounded-full" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {editMember.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{editMember.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{editMember.email}</p>
              </div>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Yeni Rol Seçin</p>
            <div className="space-y-2">
              {(['admin', 'specialist', 'doctor'] as MemberRole[]).map((r) => (
                <button key={r} onClick={() => handleChangeRole(editMember, r)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors cursor-pointer"
                  style={{ border: `1px solid ${editMember.role === r ? 'var(--text-primary)' : 'var(--border)'}`, backgroundColor: editMember.role === r ? 'var(--text-primary)' : 'transparent', color: editMember.role === r ? 'var(--card)' : 'var(--text-secondary)' }}
                >
                  <span className="text-sm font-medium">{roleMap[r]}</span>
                  {editMember.role === r && <i className="ri-check-line text-sm" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Yeni Kullanıcı Drawer ── */}
      <Drawer
        open={addUserOpen}
        onClose={() => { setAddUserOpen(false); setUserErrors({}); setNewUser({ name: '', role: 'specialist', email: '', phone: '', password: '', specializationClass: 'A' }); }}
        title="Yeni Personel Ekle"
        width="w-[440px]"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => { setAddUserOpen(false); setUserErrors({}); }}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleSaveUser}>
              {userSaving ? 'Oluşturuluyor...' : 'Hesap Oluştur'}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="form-label">Hesap Türü *</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'specialist', label: 'Uzman', icon: 'ri-shield-check-line', desc: 'İş güvenliği uzmanı' },
                { value: 'doctor', label: 'Hekim', icon: 'ri-stethoscope-line', desc: 'İş hekimi' },
              ] as { value: 'specialist' | 'doctor'; label: string; icon: string; desc: string }[]).map((r) => (
                <button key={r.value} onClick={() => setNewUser({ ...newUser, role: r.value })}
                  className="p-3 rounded-lg text-left transition-colors cursor-pointer"
                  style={{ border: `1px solid ${newUser.role === r.value ? 'var(--text-primary)' : 'var(--border)'}`, backgroundColor: newUser.role === r.value ? 'var(--text-primary)' : 'transparent' }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <i className={`${r.icon} text-sm`} style={{ color: newUser.role === r.value ? 'var(--card)' : 'var(--text-muted)' }} />
                    <span className="text-sm font-semibold" style={{ color: newUser.role === r.value ? 'var(--card)' : 'var(--text-primary)' }}>{r.label}</span>
                  </div>
                  <p className="text-xs" style={{ color: newUser.role === r.value ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)' }}>{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {newUser.role === 'specialist' && (
            <div>
              <label className="form-label">Uzmanlık Sınıfı *</label>
              <div className="grid grid-cols-4 gap-2">
                {(['A', 'B', 'C', 'Tekniker'] as SpecializationClass[]).map((cls) => (
                  <button key={cls} onClick={() => setNewUser({ ...newUser, specializationClass: cls })}
                    className="py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    style={{ border: `1px solid ${newUser.specializationClass === cls ? 'var(--text-primary)' : 'var(--border)'}`, backgroundColor: newUser.specializationClass === cls ? 'var(--text-primary)' : 'transparent', color: newUser.specializationClass === cls ? 'var(--card)' : 'var(--text-secondary)' }}
                  >{cls}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Ad Soyad *</label>
            <input className="input" placeholder="Ad Soyad" value={newUser.name}
              onChange={(e) => { setNewUser({ ...newUser, name: e.target.value }); if (userErrors.name) setUserErrors({ ...userErrors, name: '' }); }}
              style={userErrors.name ? { borderColor: 'var(--danger)' } : {}} />
            {userErrors.name && <p style={errorStyle}>{userErrors.name}</p>}
          </div>
          <div>
            <label className="form-label">E-posta *</label>
            <input className="input" type="email" placeholder="kullanici@osgb.com" value={newUser.email}
              onChange={(e) => { setNewUser({ ...newUser, email: e.target.value }); if (userErrors.email) setUserErrors({ ...userErrors, email: '' }); }}
              style={userErrors.email ? { borderColor: 'var(--danger)' } : {}} />
            {userErrors.email && <p style={errorStyle}>{userErrors.email}</p>}
          </div>
          <div>
            <label className="form-label">Telefon</label>
            <input className="input" placeholder="0532 000 00 00" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Şifre *</label>
            <input className="input" type="password" placeholder="En az 8 karakter" value={newUser.password}
              onChange={(e) => { setNewUser({ ...newUser, password: e.target.value }); if (userErrors.password) setUserErrors({ ...userErrors, password: '' }); }}
              style={userErrors.password ? { borderColor: 'var(--danger)' } : {}} />
            {userErrors.password && <p style={errorStyle}>{userErrors.password}</p>}
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-start gap-2">
              <i className="ri-information-line text-sm mt-0.5" style={{ color: 'var(--info)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Oluşturulan hesap, login ekranından giriş yaparak {newUser.role === 'specialist' ? 'uzman paneline' : 'hekim paneline'} yönlendirilecek.
              </p>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
