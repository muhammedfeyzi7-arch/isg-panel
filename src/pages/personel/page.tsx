import { useState, useMemo } from 'react';
import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import PersonnelDrawer from './components/PersonnelDrawer';
import { AppPersonnel } from '@/types/database';
import { useApp } from '@/store/AppContext';

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  cursor: 'pointer',
};

const roleLabel: Record<string, string> = {
  specialist: 'Uzman', doctor: 'Hekim', admin: 'Yönetici', owner: 'Sahip',
};

export default function PersonelPage() {
  const { personnel, softDeletePersonnel, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<AppPersonnel | null>(null);
  const [trashConfirm, setTrashConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleSoftDelete = async (id: string) => {
    try {
      await softDeletePersonnel(id);
      showToast('Personel çöp kutusuna taşındı');
      setTrashConfirm(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silme başarısız', 'error');
    }
  };

  const filtered = useMemo(() => {
    return personnel.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !search || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      const matchRole = !roleFilter || p.role === roleFilter;
      const matchStatus = !statusFilter || p.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [personnel, search, roleFilter, statusFilter]);

  const hasFilters = search || roleFilter || statusFilter;
  const currentSelectedPerson = selectedPerson
    ? personnel.find((p) => p.id === selectedPerson.id) || null
    : null;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Personel"
        description="Uzman ve hekim listesi — kullanıcı yönetimi için Ayarlar &gt; Ekip bölümünü kullanın"
      />

      {personnel.length > 0 && (
        <div className="filter-bar flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <i className="ri-search-line text-sm" />
            </div>
            <input
              type="text"
              placeholder="İsim veya e-posta ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none transition-colors"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <select style={selectStyle} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Tüm Roller</option>
            <option value="doctor">Hekim</option>
            <option value="specialist">Uzman</option>
          </select>
          <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}
              className="text-xs cursor-pointer whitespace-nowrap transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Temizle
            </button>
          )}
        </div>
      )}

      {/* Desktop Table */}
      <div className="table-wrap hidden md:block">
        {personnel.length === 0 ? (
          <EmptyState
            icon="ri-team-line"
            title="Henüz personel eklenmedi"
            description="Ayarlar &gt; Ekip bölümünden uzman ve hekim hesapları oluşturabilirsiniz."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="ri-search-line"
            title="Sonuç bulunamadı"
            description="Arama veya filtre kriterlerinizi değiştirmeyi deneyin."
            actionLabel="Filtreleri Temizle"
            onAction={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}
          />
        ) : (
          <table className="w-full">
            <thead className="table-head">
              <tr>
                {['Ad Soyad', 'Rol', 'Telefon', 'E-posta', 'Durum', ''].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr key={person.id} className="table-row" onClick={() => setSelectedPerson(person)}>
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className={`text-sm ${person.role === 'doctor' ? 'ri-stethoscope-line' : 'ri-shield-check-line'}`} style={{ color: person.role === 'doctor' ? 'var(--purple)' : 'var(--info)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{person.name}</p>
                        {person.role === 'specialist' && person.specializationClass ? (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded mt-0.5" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid rgba(14,165,233,0.2)' }}>
                            <i className="ri-shield-check-line text-xs" />
                            Sınıf {person.specializationClass}
                          </span>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{person.specialization}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell"><StatusBadge status={roleLabel[person.role] ?? person.role} /></td>
                  <td className="table-cell whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{person.phone}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{person.email}</td>
                  <td className="table-cell"><StatusBadge status={person.status} /></td>
                  <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPerson(person); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Detay"
                      >
                        <i className="ri-eye-line text-sm" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setTrashConfirm({ id: person.id, name: person.name }); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Çöp Kutusuna Taşı"
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-2 mt-2">
        {personnel.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState icon="ri-team-line" title="Henüz personel eklenmedi" description="Ayarlar &gt; Ekip bölümünden uzman ve hekim hesapları oluşturabilirsiniz." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState icon="ri-search-line" title="Sonuç bulunamadı" description="Filtre kriterlerinizi değiştirmeyi deneyin." actionLabel="Temizle" onAction={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }} />
          </div>
        ) : (
          filtered.map((person) => (
            <button
              key={person.id}
              onClick={() => setSelectedPerson(person)}
              className="w-full text-left rounded-xl p-4 transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <i className={`text-base ${person.role === 'doctor' ? 'ri-stethoscope-line' : 'ri-shield-check-line'}`} style={{ color: person.role === 'doctor' ? 'var(--purple)' : 'var(--info)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{person.name}</p>
                    <StatusBadge status={person.status} />
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{person.email}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={roleLabel[person.role] ?? person.role} />
                    {person.role === 'specialist' && person.specializationClass && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        Sınıf {person.specializationClass}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{person.phone}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setTrashConfirm({ id: person.id, name: person.name }); }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                  style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-bg)' }}
                >
                  <i className="ri-delete-bin-line text-xs" /> Sil
                </button>
              </div>
            </button>
          ))
        )}
      </div>

      <PersonnelDrawer
        open={!!currentSelectedPerson}
        onClose={() => setSelectedPerson(null)}
        person={currentSelectedPerson}
      />

      {/* Çöp Kutusu Onay Modalı */}
      {trashConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-xl p-6 w-[360px]" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-full mb-4" style={{ backgroundColor: 'var(--danger-bg)' }}>
              <i className="ri-delete-bin-line text-lg" style={{ color: 'var(--danger)' }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Personeli çöp kutusuna taşı</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              <strong>"{trashConfirm.name}"</strong> çöp kutusuna taşınacak. Ayarlar &gt; Çöp Kutusu bölümünden geri yükleyebilir veya kalıcı olarak silebilirsiniz.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setTrashConfirm(null)}
                className="flex-1 py-2 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                İptal
              </button>
              <button onClick={() => handleSoftDelete(trashConfirm.id)}
                className="flex-1 py-2 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>
                Çöp Kutusuna Taşı
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
