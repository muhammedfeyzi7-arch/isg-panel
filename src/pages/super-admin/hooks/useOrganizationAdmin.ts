import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface OrgAdmin {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  subscription_start: string | null;
  subscription_end: string | null;
  is_active: boolean;
  member_count?: number;
  founder_email?: string | null;
}

export function useOrganizationAdmin() {
  const [orgs, setOrgs] = useState<OrgAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Tüm organizasyonları çek
      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (orgErr) throw orgErr;

      // Üye sayılarını çek
      const { data: memberData } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('is_active', true);

      // Kurucuların email'lerini çek
      const founderIds = (orgData || [])
        .map(o => o.created_by)
        .filter(Boolean) as string[];

      let founderMap: Record<string, string> = {};
      if (founderIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id')
          .in('user_id', founderIds);

        // Auth users email'lerini edge function üzerinden alamıyoruz,
        // user_id -> email için auth.users'a RPC ile gidiyoruz
        if (profileData) {
          // Sadece user_id gösterebiliriz, email için ayrı bir yol gerekir
          profileData.forEach(p => {
            founderMap[p.user_id] = p.user_id;
          });
        }
      }

      // Üye sayısı map
      const memberCountMap: Record<string, number> = {};
      (memberData || []).forEach(m => {
        memberCountMap[m.organization_id] = (memberCountMap[m.organization_id] || 0) + 1;
      });

      const enriched: OrgAdmin[] = (orgData || []).map(org => ({
        ...org,
        member_count: memberCountMap[org.id] || 0,
        founder_email: founderMap[org.created_by] || null,
      }));

      setOrgs(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSubscription = useCallback(async (
    orgId: string,
    fields: { subscription_end?: string; is_active?: boolean }
  ) => {
    const { error: updateErr } = await supabase
      .from('organizations')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', orgId);
    if (updateErr) throw updateErr;
    await fetchOrgs();
  }, [fetchOrgs]);

  const deleteOrg = useCallback(async (orgId: string) => {
    const { error: delErr } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);
    if (delErr) throw delErr;
    await fetchOrgs();
  }, [fetchOrgs]);

  return { orgs, loading, error, fetchOrgs, updateSubscription, deleteOrg };
}
