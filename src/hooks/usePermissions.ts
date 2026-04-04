import { useApp } from '@/store/AppContext';

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isReadOnly: boolean;
  role: string;
}

/**
 * Returns the current user's permission flags based on their org role.
 * - admin    → full access (create, edit, delete)
 * - member   → create + edit, NO delete
 * - denetci  → read-only (no create/edit/delete)
 */
export function usePermissions(): Permissions {
  const { org } = useApp();
  const role = (org?.role ?? 'member').toLowerCase();

  const isAdmin    = role === 'admin';
  const isReadOnly = role === 'denetci';

  return {
    canCreate: !isReadOnly,
    canEdit:   !isReadOnly,
    canDelete: isAdmin,          // sadece admin silebilir
    isReadOnly,
    role: org?.role ?? 'member',
  };
}
