import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Organization = {
  id: string;
  name: string;
  is_active: boolean;
  parent_org_id: string | null;
  org_type: 'osgb' | 'firma';
  deleted_at: string | null;
  invite_code: string | null;
  created_at: string;
};

export type UserOrganization = {
  user_id: string;
  organization_id: string;
  is_active: boolean;
  osgb_role: 'osgb_admin' | 'gezici_uzman' | 'isyeri_hekimi' | null;
  display_name: string | null;
  email: string | null;
  active_firm_id: string | null;
  active_firm_ids: string[] | null;
};

type JsonData = Record<string, unknown>;

type PersonelRecord = {
  id: string;
  organization_id: string;
  deleted_at: string | null;
  data: JsonData | null;
};

type UygunsuzlukRecord = {
  id: string;
  organization_id: string;
  deleted_at: string | null;
  data: JsonData | null;
};

type GenericJsonRecord = {
  id: string;
  organization_id: string;
  deleted_at: string | null;
  data: JsonData | null;
  created_at?: string;
};

type OsgbZiyaret = {
  id: string;
  osgb_org_id: string;
  firma_org_id: string | null;
  firma_ad: string | null;
  uzman_id: string | null;
  uzman_ad: string | null;
  uzman_email: string | null;
  created_at: string;
  bitis_zamani: string | null;
  notlar: string | null;
};

type ZiyaretPlani = {
  id: string;
  osgb_org_id: string;
  firma_org_id: string;
  gunler: string[] | null;
  aktif: boolean;
  notlar: string | null;
};

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: unknown }).message ?? 'Bilinmeyen hata');
  }
  return String(err ?? 'Bilinmeyen hata');
}

function toDateTimeTR(value: string): string {
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTR(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function dataString(data: JsonData | null | undefined, key: string): string {
  if (!data) return '';
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function isUygunsuzlukOpen(durum: string): boolean {
  const normalized = durum.trim().toLocaleLowerCase('tr-TR');
  return normalized !== 'kapandı' && normalized !== 'kapatıldı';
}

function randomInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createRealtimeChannel(base: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return supabase.channel(`${base}-${suffix}`);
}

export function useDashboardData(orgId: string | null) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalFirmalar: 0,
    totalPersonel: 0,
    acikUygunsuzluk: 0,
    aktifUzman: 0,
  });
  const [recentVisits, setRecentVisits] = useState<
    Array<{ id: string; uzman: string; firma: string; createdAt: string; status: 'Tamamlandı' | 'Devam Ediyor' }>
  >([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orgId) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const { data: firmalar, error: firmsError } = await supabase
          .from('organizations')
          .select('id')
          .eq('parent_org_id', orgId)
          .eq('org_type', 'firma')
          .is('deleted_at', null);
        if (firmsError) throw firmsError;

        const firmaIds = (firmalar ?? []).map((f) => f.id as string);

        const [{ count: aktifUzmanCount, error: uzmanError }, ziyaretlerResult] = await Promise.all([
          supabase
            .from('user_organizations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi']),
          supabase
            .from('osgb_ziyaretler')
            .select('id, uzman_ad, uzman_email, firma_ad, created_at, bitis_zamani')
            .eq('osgb_org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        if (uzmanError) throw uzmanError;
        if (ziyaretlerResult.error) throw ziyaretlerResult.error;

        let totalPersonel = 0;
        let acikUygunsuzluk = 0;

        if (firmaIds.length > 0) {
          const [personellerResult, uygunsuzlukResult] = await Promise.all([
            supabase
              .from('personeller')
              .select('*', { count: 'exact', head: true })
              .in('organization_id', firmaIds)
              .is('deleted_at', null),
            supabase
              .from('uygunsuzluklar')
              .select('data')
              .in('organization_id', firmaIds)
              .is('deleted_at', null),
          ]);

          if (personellerResult.error) throw personellerResult.error;
          if (uygunsuzlukResult.error) throw uygunsuzlukResult.error;

          totalPersonel = personellerResult.count ?? 0;
          acikUygunsuzluk = ((uygunsuzlukResult.data ?? []) as Array<{ data: JsonData | null }>).filter((row) =>
            isUygunsuzlukOpen(dataString(row.data, 'durum')),
          ).length;
        }

        setStats({
          totalFirmalar: firmaIds.length,
          totalPersonel,
          acikUygunsuzluk,
          aktifUzman: aktifUzmanCount ?? 0,
        });

        setRecentVisits(
          ((ziyaretlerResult.data ?? []) as OsgbZiyaret[]).map((visit) => ({
            id: visit.id,
            uzman: visit.uzman_ad ?? visit.uzman_email ?? 'Bilinmeyen',
            firma: visit.firma_ad ?? 'Bilinmeyen Firma',
            createdAt: toDateTimeTR(visit.created_at),
            status: visit.bitis_zamani ? 'Tamamlandı' : 'Devam Ediyor',
          })),
        );
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orgId) return;
    const channel = createRealtimeChannel(`osgb-dashboard-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizations', filter: `parent_org_id=eq.${orgId}` },
        () => void load(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'osgb_ziyaretler', filter: `osgb_org_id=eq.${orgId}` },
        () => void load(true),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, orgId]);

  return { loading, refreshing, error, stats, recentVisits, refresh: () => load(true) };
}

export function useFirmalarData(orgId: string | null, searchText: string) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      name: string;
      inviteCode: string;
      personelSayisi: number;
      uzmanAd: string;
      uygunsuzlukSayisi: number;
      createdAt: string;
    }>
  >([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orgId) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [firmalarResult, uzmanlarResult] = await Promise.all([
          supabase
            .from('organizations')
            .select('id, name, invite_code, created_at')
            .eq('parent_org_id', orgId)
            .eq('org_type', 'firma')
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('user_organizations')
            .select('display_name, active_firm_id, active_firm_ids')
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi']),
        ]);

        if (firmalarResult.error) throw firmalarResult.error;
        if (uzmanlarResult.error) throw uzmanlarResult.error;

        const firmalar = (firmalarResult.data ?? []) as Array<Pick<Organization, 'id' | 'name' | 'invite_code' | 'created_at'>>;
        const uzmanlar = (uzmanlarResult.data ?? []) as Array<{
          display_name: string | null;
          active_firm_id: string | null;
          active_firm_ids: string[] | null;
        }>;

        const mapped = await Promise.all(
          firmalar.map(async (firma) => {
            const [personelResult, uygunsuzlukResult] = await Promise.all([
              supabase
                .from('personeller')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', firma.id)
                .is('deleted_at', null),
              supabase
                .from('uygunsuzluklar')
                .select('data')
                .eq('organization_id', firma.id)
                .is('deleted_at', null),
            ]);

            const atananUzman = uzmanlar.find((uzman) => {
              if (uzman.active_firm_id === firma.id) return true;
              return Array.isArray(uzman.active_firm_ids) && uzman.active_firm_ids.includes(firma.id);
            });

            const openCount = ((uygunsuzlukResult.data ?? []) as Array<{ data: JsonData | null }>).filter((row) =>
              isUygunsuzlukOpen(dataString(row.data, 'durum')),
            ).length;

            return {
              id: firma.id,
              name: firma.name,
              inviteCode: firma.invite_code ?? '-',
              personelSayisi: personelResult.count ?? 0,
              uzmanAd: atananUzman?.display_name ?? '-',
              uygunsuzlukSayisi: openCount,
              createdAt: toDateTR(firma.created_at),
            };
          }),
        );

        setRows(mapped);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orgId) return;
    const channel = createRealtimeChannel(`osgb-firmalar-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizations', filter: `parent_org_id=eq.${orgId}` },
        () => void load(true),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, orgId]);

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase('tr-TR');
    if (!q) return rows;
    return rows.filter((row) => row.name.toLocaleLowerCase('tr-TR').includes(q));
  }, [rows, searchText]);

  const addFirma = useCallback(
    async (firmaAdi: string) => {
      if (!orgId) return { error: 'Organizasyon bulunamadı.' };

      const cleaned = firmaAdi.trim();
      if (!cleaned) return { error: 'Firma adı zorunlu.' };

      const { error: insertError } = await supabase.from('organizations').insert({
        name: cleaned,
        parent_org_id: orgId,
        org_type: 'firma',
        is_active: true,
        invite_code: randomInviteCode(),
      });

      if (insertError) return { error: toErrorMessage(insertError) };
      await load(true);
      return { error: null };
    },
    [load, orgId],
  );

  return {
    loading,
    refreshing,
    error,
    rows: filteredRows,
    addFirma,
    refresh: () => load(true),
  };
}

export function useFirmaDetailData(firmaId: string | null) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firma, setFirma] = useState<Organization | null>(null);
  const [personeller, setPersoneller] = useState<PersonelRecord[]>([]);
  const [uygunsuzluklar, setUygunsuzluklar] = useState<UygunsuzlukRecord[]>([]);
  const [tutanaklar, setTutanaklar] = useState<GenericJsonRecord[]>([]);
  const [egitimler, setEgitimler] = useState<GenericJsonRecord[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!firmaId) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [firmaResult, personelResult, uygunsuzlukResult, tutanakResult, egitimResult] = await Promise.all([
          supabase
            .from('organizations')
            .select('id, name, is_active, parent_org_id, org_type, deleted_at, invite_code, created_at')
            .eq('id', firmaId)
            .maybeSingle(),
          supabase
            .from('personeller')
            .select('id, organization_id, deleted_at, data')
            .eq('organization_id', firmaId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('uygunsuzluklar')
            .select('id, organization_id, deleted_at, data')
            .eq('organization_id', firmaId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('tutanaklar')
            .select('id, organization_id, deleted_at, data, created_at')
            .eq('organization_id', firmaId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('egitimler')
            .select('id, organization_id, deleted_at, data, created_at')
            .eq('organization_id', firmaId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

        if (firmaResult.error) throw firmaResult.error;
        if (personelResult.error) throw personelResult.error;
        if (uygunsuzlukResult.error) throw uygunsuzlukResult.error;
        if (tutanakResult.error) throw tutanakResult.error;
        if (egitimResult.error) throw egitimResult.error;

        setFirma((firmaResult.data as Organization | null) ?? null);
        setPersoneller((personelResult.data ?? []) as PersonelRecord[]);
        setUygunsuzluklar((uygunsuzlukResult.data ?? []) as UygunsuzlukRecord[]);
        setTutanaklar((tutanakResult.data ?? []) as GenericJsonRecord[]);
        setEgitimler((egitimResult.data ?? []) as GenericJsonRecord[]);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [firmaId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    refreshing,
    error,
    firma,
    personeller,
    uygunsuzluklar,
    tutanaklar,
    egitimler,
    dataString,
    toDateTR,
    refresh: () => load(true),
  };
}

export function usePersonelData(orgId: string | null) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personeller, setPersoneller] = useState<UserOrganization[]>([]);
  const [firmalar, setFirmalar] = useState<Array<Pick<Organization, 'id' | 'name'>>>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orgId) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [personellerResult, firmalarResult] = await Promise.all([
          supabase
            .from('user_organizations')
            .select('user_id, organization_id, is_active, osgb_role, display_name, email, active_firm_id, active_firm_ids')
            .eq('organization_id', orgId)
            .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi'])
            .order('joined_at', { ascending: false }),
          supabase
            .from('organizations')
            .select('id, name')
            .eq('parent_org_id', orgId)
            .eq('org_type', 'firma')
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
        ]);

        if (personellerResult.error) throw personellerResult.error;
        if (firmalarResult.error) throw firmalarResult.error;

        setPersoneller((personellerResult.data ?? []) as UserOrganization[]);
        setFirmalar((firmalarResult.data ?? []) as Array<Pick<Organization, 'id' | 'name'>>);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orgId) return;
    const channel = createRealtimeChannel(`osgb-personel-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_organizations', filter: `organization_id=eq.${orgId}` },
        () => void load(true),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, orgId]);

  const assignFirmalar = useCallback(
    async (personelUserId: string, selectedIds: string[]) => {
      if (!orgId) return { error: 'Organizasyon bulunamadı.' };

      const { error: updateError } = await supabase
        .from('user_organizations')
        .update({
          active_firm_ids: selectedIds,
          active_firm_id: selectedIds[0] ?? null,
        })
        .eq('organization_id', orgId)
        .eq('user_id', personelUserId);

      if (updateError) return { error: toErrorMessage(updateError) };

      await load(true);
      return { error: null };
    },
    [load, orgId],
  );

  const invitePersonel = useCallback(
    async (payload: { email: string; role: 'gezici_uzman' | 'isyeri_hekimi'; displayName: string }) => {
      if (!orgId) return { error: 'Organizasyon bulunamadı.' };
      if (!payload.email.trim()) return { error: 'E-posta zorunlu.' };

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.VITE_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) return { error: 'Supabase URL tanımlı değil.' };

      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) return { error: 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.' };

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-user-management`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'invite_user',
          email: payload.email.trim().toLowerCase(),
          orgId,
          role: payload.role,
          displayName: payload.displayName,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || body.error) {
        return { error: body.error ?? 'Personel daveti başarısız oldu.' };
      }

      await load(true);
      return { error: null };
    },
    [load, orgId],
  );

  const firmaNameMap = useMemo(() => new Map(firmalar.map((firma) => [firma.id, firma.name])), [firmalar]);

  return {
    loading,
    refreshing,
    error,
    personeller,
    firmalar,
    firmaNameMap,
    assignFirmalar,
    invitePersonel,
    refresh: () => load(true),
  };
}

export function useZiyaretlerData(orgId: string | null) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ziyaretler, setZiyaretler] = useState<OsgbZiyaret[]>([]);
  const [planlar, setPlanlar] = useState<ZiyaretPlani[]>([]);
  const [firmaMap, setFirmaMap] = useState<Map<string, string>>(new Map());

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orgId) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [ziyaretlerResult, planlarResult, firmalarResult] = await Promise.all([
          supabase
            .from('osgb_ziyaretler')
            .select('id, osgb_org_id, firma_org_id, firma_ad, uzman_id, uzman_ad, uzman_email, created_at, bitis_zamani, notlar')
            .eq('osgb_org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('osgb_ziyaret_planlari')
            .select('id, osgb_org_id, firma_org_id, gunler, aktif, notlar')
            .eq('osgb_org_id', orgId)
            .eq('aktif', true)
            .order('created_at', { ascending: false }),
          supabase
            .from('organizations')
            .select('id, name')
            .eq('parent_org_id', orgId)
            .eq('org_type', 'firma')
            .is('deleted_at', null),
        ]);

        if (ziyaretlerResult.error) throw ziyaretlerResult.error;
        if (planlarResult.error) throw planlarResult.error;
        if (firmalarResult.error) throw firmalarResult.error;

        setZiyaretler((ziyaretlerResult.data ?? []) as OsgbZiyaret[]);
        setPlanlar((planlarResult.data ?? []) as ZiyaretPlani[]);
        setFirmaMap(new Map((firmalarResult.data ?? []).map((firma) => [String(firma.id), String(firma.name)])));
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orgId) return;

    const channel = createRealtimeChannel(`osgb-ziyaretler-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'osgb_ziyaretler', filter: `osgb_org_id=eq.${orgId}` },
        () => void load(true),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, orgId]);

  return {
    loading,
    refreshing,
    error,
    ziyaretler,
    planlar,
    firmaMap,
    trDateTime: toDateTimeTR,
    refresh: () => load(true),
  };
}

export function useAyarlarData(orgId: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('OSGB');
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('organizations')
        .select('name, is_active')
        .eq('id', orgId)
        .maybeSingle();

      if (queryError) throw queryError;

      setOrgName(data?.name ?? 'OSGB');
      setIsActive(data?.is_active !== false);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { loading, error, orgName, isActive, refresh: load };
}
