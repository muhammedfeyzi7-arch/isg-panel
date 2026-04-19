import { supabase } from '@/lib/supabase';
import { logActivity } from '@/services/activityLogService';
import type { AppPersonnel, ProfileRow } from '@/types/database';

function toAppPersonnel(row: ProfileRow, assignedFirms = 0, assignedFirmList: string[] = []): AppPersonnel {
  let specialization = 'İş Güvenliği Uzmanı';
  if (row.role === 'doctor') {
    specialization = 'İş Hekimi';
  } else if (row.role === 'specialist' && row.specialization_class) {
    specialization = `Sınıf ${row.specialization_class} Uzmanı`;
  }

  return {
    id: row.id,
    name: row.full_name,
    role: row.role,
    phone: row.phone ?? '—',
    email: row.email,
    specialization,
    specializationClass: row.specialization_class ?? null,
    certNo: '—',
    assignedFirms,
    status: row.status,
    assignedFirmList,
    recentVisits: [],
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Org'daki aktif (deleted_at null) specialist + doctor listesi */
export async function getPersonnel(organizationId: string): Promise<AppPersonnel[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, firm_assignments(firm:firms(id, name, deleted_at))')
    .eq('organization_id', organizationId)
    .in('role', ['specialist', 'doctor'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const assignments = (r.firm_assignments ?? []) as { firm: { id: string; name: string; deleted_at: string | null } | null }[];
    const firmList = assignments
      .map((a) => a.firm)
      .filter((f): f is { id: string; name: string; deleted_at: string | null } => !!f && !f.deleted_at)
      .map((f) => f.name);
    return toAppPersonnel(r, firmList.length, firmList);
  });
}

export async function getProfile(userId: string): Promise<AppPersonnel | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return toAppPersonnel(data);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updatePersonnel(id: string, payload: Partial<AppPersonnel>): Promise<AppPersonnel> {
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.full_name = payload.name;
  if (payload.phone !== undefined) update.phone = payload.phone;
  if (payload.email !== undefined) update.email = payload.email;
  if (payload.status !== undefined) update.status = payload.status;

  const { data, error } = await supabase.from('profiles').update(update).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Profil bulunamadı');
  return toAppPersonnel(data);
}

export async function deactivatePersonnel(id: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ status: 'passive' }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Soft delete — çöp kutusuna taşı */
export async function softDeletePersonnel(
  id: string,
  userId?: string,
  organizationId?: string
): Promise<void> {
  const { error } = await supabase.from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  if (userId && organizationId) {
    await logActivity({ organizationId, userId, action: 'user_deleted', entityType: 'profile', entityId: id });
  }
}

/** Kalıcı sil — sadece admin */
export async function hardDeletePersonnel(id: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Çöp kutusundaki personeli listele */
export async function getDeletedPersonnel(organizationId: string): Promise<AppPersonnel[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .in('role', ['specialist', 'doctor'])
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toAppPersonnel(r));
}

/** Çöp kutusundan geri yükle */
export async function restorePersonnel(
  id: string,
  userId?: string,
  organizationId?: string
): Promise<void> {
  const { error } = await supabase.from('profiles').update({ deleted_at: null }).eq('id', id);
  if (error) throw new Error(error.message);
  if (userId && organizationId) {
    await logActivity({ organizationId, userId, action: 'user_restored', entityType: 'profile', entityId: id });
  }
}
