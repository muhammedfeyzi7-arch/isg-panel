import { supabase } from '@/lib/supabase';

// ─── DÖF Records ──────────────────────────────────────────────────────────────

export interface DofRow {
  id: string;
  organization_id: string;
  firm_id: string | null;
  personnel_id: string | null;
  created_by: string | null;
  dof_no: string;
  title: string;
  description: string;
  responsible_person: string;
  detection_date: string;
  target_close_date: string;
  action_required: string;
  opening_photo_url: string | null;
  closing_photo_url: string | null;
  closing_note: string | null;
  status: 'open' | 'closed' | 'critical';
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  firm?: { id: string; name: string } | null;
  personnel?: { id: string; full_name: string } | null;
}

export async function getDofRecords(organizationId: string, from?: string, to?: string): Promise<DofRow[]> {
  let q = supabase
    .from('dof_records')
    .select('*, firm:firms(id, name), personnel:dof_records_personnel_id_fkey(id, full_name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (from) q = q.gte('detection_date', from);
  if (to) q = q.lte('detection_date', to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DofRow[];
}

export async function createDofRecord(
  organizationId: string,
  userId: string,
  payload: {
    title: string;
    firmId: string | null;
    personnelId: string | null;
    detectionDate: string;
    responsiblePerson: string;
    targetCloseDate: string;
    description: string;
    actionRequired: string;
    openingPhotoUrl?: string;
    status: 'open' | 'closed' | 'critical';
  }
): Promise<DofRow> {
  // Generate DÖF No: DOF-YYYYMMDD-XXXX
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const dofNo = `DOF-${dateStr}-${rand}`;

  const { data, error } = await supabase
    .from('dof_records')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      firm_id: payload.firmId || null,
      personnel_id: payload.personnelId || null,
      dof_no: dofNo,
      title: payload.title,
      description: payload.description,
      responsible_person: payload.responsiblePerson,
      detection_date: payload.detectionDate,
      target_close_date: payload.targetCloseDate,
      action_required: payload.actionRequired,
      opening_photo_url: payload.openingPhotoUrl || null,
      status: payload.status,
    })
    .select('*, firm:firms(id, name), personnel:dof_records_personnel_id_fkey(id, full_name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('DÖF kaydı oluşturulamadı');
  return data as DofRow;
}

export async function updateDofRecord(id: string, payload: Partial<{
  title: string;
  firmId: string | null;
  personnelId: string | null;
  detectionDate: string;
  responsiblePerson: string;
  targetCloseDate: string;
  description: string;
  actionRequired: string;
  openingPhotoUrl: string;
  closingPhotoUrl: string;
  closingNote: string;
  status: 'open' | 'closed' | 'critical';
}>): Promise<DofRow> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.firmId !== undefined) update.firm_id = payload.firmId || null;
  if (payload.personnelId !== undefined) update.personnel_id = payload.personnelId || null;
  if (payload.detectionDate !== undefined) update.detection_date = payload.detectionDate;
  if (payload.responsiblePerson !== undefined) update.responsible_person = payload.responsiblePerson;
  if (payload.targetCloseDate !== undefined) update.target_close_date = payload.targetCloseDate;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.actionRequired !== undefined) update.action_required = payload.actionRequired;
  if (payload.openingPhotoUrl !== undefined) update.opening_photo_url = payload.openingPhotoUrl || null;
  if (payload.closingPhotoUrl !== undefined) update.closing_photo_url = payload.closingPhotoUrl || null;
  if (payload.closingNote !== undefined) update.closing_note = payload.closingNote || null;
  if (payload.status !== undefined) {
    update.status = payload.status;
    if (payload.status === 'closed') update.closed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('dof_records')
    .update(update)
    .eq('id', id)
    .select('*, firm:firms(id, name), personnel:dof_records_personnel_id_fkey(id, full_name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('DÖF kaydı bulunamadı');
  return data as DofRow;
}

export async function deleteDofRecord(id: string): Promise<void> {
  const { error } = await supabase.from('dof_records').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrainingRow {
  id: string;
  organization_id: string;
  firm_id: string | null;
  created_by: string | null;
  title: string;
  type: string;
  training_date: string;
  duration_hours: number;
  participant_count: number;
  status: string;
  notes: string | null;
  created_at: string;
  firm?: { id: string; name: string } | null;
}

export interface EquipmentRow {
  id: string;
  organization_id: string;
  firm_id: string | null;
  created_by: string | null;
  name: string;
  category: string;
  equipment_type: string | null;
  area: string | null;
  serial_no: string | null;
  brand: string | null;
  last_control_date: string | null;
  next_control_date: string | null;
  status: string;
  has_document: boolean;
  document_url: string | null;
  qr_token: string | null;
  notes: string | null;
  created_at: string;
  firm?: { id: string; name: string } | null;
}

export interface WorkPermitRow {
  id: string;
  organization_id: string;
  firm_id: string | null;
  created_by: string | null;
  title: string;
  permit_type: string;
  requested_by: string;
  permit_date: string;
  valid_until: string;
  status: string;
  notes: string | null;
  created_at: string;
  firm?: { id: string; name: string } | null;
}

export interface HealthRecordRow {
  id: string;
  organization_id: string;
  firm_id: string | null;
  personnel_profile_id: string | null;
  created_by: string | null;
  personnel_name: string;
  exam_date: string;
  next_exam_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  firm?: { id: string; name: string } | null;
}

export interface FirmDocumentRow {
  id: string;
  organization_id: string;
  firm_id: string | null;
  created_by: string | null;
  doc_name: string;
  status: string;
  expiry_date: string | null;
  uploaded_at: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  firm?: { id: string; name: string } | null;
}

// ─── Trainings ────────────────────────────────────────────────────────────────

export async function getTrainings(organizationId: string): Promise<TrainingRow[]> {
  const { data, error } = await supabase
    .from('trainings')
    .select('*, firm:firms(id, name)')
    .eq('organization_id', organizationId)
    .order('training_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainingRow[];
}

export async function createTraining(
  organizationId: string,
  userId: string,
  payload: {
    title: string;
    type: string;
    firmId: string | null;
    trainingDate: string;
    durationHours: number;
    participantCount: number;
    status: string;
    notes?: string;
  }
): Promise<TrainingRow> {
  const { data, error } = await supabase
    .from('trainings')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      firm_id: payload.firmId || null,
      title: payload.title,
      type: payload.type,
      training_date: payload.trainingDate,
      duration_hours: payload.durationHours,
      participant_count: payload.participantCount,
      status: payload.status,
      notes: payload.notes || null,
    })
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Eğitim oluşturulamadı');
  return data as TrainingRow;
}

export async function updateTraining(id: string, payload: Partial<{
  title: string; type: string; firmId: string | null;
  trainingDate: string; durationHours: number; participantCount: number;
  status: string; notes: string;
}>): Promise<TrainingRow> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.type !== undefined) update.type = payload.type;
  if (payload.firmId !== undefined) update.firm_id = payload.firmId || null;
  if (payload.trainingDate !== undefined) update.training_date = payload.trainingDate;
  if (payload.durationHours !== undefined) update.duration_hours = payload.durationHours;
  if (payload.participantCount !== undefined) update.participant_count = payload.participantCount;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.notes !== undefined) update.notes = payload.notes || null;

  const { data, error } = await supabase
    .from('trainings')
    .update(update)
    .eq('id', id)
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Eğitim bulunamadı');
  return data as TrainingRow;
}

export async function deleteTraining(id: string): Promise<void> {
  const { error } = await supabase.from('trainings').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export async function getEquipment(organizationId: string): Promise<EquipmentRow[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*, firm:firms(id, name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EquipmentRow[];
}

export async function createEquipment(
  organizationId: string,
  userId: string,
  payload: {
    name: string; category: string; equipmentType?: string; firmId: string | null;
    area?: string; serialNo?: string; brand?: string;
    lastControlDate?: string; nextControlDate?: string;
    status: string; hasDocument?: boolean; documentUrl?: string; notes?: string;
  }
): Promise<EquipmentRow> {
  const qrToken = `EQ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      firm_id: payload.firmId || null,
      name: payload.name,
      category: payload.category,
      equipment_type: payload.equipmentType || null,
      area: payload.area || null,
      serial_no: payload.serialNo || null,
      brand: payload.brand || null,
      last_control_date: payload.lastControlDate || null,
      next_control_date: payload.nextControlDate || null,
      status: payload.status,
      has_document: payload.hasDocument ?? false,
      document_url: payload.documentUrl || null,
      qr_token: qrToken,
      notes: payload.notes || null,
    })
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Ekipman oluşturulamadı');
  return data as EquipmentRow;
}

export async function updateEquipment(id: string, payload: Partial<{
  name: string; category: string; equipmentType: string; firmId: string | null;
  area: string; serialNo: string; brand: string;
  lastControlDate: string; nextControlDate: string; status: string;
  hasDocument: boolean; documentUrl: string; notes: string;
}>): Promise<EquipmentRow> {
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.category !== undefined) update.category = payload.category;
  if (payload.equipmentType !== undefined) update.equipment_type = payload.equipmentType || null;
  if (payload.firmId !== undefined) update.firm_id = payload.firmId || null;
  if (payload.area !== undefined) update.area = payload.area || null;
  if (payload.serialNo !== undefined) update.serial_no = payload.serialNo || null;
  if (payload.brand !== undefined) update.brand = payload.brand || null;
  if (payload.lastControlDate !== undefined) update.last_control_date = payload.lastControlDate || null;
  if (payload.nextControlDate !== undefined) update.next_control_date = payload.nextControlDate || null;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.hasDocument !== undefined) update.has_document = payload.hasDocument;
  if (payload.documentUrl !== undefined) update.document_url = payload.documentUrl || null;
  if (payload.notes !== undefined) update.notes = payload.notes || null;

  const { data, error } = await supabase
    .from('equipment')
    .update(update)
    .eq('id', id)
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Ekipman bulunamadı');
  return data as EquipmentRow;
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Work Permits ─────────────────────────────────────────────────────────────

export async function getWorkPermits(organizationId: string): Promise<WorkPermitRow[]> {
  const { data, error } = await supabase
    .from('work_permits')
    .select('*, firm:firms(id, name)')
    .eq('organization_id', organizationId)
    .order('permit_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkPermitRow[];
}

export async function createWorkPermit(
  organizationId: string,
  userId: string,
  payload: {
    title: string; permitType: string; firmId: string | null;
    requestedBy: string; permitDate: string; validUntil: string;
    status: string; notes?: string;
  }
): Promise<WorkPermitRow> {
  const { data, error } = await supabase
    .from('work_permits')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      firm_id: payload.firmId || null,
      title: payload.title,
      permit_type: payload.permitType,
      requested_by: payload.requestedBy,
      permit_date: payload.permitDate,
      valid_until: payload.validUntil,
      status: payload.status,
      notes: payload.notes || null,
    })
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('İş izni oluşturulamadı');
  return data as WorkPermitRow;
}

export async function updateWorkPermit(id: string, payload: Partial<{
  title: string; permitType: string; firmId: string | null;
  requestedBy: string; permitDate: string; validUntil: string;
  status: string; notes: string;
}>): Promise<WorkPermitRow> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.permitType !== undefined) update.permit_type = payload.permitType;
  if (payload.firmId !== undefined) update.firm_id = payload.firmId || null;
  if (payload.requestedBy !== undefined) update.requested_by = payload.requestedBy;
  if (payload.permitDate !== undefined) update.permit_date = payload.permitDate;
  if (payload.validUntil !== undefined) update.valid_until = payload.validUntil;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.notes !== undefined) update.notes = payload.notes || null;

  const { data, error } = await supabase
    .from('work_permits')
    .update(update)
    .eq('id', id)
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('İş izni bulunamadı');
  return data as WorkPermitRow;
}

export async function deleteWorkPermit(id: string): Promise<void> {
  const { error } = await supabase.from('work_permits').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Health Records ───────────────────────────────────────────────────────────

export async function getHealthRecords(organizationId: string): Promise<HealthRecordRow[]> {
  const { data, error } = await supabase
    .from('health_records')
    .select('*, firm:firms(id, name)')
    .eq('organization_id', organizationId)
    .order('next_exam_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as HealthRecordRow[];
}

export async function createHealthRecord(
  organizationId: string,
  userId: string,
  payload: {
    personnelName: string; firmId: string | null;
    examDate: string; nextExamDate: string; status: string; notes?: string;
  }
): Promise<HealthRecordRow> {
  const { data, error } = await supabase
    .from('health_records')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      firm_id: payload.firmId || null,
      personnel_name: payload.personnelName,
      exam_date: payload.examDate,
      next_exam_date: payload.nextExamDate,
      status: payload.status,
      notes: payload.notes || null,
    })
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Sağlık kaydı oluşturulamadı');
  return data as HealthRecordRow;
}

export async function updateHealthRecord(id: string, payload: Partial<{
  personnelName: string; firmId: string | null;
  examDate: string; nextExamDate: string; status: string; notes: string;
}>): Promise<HealthRecordRow> {
  const update: Record<string, unknown> = {};
  if (payload.personnelName !== undefined) update.personnel_name = payload.personnelName;
  if (payload.firmId !== undefined) update.firm_id = payload.firmId || null;
  if (payload.examDate !== undefined) update.exam_date = payload.examDate;
  if (payload.nextExamDate !== undefined) update.next_exam_date = payload.nextExamDate;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.notes !== undefined) update.notes = payload.notes || null;

  const { data, error } = await supabase
    .from('health_records')
    .update(update)
    .eq('id', id)
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Sağlık kaydı bulunamadı');
  return data as HealthRecordRow;
}

export async function deleteHealthRecord(id: string): Promise<void> {
  const { error } = await supabase.from('health_records').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Firm Documents ───────────────────────────────────────────────────────────

export async function getFirmDocuments(organizationId: string): Promise<FirmDocumentRow[]> {
  const { data, error } = await supabase
    .from('firm_documents')
    .select('*, firm:firms(id, name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FirmDocumentRow[];
}

export async function createFirmDocument(
  organizationId: string,
  userId: string,
  payload: {
    docName: string; firmId: string | null; status: string;
    expiryDate?: string; notes?: string;
  }
): Promise<FirmDocumentRow> {
  const { data, error } = await supabase
    .from('firm_documents')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      firm_id: payload.firmId || null,
      doc_name: payload.docName,
      status: payload.status,
      expiry_date: payload.expiryDate || null,
      uploaded_at: new Date().toISOString().split('T')[0],
      notes: payload.notes || null,
    })
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Belge oluşturulamadı');
  return data as FirmDocumentRow;
}

export async function updateFirmDocument(id: string, payload: Partial<{
  docName: string; firmId: string | null; status: string;
  expiryDate: string; notes: string;
}>): Promise<FirmDocumentRow> {
  const update: Record<string, unknown> = {};
  if (payload.docName !== undefined) update.doc_name = payload.docName;
  if (payload.firmId !== undefined) update.firm_id = payload.firmId || null;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.expiryDate !== undefined) update.expiry_date = payload.expiryDate || null;
  if (payload.notes !== undefined) update.notes = payload.notes || null;

  const { data, error } = await supabase
    .from('firm_documents')
    .update(update)
    .eq('id', id)
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Belge bulunamadı');
  return data as FirmDocumentRow;
}

export async function deleteFirmDocument(id: string): Promise<void> {
  const { error } = await supabase.from('firm_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
