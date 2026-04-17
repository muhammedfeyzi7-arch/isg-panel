import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataRows } from '@/lib/table';
import type { OrganizationRow } from '@/types/isg';

interface MuayeneData {
  personelId?: string;
  sonrakiTarih?: string;
}

interface PersonelData {
  adSoyad?: string;
}

interface UpcomingMuayene {
  id: string;
  personelAdSoyad: string;
  daysLeft: number;
}

interface HekimSummary {
  assignedCompanyCount: number;
  totalMuayeneCount: number;
  upcoming30Count: number;
}

interface UseHekimDashboardResult {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  summary: HekimSummary;
  companies: OrganizationRow[];
  upcoming: UpcomingMuayene[];
  refresh: () => Promise<void>;
}

const EMPTY_SUMMARY: HekimSummary = {
  assignedCompanyCount: 0,
  totalMuayeneCount: 0,
  upcoming30Count: 0,
};

function daysUntil(dateString?: string): number | null {
  if (!dateString) return null;
  const next = new Date(dateString);
  if (Number.isNaN(next.getTime())) return null;
  const today = new Date();
  const diff = next.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function useHekimDashboard(assignedFirmIds: string[]): UseHekimDashboardResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HekimSummary>(EMPTY_SUMMARY);
  const [companies, setCompanies] = useState<OrganizationRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMuayene[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (assignedFirmIds.length === 0) {
        setSummary(EMPTY_SUMMARY);
        setCompanies([]);
        setUpcoming([]);
        return;
      }

      const [orgRes, muayeneRows, personelRows] = await Promise.all([
        supabase.from('organizations').select('id, name, org_type').in('id', assignedFirmIds),
        fetchDataRows<MuayeneData>('muayeneler', assignedFirmIds),
        fetchDataRows<PersonelData>('personeller', assignedFirmIds),
      ]);

      if (orgRes.error) throw orgRes.error;

      const personelMap = new Map<string, string>();
      personelRows.forEach((row) => {
        personelMap.set(row.id, row.data?.adSoyad ?? 'Bilinmeyen Personel');
      });

      const upcomingRows = muayeneRows
        .map((row) => {
          const daysLeft = daysUntil(row.data?.sonrakiTarih);
          if (daysLeft === null || daysLeft < 0 || daysLeft > 30) return null;
          return {
            id: row.id,
            personelAdSoyad: personelMap.get(row.data?.personelId ?? '') ?? 'Bilinmeyen Personel',
            daysLeft,
          };
        })
        .filter((item): item is UpcomingMuayene => item !== null)
        .sort((a, b) => a.daysLeft - b.daysLeft);

      setCompanies((orgRes.data ?? []) as OrganizationRow[]);
      setUpcoming(upcomingRows);
      setSummary({
        assignedCompanyCount: assignedFirmIds.length,
        totalMuayeneCount: muayeneRows.length,
        upcoming30Count: upcomingRows.length,
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

  const stableUpcoming = useMemo(() => upcoming.slice(0, 15), [upcoming]);

  return {
    loading,
    refreshing,
    error,
    summary,
    companies,
    upcoming: stableUpcoming,
    refresh: () => load(true),
  };
}
