import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { MembershipRow } from '@/types/isg';

interface UseMembershipResult {
  loading: boolean;
  error: string | null;
  membership: MembershipRow | null;
  refresh: () => Promise<void>;
}

export function useMembership(userId?: string): UseMembershipResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setMembership(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1) OSGB rolleri öncelikli al (osgb_admin / gezici_uzman / isyeri_hekimi)
      const { data: osgbData, error: osgbError } = await supabase
        .from('user_organizations')
        .select('organization_id, role, osgb_role, active_firm_ids, active_firm_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .not('osgb_role', 'is', null)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (osgbError) throw osgbError;
      if (osgbData) {
        setMembership(osgbData as MembershipRow);
        return;
      }

      // 2) Yoksa normal aktif üyelik
      const { data, error: queryError } = await supabase
        .from('user_organizations')
        .select('organization_id, role, osgb_role, active_firm_ids, active_firm_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (queryError) throw queryError;
      setMembership((data as MembershipRow | null) ?? null);
    } catch (err) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: unknown }).message ?? 'Bilinmeyen hata')
          : String(err);
      setError(message);
      setMembership(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    membership,
    refresh: load,
  };
}
