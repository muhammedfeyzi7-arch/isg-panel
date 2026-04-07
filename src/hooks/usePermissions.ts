import { useApp } from '@/store/AppContext';

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isReadOnly: boolean;
  role: string;
  canAccessSettings: boolean;
  canAccessModule: (moduleId: string) => boolean;
  canViewSensitiveData: boolean;
}

// Saha Personeli (denetci) için izin verilen modüller
const DENETCI_ALLOWED_MODULES = new Set([
  'dashboard', 'firmalar', 'personeller',
  'ekipmanlar', 'uygunsuzluklar',
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
 *   - create + edit yapabilir
 *   - delete yok
 *   - Hassas verileri görebilir
 *
 * DENETCI (Saha Personeli):
 *   - Sadece: dashboard, firmalar, personeller, ekipmanlar, uygunsuzluklar
 *   - Uygunsuzluk açabilir + kapatabilir
 *   - Veri ekleyemez (uygunsuzluk hariç)
 *   - Hassas verileri (TC, iletişim) göremez
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
    canCreate: isAdmin || isMember,
    canEdit: isAdmin || isMember,
    canDelete: isAdmin,
    isReadOnly: isDenetci,
    role: org?.role ?? 'member',
    canAccessSettings: isAdmin,
    canAccessModule,
    canViewSensitiveData: !isDenetci,
  };
}
