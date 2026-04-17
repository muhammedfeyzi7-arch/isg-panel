import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataRows } from '@/lib/table';
import type { OrganizationRow } from '@/types/isg';

interface UzmanSummary {
  assignedCompanyCount: number;
  personelCount: number;
  uygunsuzlukCount: number;
}

interface UseUzmanDashboardResult {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  summary: UzmanSummary;
  companies: OrganizationRow[];
  refresh: () => Promise<void>;
}

const EMPTY_SUMMARY: UzmanSummary = {
  assignedCompanyCount: 0,
  personelCount: 0,
  uygunsuzlukCount: 0,
};

export function useUzmanDashboard(assignedFirmIds: string[]): UseUzmanDashboardResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UzmanSummary>(EMPTY_SUMMARY);
  const [companies, setCompanies] = useState<OrganizationRow[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (assignedFirmIds.length === 0) {
        setCompanies([]);
        setSummary(EMPTY_SUMMARY);
        return;
      }

      const [orgRes, personeller, uygunsuzluklar] = await Promise.all([
        supabase.from('organizations').select('id, name, org_type').in('id', assignedFirmIds),
        fetchDataRows<Record<string, unknown>>('personeller', assignedFirmIds),
        fetchDataRows<Record<string, unknown>>('uygunsuzluklar', assignedFirmIds),
      ]);

      if (orgRes.error) throw orgRes.error;
      const orgRows = (orgRes.data ?? []) as OrganizationRow[];

      setCompanies(orgRows);
      setSummary({
        assignedCompanyCount: assignedFirmIds.length,
        personelCount: personeller.length,
        uygunsuzlukCount: uygunsuzluklar.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assignedFirmIds]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    refreshing,
    error,
    summary,
    companies,
    refresh: () => load(true),
  };
}
