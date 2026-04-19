import { supabase } from '@/lib/supabase';

export interface FirmWorker {
  id: string;
  organizationId: string;
  firmId: string;
  firmName?: string;
  fullName: string;
  tcNo: string | null;
  phone: string | null;
  birthDate: string | null;
  workStatus: string;
  jobTitle: string | null;
  startDate: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface CreateFirmWorkerPayload {
  organizationId: string;
  firmId: string;
  fullName: string;
  tcNo?: string;
  phone?: string;
  birthDate?: string;
  workStatus?: string;
  jobTitle?: string;
  startDate?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  createdBy?: string;
}

function toFirmWorker(row: Record<string, unknown>, firmName?: string): FirmWorker {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    firmId: row.firm_id as string,
    firmName,
    fullName: row.full_name as string,
    tcNo: (row.tc_no as string) ?? null,
    phone: (row.phone as string) ?? null,
    birthDate: (row.birth_date as string) ?? null,
    workStatus: (row.work_status as string) ?? 'active',
    jobTitle: (row.job_title as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    emergencyContact: (row.emergency_contact as string) ?? null,
    emergencyPhone: (row.emergency_phone as string) ?? null,
    deletedAt: (row.deleted_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Org'daki tüm aktif çalışanları getir (firma adıyla birlikte) */
export async function getFirmWorkers(organizationId: string): Promise<FirmWorker[]> {
  const { data, error } = await supabase
    .from('firm_workers')
    .select('*, firm:firms(id, name)')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const firm = r.firm as { id: string; name: string } | null;
    return toFirmWorker(r, firm?.name ?? '—');
  });
}

/** Belirli bir firmaya ait çalışanları getir */
export async function getWorkersByFirm(firmId: string): Promise<FirmWorker[]> {
  const { data, error } = await supabase
    .from('firm_workers')
    .select('*')
    .eq('firm_id', firmId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toFirmWorker(r));
}

/** Uzman'ın atanmış firmalarındaki çalışanları getir */
export async function getWorkersForSpecialist(specialistId: string): Promise<FirmWorker[]> {
  // Önce atanmış firma id'lerini al
  const { data: assignments, error: aErr } = await supabase
    .from('firm_assignments')
    .select('firm_id, firm:firms(id, name)')
    .eq('personnel_id', specialistId);
  if (aErr) throw new Error(aErr.message);

  const firmIds = (assignments ?? []).map((a) => a.firm_id as string);
  if (firmIds.length === 0) return [];

  const firmNameMap: Record<string, string> = {};
  (assignments ?? []).forEach((a) => {
    const f = a.firm as { id: string; name: string } | null;
    if (f) firmNameMap[f.id] = f.name;
  });

  const { data, error } = await supabase
    .from('firm_workers')
    .select('*')
    .in('firm_id', firmIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => toFirmWorker(r, firmNameMap[r.firm_id as string] ?? '—'));
}

/** Hekim'in atanmış firmalarındaki çalışanları getir */
export async function getWorkersForDoctor(doctorId: string): Promise<FirmWorker[]> {
  // Hekimin atandığı firmalar: aynı org'daki uzmanların atandığı firmalar değil,
  // doğrudan firm_assignments'taki doctor atamaları
  const { data: assignments, error: aErr } = await supabase
    .from('firm_assignments')
    .select('firm_id, firm:firms(id, name)')
    .eq('personnel_id', doctorId);
  if (aErr) throw new Error(aErr.message);

  const firmIds = (assignments ?? []).map((a) => a.firm_id as string);
  if (firmIds.length === 0) return [];

  const firmNameMap: Record<string, string> = {};
  (assignments ?? []).forEach((a) => {
    const f = a.firm as { id: string; name: string } | null;
    if (f) firmNameMap[f.id] = f.name;
  });

  const { data, error } = await supabase
    .from('firm_workers')
    .select('*')
    .in('firm_id', firmIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => toFirmWorker(r, firmNameMap[r.firm_id as string] ?? '—'));
}

/** Yeni çalışan ekle */
export async function createFirmWorker(payload: CreateFirmWorkerPayload): Promise<FirmWorker> {
  const { data, error } = await supabase
    .from('firm_workers')
    .insert({
      organization_id: payload.organizationId,
      firm_id: payload.firmId,
      full_name: payload.fullName,
      tc_no: payload.tcNo || null,
      phone: payload.phone || null,
      birth_date: payload.birthDate || null,
      work_status: payload.workStatus ?? 'active',
      job_title: payload.jobTitle || null,
      start_date: payload.startDate || null,
      emergency_contact: payload.emergencyContact || null,
      emergency_phone: payload.emergencyPhone || null,
      created_by: payload.createdBy || null,
    })
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Çalışan oluşturulamadı');
  return toFirmWorker(data);
}

/** Çalışan güncelle */
export async function updateFirmWorker(id: string, payload: Partial<CreateFirmWorkerPayload>): Promise<FirmWorker> {
  const update: Record<string, unknown> = {};
  if (payload.fullName !== undefined) update.full_name = payload.fullName;
  if (payload.tcNo !== undefined) update.tc_no = payload.tcNo;
  if (payload.phone !== undefined) update.phone = payload.phone;
  if (payload.birthDate !== undefined) update.birth_date = payload.birthDate;
  if (payload.workStatus !== undefined) update.work_status = payload.workStatus;
  if (payload.jobTitle !== undefined) update.job_title = payload.jobTitle;
  if (payload.startDate !== undefined) update.start_date = payload.startDate;
  if (payload.emergencyContact !== undefined) update.emergency_contact = payload.emergencyContact;
  if (payload.emergencyPhone !== undefined) update.emergency_phone = payload.emergencyPhone;
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('firm_workers')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Çalışan bulunamadı');
  return toFirmWorker(data);
}

/** Soft delete */
export async function softDeleteFirmWorker(id: string): Promise<void> {
  const { error } = await supabase
    .from('firm_workers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
