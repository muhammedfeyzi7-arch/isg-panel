/**
 * storeHelpers.ts
 * Shared low-level DB helpers used by useStore and useGorevStore.
 * NO cache — all reads/writes go directly to Supabase.
 */
import { supabase } from '@/lib/supabase';

// ── Device ID — unique per browser tab (session storage) ──
export function getDeviceId(): string {
  let id = sessionStorage.getItem('isg_device_id');
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    sessionStorage.setItem('isg_device_id', id);
  }
  return id;
}

// ── ID generator ──
export function genId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ── Upsert (soft-delete aware) ──
// deleted_at is ALWAYS derived from item.silinmis so fetchAllRows filter stays consistent.
export async function dbUpsert(
  table: string,
  item: { id: string; silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>,
  userId: string,
  organizationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const isSilinmis = item.silinmis === true;
  const deletedAt = isSilinmis
    ? (typeof item.silinmeTarihi === 'string' ? item.silinmeTarihi : now)
    : null;

  const payload: Record<string, unknown> = {
    id: item.id,
    user_id: userId,
    organization_id: organizationId,
    device_id: getDeviceId(),
    data: item,
    updated_at: now,
    // deleted_at is always set correctly — fetchAllRows uses .is('deleted_at', null) filter
    deleted_at: deletedAt,
  };

  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: 'id' })
    .select('id');

  if (error) {
    const errMsg = error.message || error.details || error.hint || JSON.stringify(error);
    console.error(`[ISG] SAVE ERROR ${table}/${item.id}:`, errMsg);
    if (errMsg.includes('row-level security') || errMsg.includes('RLS') || errMsg.includes('policy')) {
      throw new Error(`Yetki hatası: Bu işlem için yetkiniz yok. (${errMsg})`);
    }
    throw new Error(errMsg);
  }

  if (!data || data.length === 0) {
    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('id', item.id)
      .maybeSingle();
    if (!existing) {
      throw new Error(`Kayıt veritabanına yazılamadı (${table}). RLS politikası engelliyor olabilir.`);
    }
  }
  console.log(`[ISG] SAVE OK ${table}/${item.id} deleted_at=${deletedAt ?? 'null'} ✓`);
}

// ── Hard delete (permanent) ──
export async function dbDelete(table: string, id: string): Promise<void> {
  try {
    await supabase.from(table).update({ device_id: getDeviceId() }).eq('id', id);
  } catch { /* ignore */ }
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.error(`[ISG] DELETE ERROR ${table}/${id}:`, error);
    throw error;
  }
  console.log(`[ISG] DELETE OK ${table}/${id} ✓`);
}

// ── Hard delete many ──
export async function dbDeleteMany(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await supabase.from(table).update({ device_id: getDeviceId() }).in('id', ids);
  } catch { /* ignore */ }
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) {
    console.error(`[ISG] DELETE_MANY ERROR ${table}:`, error);
    throw error;
  }
  console.log(`[ISG] DELETE_MANY OK ${table} (${ids.length} rows) ✓`);
}

// ── Direct column update (deleted_at, device_id, etc.) ──
// organization_id is NOT written to payload — prevents RLS bypass.
export async function dbUpdateDirect(
  table: string,
  id: string,
  organizationId: string,
  payload: Record<string, unknown>,
): Promise<{ rows: number; error: string | null }> {
  const { data, error } = await supabase
    .from(table)
    .update({ ...payload, updated_at: new Date().toISOString(), device_id: getDeviceId() })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select('id');

  if (error) {
    const errMsg = error.message || error.details || JSON.stringify(error);
    console.error(`[ISG] UPDATE_DIRECT ERROR ${table}/${id}:`, errMsg);
    return { rows: 0, error: errMsg };
  }
  const rowCount = data?.length ?? 0;
  console.log(`[ISG] UPDATE_DIRECT OK ${table}/${id} (${rowCount} rows) ✓`);
  return { rows: rowCount, error: null };
}

// ── Paginated fetch — bypasses Supabase 1000-row default limit ──
// Returns only rows with deleted_at IS NULL (active records).
export async function fetchAllRows(
  table: string,
  orgId: string,
): Promise<{ data: { data: unknown }[] | null; error: unknown }> {
  const PAGE_SIZE = 500;
  let allRows: { data: unknown }[] = [];
  let from = 0;
  let hasMore = true;
  let pageNum = 0;

  while (hasMore) {
    pageNum++;
    const { data, error } = await supabase
      .from(table)
      .select('id, data, created_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`[ISG] fetchAllRows error (${table}) page=${pageNum}:`, error);
      return { data: allRows.length > 0 ? allRows : null, error };
    }

    const rows = data ?? [];
    allRows = allRows.concat(rows as { data: unknown }[]);

    if (rows.length < PAGE_SIZE) { hasMore = false; }
    else { from += PAGE_SIZE; }
    if (pageNum >= 20) { hasMore = false; }
  }

  console.log(`[ISG] fetchAllRows DONE: ${table} total=${allRows.length} pages=${pageNum}`);
  return { data: allRows as { data: unknown }[], error: null };
}

// ── RPC: race-condition-safe record number ──
export async function generateRecordNoFromDB(
  type: 'dof' | 'tutanak' | 'is_izni',
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('generate_record_no', { record_type: type });
    if (error) { console.error(`[ISG] generateRecordNo RPC error (${type}):`, error); return null; }
    return data as string;
  } catch (err) {
    console.error(`[ISG] generateRecordNo unexpected error (${type}):`, err);
    return null;
  }
}
