import { supabase } from '@/lib/supabase';
import type { AppReport, ReportRow, ReportType } from '@/types/database';

function toAppReport(row: ReportRow): AppReport {
  return {
    id: row.id,
    name: row.title,
    createdAt: new Date(row.created_at).toLocaleDateString('tr-TR'),
    status: row.status,
    type: row.type,
    createdBy: row.creator?.full_name ?? '—',
  };
}

export async function getReports(organizationId: string): Promise<AppReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*, creator:profiles(full_name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toAppReport(r as ReportRow));
}

export async function getMyReports(userId: string): Promise<AppReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*, creator:profiles(full_name)')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toAppReport(r as ReportRow));
}

export async function createReport(
  organizationId: string,
  userId: string,
  payload: { title: string; type: ReportType; description?: string }
): Promise<AppReport> {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      title: payload.title,
      type: payload.type,
      description: payload.description || null,
      status: 'Hazır',
    })
    .select('*, creator:profiles(full_name)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Rapor oluşturulamadı');
  return toAppReport(data as ReportRow);
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
