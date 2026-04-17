import { supabase } from '@/lib/supabase';

type DataRow<T> = { id: string; organization_id: string; data: T };

export async function fetchDataRows<T>(
  table: string,
  orgIds: string[],
): Promise<DataRow<T>[]> {
  if (orgIds.length === 0) return [];

  const query = supabase
    .from(table)
    .select('id, organization_id, data')
    .is('deleted_at', null);

  const { data, error } =
    orgIds.length === 1
      ? await query.eq('organization_id', orgIds[0])
      : await query.in('organization_id', orgIds);

  if (error) throw error;
  return (data ?? []) as DataRow<T>[];
}
