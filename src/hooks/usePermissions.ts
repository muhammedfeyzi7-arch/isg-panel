import { useApp } from '@/store/AppContext';

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isReadOnly: boolean;
  isDenetci: boolean;
  role: string;
  canAccessSettings: boolean;
  canAccessModule: (moduleId: string) => boolean;
  canViewSensitiveData: boolean;
}

// Saha Personeli (denetci) için izin verilen modüller
const DENETCI_ALLOWED_MODULES = new Set([
  'dashboard', 'firmalar', 'personeller',
  'ekipmanlar', 'uygunsuzluklar', 'saha', 'is-izinleri',
]);

// Evrak/Dökümantasyon Denetçi (member) için yasak modüller
const MEMBER_BLOCKED_MODULES = new Set(['ayarlar']);

/**
 * Returns the current user's permission flags based on their org role.
 *
 * ADMIN (Admin Kullanıcı):
 *   - Tam yetki, kısıtlama yok
 *
 * MEMBER (Evrak/Dökümantasyon Denetçi):
 *   - Tüm modüllere erişebilir (ayarlar hariç)
 *   - create + edit + delete yapabilir
 *   - Hassas verileri görebilir
 *
 * DENETCI (Saha Personeli):
 *   - Sadece: dashboard, firmalar, personeller, ekipmanlar, uygunsuzluklar, saha
 *   - Kendi modüllerinde tam yetki (create + edit + delete)
 *   - Ayarlara erişemez
 */
export function usePermissions(): Permissions {
  const { org } = useApp();
  const role = (org?.role ?? 'member').toLowerCase();

  const isAdmin   = role === 'admin';
  const isMember  = role === 'member';
  const isDenetci = role === 'denetci';

  const canAccessModule = (moduleId: string): boolean => {
    if (isAdmin) return true;
    if (isDenetci) return DENETCI_ALLOWED_MODULES.has(moduleId);
    if (isMember) return !MEMBER_BLOCKED_MODULES.has(moduleId);
    return true;
  };

  return {
    // Denetçi sadece değerlendirme yapabilir, create/edit/delete yapamaz
    canCreate: isAdmin || isMember,
    canEdit:   isAdmin || isMember,
    canDelete: isAdmin || isMember,
    // Denetçi salt okunur (is-izni değerlendirme hariç)
    isReadOnly: isDenetci,
    isDenetci,
    role: org?.role ?? 'member',
    canAccessSettings: isAdmin,
    canAccessModule,
    canViewSensitiveData: !isDenetci,
  };
}
