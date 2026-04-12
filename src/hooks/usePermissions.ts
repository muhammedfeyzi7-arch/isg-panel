import { useApp } from '@/store/AppContext';

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isReadOnly: boolean;
  isDenetci: boolean;
  isGeziciUzman: boolean;
  role: string;
  canAccessSettings: boolean;
  canAccessModule: (moduleId: string) => boolean;
  canViewSensitiveData: boolean;
  /** Firma ekleyip düzenleyip silebilir mi? Gezici uzman için false. */
  canManageFirma: boolean;
}

// Saha Personeli (denetci) için izin verilen modüller
const DENETCI_ALLOWED_MODULES = new Set([
  'dashboard', 'firmalar', 'personeller',
  'ekipmanlar', 'uygunsuzluklar', 'saha', 'is-izinleri',
]);

// Evrak/Dökümantasyon Denetçi (member) için yasak modüller
const MEMBER_BLOCKED_MODULES = new Set(['ayarlar']);

// firma_user için izin verilen modüller
const FIRMA_USER_ALLOWED_MODULES = new Set([
  'dashboard', 'personeller', 'evraklar', 'egitimler', 'uygunsuzluklar',
]);

/**
 * Returns the current user's permission flags based on their org role.
 *
 * ADMIN: Tam yetki
 * MEMBER: Tüm modüller (ayarlar hariç), tam yetki
 * DENETCI: Saha modülleri, tam yetki
 * FIRMA_USER: Sadece kendi firması, sınırlı modüller, ayarlar/kullanıcı yönetimi yok
 */
export function usePermissions(): Permissions {
  const { org } = useApp();
  const role = (org?.role ?? 'member').toLowerCase();
  const isGeziciUzman = org?.osgbRole === 'gezici_uzman';

  const isAdmin     = role === 'admin';
  const isMember    = role === 'member';
  const isDenetci   = role === 'denetci';
  const isFirmaUser = role === 'firma_user';

  const canAccessModule = (moduleId: string): boolean => {
    if (isAdmin) return true;
    if (isDenetci) return DENETCI_ALLOWED_MODULES.has(moduleId);
    if (isMember) return !MEMBER_BLOCKED_MODULES.has(moduleId);
    if (isFirmaUser) return FIRMA_USER_ALLOWED_MODULES.has(moduleId);
    return true;
  };

  // Gezici uzman → firma yönetimi (ekle/düzenle/sil) dışında tam yetkili
  return {
    canCreate: isAdmin || isMember || isFirmaUser || isGeziciUzman,
    canEdit:   isAdmin || isMember || isFirmaUser || isGeziciUzman,
    canDelete: isAdmin || isMember || isGeziciUzman,
    isReadOnly: isDenetci,
    isDenetci,
    isGeziciUzman,
    role: org?.role ?? 'member',
    canAccessSettings: isAdmin,
    canAccessModule,
    canViewSensitiveData: !isDenetci,
    // Firma ekle/düzenle/sil: sadece admin, member, firma_user
    // Gezici uzman ve işyeri hekimi firmalar üzerinde yönetim yapamaz
    canManageFirma: isAdmin || isMember || isFirmaUser,
  };
}
