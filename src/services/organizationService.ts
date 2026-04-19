import { supabase } from '@/lib/supabase';
import type { OrganizationRow } from '@/types/database';

export async function getOrganization(id: string): Promise<OrganizationRow | null> {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOrganization(
  id: string,
  payload: { name?: string; taxNo?: string; phone?: string; email?: string; address?: string; website?: string; authNo?: string }
): Promise<OrganizationRow> {
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.taxNo !== undefined) update.tax_no = payload.taxNo;
  if (payload.phone !== undefined) update.phone = payload.phone;
  if (payload.email !== undefined) update.email = payload.email;
  if (payload.address !== undefined) update.address = payload.address;
  if (payload.website !== undefined) update.website = payload.website;
  if (payload.authNo !== undefined) update.auth_no = payload.authNo;

  const { data, error } = await supabase.from('organizations').update(update).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Organizasyon bulunamadı');
  return data;
}
