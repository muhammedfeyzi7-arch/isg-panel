import Drawer from '@/components/base/Drawer';
import StatusBadge from '@/components/base/StatusBadge';
import Button from '@/components/base/Button';
import type { AppPersonnel } from '@/types/database';

interface PersonnelDrawerProps {
  open: boolean;
  onClose: () => void;
  person: AppPersonnel | null;
}

const roleLabel: Record<string, string> = {
  specialist: 'Uzman', doctor: 'Hekim', admin: 'Yönetici', owner: 'Sahip',
};

export default function PersonnelDrawer({ open, onClose, person }: PersonnelDrawerProps) {
  if (!person) return null;

  const roleIcon = person.role === 'doctor' ? 'ri-stethoscope-line' : 'ri-shield-check-line';
  const roleColor = person.role === 'doctor' ? 'var(--purple)' : 'var(--info)';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Personel Profili"
      width="w-[480px]"
      footer={
        <Button variant="secondary" className="flex-1" onClick={onClose}>Kapat</Button>
      }
    >
      <div className="p-6 space-y-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <i className={`text-2xl ${roleIcon}`} style={{ color: roleColor }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{person.name}</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{person.specialization}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge status={roleLabel[person.role] ?? person.role} />
              <StatusBadge status={person.status === 'active' ? 'Aktif' : 'Pasif'} />
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div>
          <p className="drawer-section-title">Temel Bilgiler</p>
          <div className="space-y-2">
            {[
              { label: 'Telefon', value: person.phone, icon: 'ri-phone-line' },
              { label: 'E-posta', value: person.email, icon: 'ri-mail-line' },
              ...(person.role === 'specialist' && person.specializationClass
                ? [{ label: 'Uzmanlık Sınıfı', value: `Sınıf ${person.specializationClass}`, icon: 'ri-award-line' }]
                : []),
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div
                  className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <i className={`${item.icon} text-sm`} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned Firms */}
        <div>
          <p className="drawer-section-title">Atanmış Firmalar ({person.assignedFirmList.length})</p>
          {person.assignedFirmList.length === 0 ? (
            <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Henüz firma atanmamış</p>
          ) : (
            <div className="space-y-1.5">
              {person.assignedFirmList.map((firm) => (
                <div
                  key={firm}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
                >
                  <i className="ri-building-2-line text-sm" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firm}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Visits */}
        <div>
          <p className="drawer-section-title">Son Ziyaretler</p>
          {person.recentVisits.length === 0 ? (
            <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Henüz ziyaret kaydı yok</p>
          ) : (
            <div className="space-y-2">
              {person.recentVisits.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v.firm}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.date}</p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-md"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                  >
                    {v.duration}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info note */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Kullanıcı yönetimi (rol değiştirme, aktif/pasif yapma) için <strong>Ayarlar &gt; Ekip</strong> bölümünü kullanın.
          </p>
        </div>
      </div>
    </Drawer>
  );
}
