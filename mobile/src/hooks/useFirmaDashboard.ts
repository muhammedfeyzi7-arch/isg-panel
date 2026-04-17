import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { DashboardSummary, FirmaRow, PersonelRow } from '@/types/isg';

type UserOrgRow = {
  organization_id: string;
};

type GenericDataRow<T> = {
  id: string;
  data: T;
};

interface UseFirmaDashboardResult {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  summary: DashboardSummary;
  personeller: PersonelRow[];
  refresh: () => Promise<void>;
}

const EMPTY_SUMMARY: DashboardSummary = {
  firmaCount: 0,
  aktifFirmaCount: 0,
  personelCount: 0,
  aktifPersonelCount: 0,
};

export function useFirmaDashboard(userId?: string): UseFirmaDashboardResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [personeller, setPersoneller] = useState<PersonelRow[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) {
      setLoading(false);
      setSummary(EMPTY_SUMMARY);
      setPersoneller([]);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data: membership } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const userOrg = membership as UserOrgRow | null;
      if (!userOrg?.organization_id) {
        setSummary(EMPTY_SUMMARY);
        setPersoneller([]);
        return;
      }

      const orgId = userOrg.organization_id;

      const [firmaRes, personelRes] = await Promise.all([
        supabase
          .from('firmalar')
          .select('id, data')
          .eq('organization_id', orgId)
          .is('deleted_at', null),
        supabase
          .from('personeller')
          .select('id, data')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);

      if (firmaRes.error) throw firmaRes.error;
      if (personelRes.error) throw personelRes.error;

      const firmaRows = (firmaRes.data ?? []) as GenericDataRow<FirmaRow>[];
      const personelRows = (personelRes.data ?? []) as GenericDataRow<PersonelRow>[];

      const normalizedPersoneller: PersonelRow[] = personelRows.map((row) => ({
        id: row.id,
        adSoyad: row.data?.adSoyad ?? 'Adsız Personel',
        gorev: row.data?.gorev ?? '',
        firmaId: row.data?.firmaId,
        durum: row.data?.durum ?? 'Aktif',
      }));

      const aktifFirmaCount = firmaRows.filter(
        (f) => (f.data?.durum ?? 'Aktif').toLowerCase() === 'aktif',
      ).length;
      const aktifPersonelCount = normalizedPersoneller.filter(
        (p) => (p.durum ?? 'Aktif').toLowerCase() === 'aktif',
      ).length;

      setSummary({
        firmaCount: firmaRows.length,
        aktifFirmaCount,
        personelCount: normalizedPersoneller.length,
        aktifPersonelCount,
      });
      setPersoneller(normalizedPersoneller);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    refreshing,
    error,
    summary,
    personeller,
    refresh: () => load(true),
  };
}
