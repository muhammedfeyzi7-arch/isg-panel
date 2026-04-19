import { supabase } from '@/lib/supabase';

export type LogAction =
  | 'user_created'
  | 'user_role_changed'
  | 'user_status_changed'
  | 'user_deleted'
  | 'user_restored'
  | 'firm_created'
  | 'firm_updated'
  | 'firm_deleted'
  | 'firm_restored'
  | 'firm_assigned'
  | 'firm_unassigned'
  | 'visit_started'
  | 'visit_ended'
  | 'visit_deleted'
  | 'dof_created'
  | 'dof_updated'
  | 'dof_closed'
  | 'dof_deleted';

export type LogEntityType =
  | 'profile'
  | 'firm'
  | 'firm_assignment'
  | 'visit'
  | 'dof_record'
  | 'training'
  | 'equipment'
  | 'work_permit'
  | 'health_record'
  | 'firm_document';

export interface ActivityLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: LogAction;
  entity_type: LogEntityType;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export async function logActivity(params: {
  organizationId: string;
  userId: string;
  action: LogAction;
  entityType: LogEntityType;
  entityId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      meta: params.meta ?? null,
    });
  } catch {
    // Audit log hatası ana akışı durdurmamalı — sessizce geç
  }
}

export async function getActivityLogs(
  organizationId: string,
  limit = 50
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLog[];
}
