import { supabase } from '@/lib/supabase';
import { logActivity } from '@/services/activityLogService';
import type { AppFirm, FirmRow, HazardClass, ContractStatus, VerificationType } from '@/types/database';

function toAppFirm(row: FirmRow, lastVisit = '—'): AppFirm {
  return {
    id: row.id,
    name: row.name,
    contact: row.authorized_person ?? '—',
    phone: row.phone ?? '—',
    email: row.email ?? '—',
    sector: row.sector ?? 'Diğer',
    employeeCount: row.employee_count,
    dangerClass: row.hazard_class,
    contractStatus: row.contract_status,
    contractStart: row.contract_start ?? '—',
    contractEnd: row.contract_end ?? '—',
    address: row.address ?? '—',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    status: row.status,
    lastVisit,
    verificationType: (row.verification_type as VerificationType) ?? 'qr',
    qrToken: row.qr_token ?? null,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getFirms(organizationId: string): Promise<AppFirm[]> {
  const { data, error } = await supabase
    .from('firms')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toAppFirm(r));
}

export async function getAssignedFirms(personnelId: string): Promise<AppFirm[]> {
  const { data, error } = await supabase
    .from('firm_assignments')
    .select('firm:firms(*)')
    .eq('personnel_id', personnelId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => r.firm as FirmRow | null)
    .filter((f): f is FirmRow => f !== null && f.deleted_at === null)
    .map((f) => toAppFirm(f));
}

export async function getFirmByQrToken(qrToken: string): Promise<AppFirm | null> {
  const { data, error } = await supabase
    .from('firms')
    .select('*')
    .eq('qr_token', qrToken)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return toAppFirm(data);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createFirm(
  organizationId: string,
  payload: {
    name: string; contact: string; phone: string; email: string;
    sector: string; employeeCount: number; dangerClass: HazardClass;
    contractStart: string; contractEnd: string; address: string;
    latitude?: number | null; longitude?: number | null;
    verificationType?: VerificationType;
    createdBy?: string;
  }
): Promise<AppFirm> {
  const qrToken = crypto.randomUUID();
  const { data, error } = await supabase
    .from('firms')
    .insert({
      organization_id: organizationId,
      name: payload.name,
      authorized_person: payload.contact || null,
      phone: payload.phone || null,
      email: payload.email || null,
      sector: payload.sector || null,
      employee_count: payload.employeeCount,
      hazard_class: payload.dangerClass,
      contract_status: 'Aktif' as ContractStatus,
      contract_start: payload.contractStart || null,
      contract_end: payload.contractEnd || null,
      address: payload.address || null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      status: 'Aktif',
      verification_type: payload.verificationType ?? 'qr',
      qr_token: qrToken,
    })
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Firma oluşturulamadı');

  if (payload.createdBy) {
    await logActivity({
      organizationId,
      userId: payload.createdBy,
      action: 'firm_created',
      entityType: 'firm',
      entityId: data.id,
      meta: { name: data.name },
    });
  }

  return toAppFirm(data);
}

export async function updateFirm(id: string, payload: Partial<AppFirm>): Promise<AppFirm> {
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.contact !== undefined) update.authorized_person = payload.contact;
  if (payload.phone !== undefined) update.phone = payload.phone;
  if (payload.email !== undefined) update.email = payload.email;
  if (payload.sector !== undefined) update.sector = payload.sector;
  if (payload.employeeCount !== undefined) update.employee_count = payload.employeeCount;
  if (payload.dangerClass !== undefined) update.hazard_class = payload.dangerClass;
  if (payload.contractStatus !== undefined) update.contract_status = payload.contractStatus;
  if (payload.contractStart !== undefined) update.contract_start = payload.contractStart;
  if (payload.contractEnd !== undefined) update.contract_end = payload.contractEnd;
  if (payload.address !== undefined) update.address = payload.address;
  if (payload.latitude !== undefined) update.latitude = payload.latitude;
  if (payload.longitude !== undefined) update.longitude = payload.longitude;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.verificationType !== undefined) update.verification_type = payload.verificationType;

  const { data, error } = await supabase.from('firms').update(update).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Firma bulunamadı');
  return toAppFirm(data);
}

export async function softDeleteFirm(id: string, userId?: string, organizationId?: string): Promise<void> {
  const { error } = await supabase.from('firms').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  if (userId && organizationId) {
    await logActivity({ organizationId, userId, action: 'firm_deleted', entityType: 'firm', entityId: id });
  }
}

export async function deleteFirm(id: string): Promise<void> {
  const { error } = await supabase.from('firms').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getDeletedFirms(organizationId: string): Promise<AppFirm[]> {
  const { data, error } = await supabase
    .from('firms')
    .select('*')
    .eq('organization_id', organizationId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toAppFirm(r));
}

export async function restoreFirm(id: string, userId?: string, organizationId?: string): Promise<void> {
  const { error } = await supabase.from('firms').update({ deleted_at: null }).eq('id', id);
  if (error) throw new Error(error.message);
  if (userId && organizationId) {
    await logActivity({ organizationId, userId, action: 'firm_restored', entityType: 'firm', entityId: id });
  }
}

// ─── Firm Assignments ─────────────────────────────────────────────────────────

export async function assignPersonnelToFirm(
  organizationId: string,
  firmId: string,
  personnelId: string,
  assignedBy?: string
): Promise<void> {
  const { error } = await supabase.from('firm_assignments').insert({
    organization_id: organizationId,
    firm_id: firmId,
    personnel_id: personnelId,
  });
  // Unique constraint ihlali — zaten atanmış
  if (error) {
    if (error.code === '23505') throw new Error('Bu personel zaten bu firmaya atanmış.');
    throw new Error(error.message);
  }
  if (assignedBy) {
    await logActivity({
      organizationId,
      userId: assignedBy,
      action: 'firm_assigned',
      entityType: 'firm_assignment',
      entityId: firmId,
      meta: { personnelId },
    });
  }
}

export async function removeAssignment(
  firmId: string,
  personnelId: string,
  removedBy?: string,
  organizationId?: string
): Promise<void> {
  const { error } = await supabase.from('firm_assignments')
    .delete().eq('firm_id', firmId).eq('personnel_id', personnelId);
  if (error) throw new Error(error.message);
  if (removedBy && organizationId) {
    await logActivity({
      organizationId,
      userId: removedBy,
      action: 'firm_unassigned',
      entityType: 'firm_assignment',
      entityId: firmId,
      meta: { personnelId },
    });
  }
}

export async function getFirmAssignments(firmId: string) {
  const { data, error } = await supabase
    .from('firm_assignments')
    .select('*, personnel:profiles(id, full_name, role, status, email, phone, deleted_at)')
    .eq('firm_id', firmId);
  if (error) throw new Error(error.message);
  // Soft-deleted personeli filtrele
  return (data ?? []).filter((a) => {
    const p = a.personnel as { deleted_at: string | null } | null;
    return !p?.deleted_at;
  });
}

export async function getOrgAssignments(organizationId: string) {
  const { data, error } = await supabase
    .from('firm_assignments')
    .select('*, firm:firms(name), personnel:profiles(full_name, role, deleted_at)')
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((a) => {
    const p = a.personnel as { deleted_at: string | null } | null;
    return !p?.deleted_at;
  });
}
