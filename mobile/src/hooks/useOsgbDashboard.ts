import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataRows } from '@/lib/table';
import type { OrganizationRow } from '@/types/isg';

interface OsgbSummary {
  childCompanyCount: number;
  activeChildCompanyCount: number;
  uzmanCount: number;
  hekimCount: number;
  personelCount: number;
  activeVisitCount: number;
  todayVisitCount: number;
  weeklyVisitCount: number;
  lastActivityLabel: string;
  lastActivityCompany: string;
}

export interface CompanyOverviewRow {
  id: string;
  name: string;
  personelCount: number;
  hasActiveVisit: boolean;
  lastVisitDays: number | null;
}

export interface TeamOverviewRow {
  userId: string;
  displayName: string;
  activeFirmName: string;
  isSahada: boolean;
}

interface UseOsgbDashboardResult {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  summary: OsgbSummary;
  companies: OrganizationRow[];
  companyRows: CompanyOverviewRow[];
  teamRows: TeamOverviewRow[];
  refresh: () => Promise<void>;
}

const EMPTY_SUMMARY: OsgbSummary = {
  childCompanyCount: 0,
  activeChildCompanyCount: 0,
  uzmanCount: 0,
  hekimCount: 0,
  personelCount: 0,
  activeVisitCount: 0,
  todayVisitCount: 0,
  weeklyVisitCount: 0,
  lastActivityLabel: '-',
  lastActivityCompany: '-',
};

type ChildOrg = {
  id: string;
  name: string;
  is_active?: boolean | null;
};

type OsgbUser = {
  user_id?: string;
  osgb_role?: 'gezici_uzman' | 'isyeri_hekimi' | 'osgb_admin' | null;
  display_name?: string | null;
  email?: string | null;
  active_firm_name?: string | null;
};

type PersonelData = { id?: string };
type ZiyaretRow = {
  id: string;
  uzman_user_id?: string;
  firma_org_id?: string;
  firma_ad?: string | null;
  giris_saati: string;
  cikis_saati?: string | null;
};

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const maybe = err as { message?: unknown; details?: unknown; hint?: unknown };
    if (typeof maybe.message === 'string' && maybe.message.trim()) return maybe.message;
    if (typeof maybe.details === 'string' && maybe.details.trim()) return maybe.details;
    if (typeof maybe.hint === 'string' && maybe.hint.trim()) return maybe.hint;
    return JSON.stringify(err);
  }
  return String(err);
}

function getDaysDiff(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'Az once';
  if (mins < 60) return `${mins} dk once`;
  if (hours < 24) return `${hours} saat once`;
  return `${days} gun once`;
}

export function useOsgbDashboard(orgId?: string): UseOsgbDashboardResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OsgbSummary>(EMPTY_SUMMARY);
  const [companies, setCompanies] = useState<OrganizationRow[]>([]);
  const [companyRows, setCompanyRows] = useState<CompanyOverviewRow[]>([]);
  const [teamRows, setTeamRows] = useState<TeamOverviewRow[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (!orgId) {
      setSummary(EMPTY_SUMMARY);
      setCompanies([]);
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [orgRes, userRes, visitRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('id, name, is_active')
          .eq('parent_org_id', orgId)
          .eq('org_type', 'firma'),
        supabase
          .from('user_organizations')
          .select('user_id, osgb_role, display_name, email, active_firm_name')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .not('osgb_role', 'is', null),
        supabase
          .from('osgb_ziyaretler')
          .select('id, uzman_user_id, firma_org_id, firma_ad, giris_saati, cikis_saati')
          .eq('osgb_org_id', orgId)
          .order('giris_saati', { ascending: false })
          .limit(300),
      ]);

      if (orgRes.error) throw orgRes.error;
      if (userRes.error) throw userRes.error;

      const childOrgs = (orgRes.data ?? []) as ChildOrg[];
      const childIds = childOrgs.map((o) => o.id);
      const osgbUsers = (userRes.data ?? []) as OsgbUser[];
      // Ziyaret tablosu bazı ortamlarda henüz izinli olmayabiliyor; dashboard'ı tamamen kırma.
      const visits = visitRes.error ? ([] as ZiyaretRow[]) : ((visitRes.data ?? []) as ZiyaretRow[]);

      const personeller = await fetchDataRows<PersonelData>('personeller', childIds);
      const personelCountByFirm = new Map<string, number>();
      personeller.forEach((p) => {
        const current = personelCountByFirm.get(p.organization_id) ?? 0;
        personelCountByFirm.set(p.organization_id, current + 1);
      });

      const activeVisits = visits.filter((v) => !v.cikis_saati);
      const todayStr = new Date().toDateString();
      const todayVisits = visits.filter((v) => new Date(v.giris_saati).toDateString() === todayStr);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekVisits = visits.filter((v) => new Date(v.giris_saati) >= weekAgo);

      const lastVisitByFirm = new Map<string, string>();
      visits.forEach((v) => {
        const fid = v.firma_org_id;
        if (!fid) return;
        const existing = lastVisitByFirm.get(fid);
        if (!existing || v.giris_saati > existing) {
          lastVisitByFirm.set(fid, v.giris_saati);
        }
      });

      const activeVisitFirmSet = new Set(activeVisits.map((v) => v.firma_org_id).filter(Boolean));
      const activeVisitUserSet = new Set(activeVisits.map((v) => v.uzman_user_id).filter(Boolean));

      const rows: CompanyOverviewRow[] = childOrgs.map((o) => ({
        id: o.id,
        name: o.name,
        personelCount: personelCountByFirm.get(o.id) ?? 0,
        hasActiveVisit: activeVisitFirmSet.has(o.id),
        lastVisitDays: getDaysDiff(lastVisitByFirm.get(o.id)),
      }));

      rows.sort((a, b) => {
        if (a.hasActiveVisit !== b.hasActiveVisit) return a.hasActiveVisit ? -1 : 1;
        return b.personelCount - a.personelCount;
      });

      const teams: TeamOverviewRow[] = osgbUsers
        .filter((u) => u.osgb_role === 'gezici_uzman' || u.osgb_role === 'isyeri_hekimi')
        .map((u) => ({
          userId: u.user_id ?? '',
          displayName: u.display_name ?? u.email ?? 'Bilinmeyen',
          activeFirmName: u.active_firm_name ?? '-',
          isSahada: !!(u.user_id && activeVisitUserSet.has(u.user_id)),
        }));

      setCompanies(childOrgs.map((o) => ({ id: o.id, name: o.name, org_type: 'firma' })));
      setCompanyRows(rows);
      setTeamRows(teams);

      const latest = visits[0];
      setSummary({
        childCompanyCount: childOrgs.length,
        activeChildCompanyCount: childOrgs.filter((o) => o.is_active !== false).length,
        uzmanCount: osgbUsers.filter((u) => u.osgb_role === 'gezici_uzman').length,
        hekimCount: osgbUsers.filter((u) => u.osgb_role === 'isyeri_hekimi').length,
        personelCount: personeller.length,
        activeVisitCount: activeVisits.length,
        todayVisitCount: todayVisits.length,
        weeklyVisitCount: weekVisits.length,
        lastActivityLabel: latest ? timeAgo(latest.giris_saati) : '-',
        lastActivityCompany: latest?.firma_ad ?? '-',
      });
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    refreshing,
    error,
    summary,
    companies,
    companyRows,
    teamRows,
    refresh: () => load(true),
  };
}
