import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type MobilePanel = 'firma' | 'osgb-dashboard' | 'uzman' | 'hekim';

type MembershipRow = {
  role: string | null;
  osgb_role: 'osgb_admin' | 'gezici_uzman' | 'isyeri_hekimi' | null;
  organizations: {
    org_type: 'firma' | 'osgb' | null;
  } | null;
};

export async function resolvePanelForUser(user: User): Promise<MobilePanel> {
  const { data } = await supabase
    .from('user_organizations')
    .select(
      'role, osgb_role, organizations!user_organizations_organization_id_fkey(org_type)',
    )
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const row = data as MembershipRow | null;

  if (!row) return 'firma';
  if (row.osgb_role === 'osgb_admin') return 'osgb-dashboard';
  if (row.osgb_role === 'gezici_uzman') return 'uzman';
  if (row.osgb_role === 'isyeri_hekimi') return 'hekim';
  if (row.organizations?.org_type === 'osgb') return 'osgb-dashboard';
  return 'firma';
}
