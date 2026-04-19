import { supabase } from '@/lib/supabase';

export interface IncidentReportRow {
  id: string;
  organization_id: string;
  firm_id: string | null;
  created_by: string | null;
  title: string;
  description: string;
  severity: string;
  status: string;
  injured_count: number;
  reported_by: string;
  incident_date: string;
  notes: string | null;
  created_at: string;
  firm?: { id: string; name: string } | null;
}

export async function getIncidentReports(organizationId: string): Promise<IncidentReportRow[]> {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*, firm:firms(id, name)')
    .eq('organization_id', organizationId)
    .order('incident_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IncidentReportRow[];
}

export async function createIncidentReport(
  organizationId: string,
  userId: string,
  payload: {
    title: string;
    description: string;
    severity: string;
    status: string;
    injuredCount: number;
    reportedBy: string;
    incidentDate: string;
    firmId: string | null;
    notes?: string;
  }
): Promise<IncidentReportRow> {
  const { data, error } = await supabase
    .from('incident_reports')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      firm_id: payload.firmId || null,
      title: payload.title,
      description: payload.description,
      severity: payload.severity,
      status: payload.status,
      injured_count: payload.injuredCount,
      reported_by: payload.reportedBy,
      incident_date: payload.incidentDate,
      notes: payload.notes || null,
    })
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Rapor oluşturulamadı');
  return data as IncidentReportRow;
}

export async function updateIncidentReport(
  id: string,
  payload: Partial<{
    title: string;
    description: string;
    severity: string;
    status: string;
    injuredCount: number;
    reportedBy: string;
    incidentDate: string;
    firmId: string | null;
    notes: string;
  }>
): Promise<IncidentReportRow> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.severity !== undefined) update.severity = payload.severity;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.injuredCount !== undefined) update.injured_count = payload.injuredCount;
  if (payload.reportedBy !== undefined) update.reported_by = payload.reportedBy;
  if (payload.incidentDate !== undefined) update.incident_date = payload.incidentDate;
  if (payload.firmId !== undefined) update.firm_id = payload.firmId || null;
  if (payload.notes !== undefined) update.notes = payload.notes || null;

  const { data, error } = await supabase
    .from('incident_reports')
    .update(update)
    .eq('id', id)
    .select('*, firm:firms(id, name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Rapor bulunamadı');
  return data as IncidentReportRow;
}

export async function deleteIncidentReport(id: string): Promise<void> {
  const { error } = await supabase.from('incident_reports').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
