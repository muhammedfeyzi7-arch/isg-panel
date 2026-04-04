import { useApp } from '@/store/AppContext';

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isReadOnly: boolean;
  role: string;
  // Modül erişim izinleri
  canAccessSettings: boolean;
  canAccessModule: (moduleId: string) => boolean;
  // Hassas veri görünürlüğü
  canViewSensitiveData: boolean;
}

// Denetçi için izin verilen modüller
const DENETCI_ALLOWED_MODULES = new Set([
  'dashboard', 'firmalar', 'personeller',
  'ekipmanlar', 'uygunsuzluklar',
]);

// Member için yasak modüller
const MEMBER_BLOCKED_MODULES = new Set(['ayarlar']);

/**
 * Returns the current user's permission flags based on their org role.
 *
 * ADMIN:
 *   - Full access, no restrictions
 *
 * MEMBER (evrakçı):
 *   - Tüm modüllere erişebilir (ayarlar hariç)
 *   - create + edit yapabilir
 *   - delete yok
 *   - Hassas verileri görebilir
 *
 * DENETCI (sahacı):
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
    // Oluşturma: admin + member yapabilir, denetci sadece uygunsuzluk (sayfada özel kontrol)
    canCreate: isAdmin || isMember,
    // Düzenleme: admin + member yapabilir
    canEdit: isAdmin || isMember,
    // Silme: sadece admin
    canDelete: isAdmin,
    // Salt okunur: denetci
    isReadOnly: isDenetci,
    role: org?.role ?? 'member',
    // Ayarlar erişimi: sadece admin
    canAccessSettings: isAdmin,
    // Modül erişim kontrolü
    canAccessModule,
    // Hassas veri (TC, telefon, adres): denetci göremez
    canViewSensitiveData: !isDenetci,
  };
}
