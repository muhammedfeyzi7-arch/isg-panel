/**
 * storeHelpers.ts
 * Shared low-level DB helpers used by useStore and useGorevStore.
 * NO cache — all reads/writes go directly to Supabase.
 */
import { supabase } from '@/lib/supabase';

// ── Dev-only logger — production'da tüm [ISG] logları kapalı ──────────────
const IS_DEV = import.meta.env.DEV;
const log = IS_DEV ? console.log.bind(console) : () => {};
const logError = console.error.bind(console); // hata logları her zaman açık

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
    deleted_at: deletedAt,
  };

  const { error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: 'id' });

  // B: .select('id') + maybeSingle() ikinci sorgu KALDIRILDI.
  // Supabase upsert hata vermezse kayıt yazılmıştır — ekstra doğrulama sorgusuna gerek yok.
  // Sadece hata varsa fırlat.
  if (error) {
    const errMsg = error.message || error.details || error.hint || JSON.stringify(error);
    logError(`[ISG] SAVE ERROR ${table}/${item.id}:`, errMsg);
    if (errMsg.includes('row-level security') || errMsg.includes('RLS') || errMsg.includes('policy')) {
      throw new Error(`Yetki hatası: Bu işlem için yetkiniz yok. (${errMsg})`);
    }
    throw new Error(errMsg);
  }

  log(`[ISG] SAVE OK ${table}/${item.id} deleted_at=${deletedAt ?? 'null'} ✓`);
}

// ── Hard delete (permanent) ──
// C: device_id ön güncellemesi KALDIRILDI — gereksiz ekstra istek.
// Realtime handler zaten kendi deviceId'sini payload'dan okur.
export async function dbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    logError(`[ISG] DELETE ERROR ${table}/${id}:`, error);
    throw error;
  }
  log(`[ISG] DELETE OK ${table}/${id} ✓`);
}

// ── Hard delete many ──
// C: device_id ön güncellemesi KALDIRILDI
export async function dbDeleteMany(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) {
    logError(`[ISG] DELETE_MANY ERROR ${table}:`, error);
    throw error;
  }
  log(`[ISG] DELETE_MANY OK ${table} (${ids.length} rows) ✓`);
}

// ── Direct column update (deleted_at, device_id, etc.) ──
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
    logError(`[ISG] UPDATE_DIRECT ERROR ${table}/${id}:`, errMsg);
    return { rows: 0, error: errMsg };
  }
  const rowCount = data?.length ?? 0;
  log(`[ISG] UPDATE_DIRECT OK ${table}/${id} (${rowCount} rows) ✓`);
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
      logError(`[ISG] fetchAllRows error (${table}) page=${pageNum}:`, error);
      return { data: allRows.length > 0 ? allRows : null, error };
    }

    const rows = data ?? [];
    allRows = allRows.concat(rows as { data: unknown }[]);

    if (rows.length < PAGE_SIZE) { hasMore = false; }
    else { from += PAGE_SIZE; }
    if (pageNum >= 20) { hasMore = false; }
  }

  log(`[ISG] fetchAllRows DONE: ${table} total=${allRows.length} pages=${pageNum}`);
  return { data: allRows as { data: unknown }[], error: null };
}

// ── RPC: race-condition-safe record number ──
export async function generateRecordNoFromDB(
  type: 'dof' | 'tutanak' | 'is_izni',
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('generate_record_no', { record_type: type });
    if (error) { logError(`[ISG] generateRecordNo RPC error (${type}):`, error); return null; }
    return data as string;
  } catch (err) {
    logError(`[ISG] generateRecordNo unexpected error (${type}):`, err);
    return null;
  }
}
