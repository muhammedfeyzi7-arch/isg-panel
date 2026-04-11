import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AppData } from '../types';

export interface OrgInfo {
  id: string;
  name: string;
  invite_code: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  displayName?: string;
  email?: string;
  orgType: 'firma' | 'osgb';
  osgbRole?: 'osgb_admin' | 'gezici_uzman' | 'isyeri_hekimi' | null;
  /** Gezici uzman: atanmış tüm firma ID'leri */
  activeFirmIds?: string[];
  /** Gezici uzman: şu an aktif firma adı (switcher için) */
  activeFirmName?: string;
}

// ... existing code ...

export function useOrganization(user: User | null) {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // ── isSwitching: firma değişimi devam ediyor mu?
  // true iken tüm DB write operasyonları engellenir (race condition önlemi)
  const [isSwitching, setIsSwitching] = useState(false);
  // ── orgIdRef: INSERT için senkron, her zaman güncel aktif firma ID'si
  // setOrg async, orgIdRef senkron — ref-first pattern
  const orgIdRef = useRef<string | null>(null);
  const autoCreateDoneRef = useRef<string | null>(null);

  // orgIdRef'i org.id değişikliğinde senkron tut
  // NOT: switchActiveFirma içinde orgIdRef ÖNCE güncellenir, sonra setOrg çağrılır
  useEffect(() => {
    if (org?.id) {
      orgIdRef.current = org.id;
    }
  }, [org?.id]);

  const loadOrg = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);

    const timeoutId = setTimeout(() => {
      console.warn('[ISG] loadOrg timeout — unblocking UI');
      setLoadError('Bağlantı zaman aşımına uğradı. Lütfen sayfayı yenileyin.');
      setOrg(null);
      setLoading(false);
    }, 15000);

    const createOrgDirectly = async (): Promise<boolean> => {
      try {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const emailPrefix = user.email?.split('@')[0] ?? 'kullanici';
        const orgName = emailPrefix.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || 'ISG Firması';

        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({ name: orgName, invite_code: inviteCode, created_by: user.id })
          .select()
          .maybeSingle();

        if (orgError || !newOrg) {
          console.error('[ISG] createOrgDirectly: org insert failed:', orgError?.message);
          return false;
        }

        const { error: memberError } = await supabase
          .from('user_organizations')
          .insert({
            user_id: user.id,
            organization_id: newOrg.id,
            role: 'admin',
            display_name: emailPrefix,
            email: user.email ?? '',
            is_active: true,
            must_change_password: false,
          });

        if (memberError) {
          console.error('[ISG] createOrgDirectly: member insert failed:', memberError.message);
          return false;
        }

        await supabase.from('app_data').upsert(
          { organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() },
          { onConflict: 'organization_id' },
        );

        setOrg({
          id: newOrg.id,
          name: newOrg.name,
          invite_code: newOrg.invite_code,
          role: 'admin',
          isActive: true,
          mustChangePassword: false,
          displayName: emailPrefix,
          email: user.email ?? undefined,
          orgType: 'firma',
          osgbRole: null,
        });
        return true;
      } catch (e) {
        console.error('[ISG] createOrgDirectly exception:', e);
        return false;
      }
    };

    const loadViaEdgeFunction = async (): Promise<boolean> => {
      try {
        clearTimeout(timeoutId);
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) return false;
        const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
        const res = await fetch(`${supabaseUrl}/functions/v1/setup-organization`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error('[ISG] loadViaEdgeFunction failed:', res.status, errText);
          return false;
        }
        const resData = await res.json() as {
          organization?: { id: string; name: string; invite_code: string; org_type?: string };
          role?: string;
          is_active?: boolean;
          must_change_password?: boolean;
          display_name?: string;
          email?: string;
          created?: boolean;
          osgb_role?: string | null;
        };
        if (resData?.organization) {
          setOrg({
            id: resData.organization.id,
            name: resData.organization.name,
            invite_code: resData.organization.invite_code,
            role: resData.role ?? 'admin',
            isActive: resData.is_active !== false,
            mustChangePassword: resData.must_change_password === true,
            displayName: resData.display_name ?? undefined,
            email: resData.email ?? undefined,
            orgType: (resData.organization.org_type === 'osgb' ? 'osgb' : 'firma') as 'firma' | 'osgb',
            osgbRole: (resData.osgb_role as 'osgb_admin' | 'gezici_uzman' | null) ?? null,
          });
          return true;
        }
        return false;
      } catch (e) {
        console.error('[ISG] loadViaEdgeFunction exception:', e);
        return false;
      }
    };

    try {
      // OSGB org'u olan kayıtları önce getir (org_type sıralaması için organizations join gerekiyor)
      // Önce osgb_role'u olan kaydı dene, yoksa normal kaydı al
      const { data: osgbData, error: osgbError } = await supabase
        .from('user_organizations')
        .select('role, is_active, must_change_password, display_name, email, osgb_role, active_firm_id, active_firm_ids, organizations!user_organizations_organization_id_fkey(id, name, invite_code, org_type)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .not('osgb_role', 'is', null)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // osgb_role'lu kayıt varsa onu kullan, yoksa normal sorguya düş
      const { data, error } = (osgbData && !osgbError)
        ? { data: osgbData, error: null }
        : await supabase
            .from('user_organizations')
            .select('role, is_active, must_change_password, display_name, email, osgb_role, active_firm_id, active_firm_ids, organizations!user_organizations_organization_id_fkey(id, name, invite_code, org_type)')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        console.warn('[ISG] loadOrg RLS error, falling back to edge function:', error.message);
        const ok = await loadViaEdgeFunction();
        if (!ok) {
          setLoadError(error.message);
          setOrg(null);
        }
        setLoading(false);
        return;
      }

      if (data && data.organizations) {
        const rawOrg = data.organizations;
        const o = (Array.isArray(rawOrg) ? rawOrg[0] : rawOrg) as { id: string; name: string; invite_code: string; org_type?: string };

        if (data.osgb_role === 'gezici_uzman') {
          // ── Gezici Uzman: Multi-Firma Switcher Modeli ──────────────────
          // active_firm_ids: atanmış tüm firmalar
          // active_firm_id:  switcher'dan seçilen aktif firma
          //                  NULL ise → active_firm_ids[0] default atanır

          const rawIds = (data as Record<string, unknown>).active_firm_ids;
          const firmIds: string[] = Array.isArray(rawIds) && rawIds.length > 0
            ? (rawIds as string[]).filter(Boolean)
            : data.active_firm_id ? [data.active_firm_id] : [];

          if (firmIds.length === 0) {
            // Hiç firma atanmamış — OSGB org'una düş
            setOrg({
              id: o.id,
              name: o.name,
              invite_code: o.invite_code,
              role: data.role ?? 'member',
              isActive: data.is_active !== false,
              mustChangePassword: data.must_change_password === true,
              displayName: data.display_name ?? undefined,
              email: data.email ?? undefined,
              orgType: (o.org_type === 'osgb' ? 'osgb' : 'firma') as 'firma' | 'osgb',
              osgbRole: 'gezici_uzman',
              activeFirmIds: [],
            });
            setLoading(false);
            return;
          }

          // ── Aktif firma belirleme: DB'deki active_firm_id → fallback: firmIds[0] ──
          const rawActiveFirmId = (data as Record<string, unknown>).active_firm_id as string | null;
          // Geçerli bir active_firm_id varsa kullan, yoksa ilkini al
          const resolvedActiveFirmId = (rawActiveFirmId && firmIds.includes(rawActiveFirmId))
            ? rawActiveFirmId
            : firmIds[0];

          // active_firm_id DB'de NULL ise veya geçersizse → güncelle
          if (resolvedActiveFirmId !== rawActiveFirmId) {
            console.log(`[ISG] gezici_uzman: active_firm_id NULL/invalid, setting to ${resolvedActiveFirmId}`);
            supabase
              .from('user_organizations')
              .update({ active_firm_id: resolvedActiveFirmId })
              .eq('user_id', user.id)
              .eq('is_active', true)
              .eq('osgb_role', 'gezici_uzman')
              .then(({ error: updErr }) => {
                if (updErr) console.warn('[ISG] active_firm_id auto-set failed:', updErr.message);
              });
          }

          // Aktif firmanın org bilgisini çek
          const { data: firmaOrg } = await supabase
            .from('organizations')
            .select('id, name, invite_code, org_type')
            .eq('id', resolvedActiveFirmId)
            .maybeSingle();

          if (firmaOrg) {
            setOrg({
              id: firmaOrg.id,          // ← Her zaman aktif firma ID'si
              name: firmaOrg.name,
              invite_code: firmaOrg.invite_code,
              role: 'member',
              isActive: data.is_active !== false,
              mustChangePassword: data.must_change_password === true,
              displayName: data.display_name ?? undefined,
              email: data.email ?? undefined,
              orgType: 'firma',
              osgbRole: 'gezici_uzman',
              activeFirmIds: firmIds,    // ← Tüm atanmış firmalar (switcher için)
              activeFirmName: firmaOrg.name,
            });
            setLoading(false);
            return;
          }

          // Aktif firma bilgisi çekilemedi — ilk firmaya fallback
          setOrg({
            id: resolvedActiveFirmId,
            name: 'Firma',
            invite_code: '',
            role: 'member',
            isActive: data.is_active !== false,
            mustChangePassword: data.must_change_password === true,
            displayName: data.display_name ?? undefined,
            email: data.email ?? undefined,
            orgType: 'firma',
            osgbRole: 'gezici_uzman',
            activeFirmIds: firmIds,
          });
          setLoading(false);
          return;
        }

        // ── İşyeri Hekimi: Multi-Firma Modeli ─────────────────────────────
        if (data.osgb_role === 'isyeri_hekimi') {
          const rawIds = (data as Record<string, unknown>).active_firm_ids;
          const firmIds: string[] = Array.isArray(rawIds) && rawIds.length > 0
            ? (rawIds as string[]).filter(Boolean)
            : data.active_firm_id ? [data.active_firm_id] : [];

          if (firmIds.length === 0) {
            // Firma atanmamış — OSGB org'una düş, hekim bekleme ekranı gösterilir
            setOrg({
              id: o.id,
              name: o.name,
              invite_code: o.invite_code,
              role: data.role ?? 'member',
              isActive: data.is_active !== false,
              mustChangePassword: data.must_change_password === true,
              displayName: data.display_name ?? undefined,
              email: data.email ?? undefined,
              orgType: (o.org_type === 'osgb' ? 'osgb' : 'firma') as 'firma' | 'osgb',
              osgbRole: 'isyeri_hekimi',
              activeFirmIds: [],
            });
            setLoading(false);
            return;
          }

          // Hekim: ilk firmanın ID'sini kullan (tüm firmalar HekimPage'de gösterilecek)
          const primaryFirmId = firmIds[0];
          const { data: firmaOrg } = await supabase
            .from('organizations')
            .select('id, name, invite_code, org_type')
            .eq('id', primaryFirmId)
            .maybeSingle();

          setOrg({
            id: firmaOrg?.id ?? primaryFirmId,
            name: firmaOrg?.name ?? 'Hekim',
            invite_code: firmaOrg?.invite_code ?? '',
            role: 'member',
            isActive: data.is_active !== false,
            mustChangePassword: data.must_change_password === true,
            displayName: data.display_name ?? undefined,
            email: data.email ?? undefined,
            orgType: 'firma',
            osgbRole: 'isyeri_hekimi',
            activeFirmIds: firmIds,
          });
          setLoading(false);
          return;
        }

        // ── Normal kullanıcı ───────────────────────────────────────────────
        setOrg({
          id: o.id,
          name: o.name,
          invite_code: o.invite_code,
          role: data.role ?? 'admin',
          isActive: data.is_active !== false,
          mustChangePassword: data.must_change_password === true,
          displayName: data.display_name ?? undefined,
          email: data.email ?? undefined,
          orgType: (o.org_type === 'osgb' ? 'osgb' : 'firma') as 'firma' | 'osgb',
          osgbRole: (data.osgb_role as 'osgb_admin' | 'gezici_uzman' | null) ?? null,
        });
      } else {
        const ok = await loadViaEdgeFunction();
        if (!ok) {
          const fallbackOk = await createOrgDirectly();
          if (!fallbackOk) {
            setOrg(null);
          }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[ISG] loadOrg exception:', err);
      const ok = await loadViaEdgeFunction();
      if (!ok) {
        setLoadError(err instanceof Error ? err.message : String(err));
        setOrg(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrg();
    autoCreateDoneRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const generateInviteCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const migrateLegacyData = async (userId: string, organizationId: string) => {
    try {
      const raw = localStorage.getItem(`isg_data_${userId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AppData>;
      if (!parsed || typeof parsed !== 'object') return;
      const slim = {
        ...parsed,
        evraklar: (parsed.evraklar ?? []).map((e: Record<string, unknown>) => { const { dosyaVeri: _d, ...r } = e; return r; }),
        egitimler: (parsed.egitimler ?? []).map((e: Record<string, unknown>) => { const { belgeDosyaVeri: _d, ...r } = e; return r; }),
        ekipmanlar: (parsed.ekipmanlar ?? []).map((e: Record<string, unknown>) => { const { dosyaVeri: _d, ...r } = e; return r; }),
        tutanaklar: (parsed.tutanaklar ?? []).map((t: Record<string, unknown>) => { const { dosyaVeri: _d, ...r } = t; return r; }),
      };
      await supabase.from('app_data').upsert({
        organization_id: organizationId,
        data: slim as object,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // silent
    }
  };

  // ── Aktif firma değiştir (Gezici Uzman Switcher) ───────────────────────────
  // REF-FIRST PATTERN:
  // 1. orgIdRef.current = newId   (SENKRON — INSERT için anında doğru)
  // 2. isSwitching = true         (UI lock — kullanıcı INSERT yapamaz)
  // 3. DB update (await)          (Persist)
  // 4. firmaOrg fetch             (Firma adı)
  // 5. setOrg(...)                (UI güncelle)
  // 6. isSwitching = false        (UI lock kaldır)
  const switchActiveFirma = useCallback(async (firmaId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Kullanıcı bulunamadı.' };
    if (!org?.activeFirmIds?.includes(firmaId)) {
      return { error: 'Bu firmaya erişim yetkiniz yok.' };
    }
    if (isSwitching) {
      return { error: 'Firma değişimi devam ediyor, lütfen bekleyin.' };
    }

    // ADIM 1: orgIdRef ANINDA güncelle (senkron) — INSERT güvenliği
    orgIdRef.current = firmaId;

    // ADIM 2: UI lock başlat
    setIsSwitching(true);

    try {
      // ADIM 3: DB'ye persist et
      const { error: dbError } = await supabase
        .from('user_organizations')
        .update({ active_firm_id: firmaId })
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('osgb_role', 'gezici_uzman');

      if (dbError) {
        // Rollback: ref'i geri al
        orgIdRef.current = org.id;
        console.error('[ISG] switchActiveFirma DB error:', dbError.message);
        return { error: dbError.message };
      }

      // ADIM 4: Firma bilgisini çek
      const { data: firmaOrg } = await supabase
        .from('organizations')
        .select('id, name, invite_code, org_type')
        .eq('id', firmaId)
        .maybeSingle();

      if (!firmaOrg) {
        orgIdRef.current = org.id;
        return { error: 'Firma bulunamadı.' };
      }

      // ADIM 5: UI state güncelle (async, ref zaten doğru)
      setOrg(prev => prev ? {
        ...prev,
        id: firmaOrg.id,
        name: firmaOrg.name,
        invite_code: firmaOrg.invite_code,
        orgType: 'firma',
        activeFirmName: firmaOrg.name,
      } : null);

      console.log(`[ISG] switchActiveFirma → ${firmaId} (${firmaOrg.name}) [ref-first ✓]`);
      return { error: null };
    } catch (e) {
      // Exception: rollback ref
      orgIdRef.current = org.id;
      return { error: String(e) };
    } finally {
      // ADIM 6: UI lock kaldır
      setIsSwitching(false);
    }
  }, [user, org, isSwitching]);

  // ── Atanmış firmaların adlarını çek (switcher dropdown için) ──────────────
  const fetchActiveFirmNames = useCallback(async (): Promise<{ id: string; name: string }[]> => {
    if (!org?.activeFirmIds?.length) return [];
    const { data } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', org.activeFirmIds);
    return (data ?? []) as { id: string; name: string }[];
  }, [org?.activeFirmIds]);

  const createOrg = async (name: string, userId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Kullanıcı bulunamadı.' };
    try {
      const inviteCode = generateInviteCode();
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name, invite_code: inviteCode, created_by: user.id })
        .select()
        .maybeSingle();

      if (orgError || !newOrg) return { error: orgError?.message ?? 'Organizasyon oluşturulamadı.' };

      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: newOrg.id,
          role: 'admin',
          email: user.email ?? '',
          is_active: true,
          must_change_password: false,
        });

      if (memberError) return { error: memberError.message };

      await supabase.from('app_data').upsert(
        { organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' },
      );
      await migrateLegacyData(userId, newOrg.id);
      await loadOrg();
      return { error: null };
    } catch (e) {
      return { error: String(e) };
    }
  };

  const joinOrg = async (inviteCode: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Kullanıcı bulunamadı.' };
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return { error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' };

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/join-organization`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });

      const data = await res.json() as { error?: string; success?: boolean };

      if (res.status === 429) {
        return { error: data.error ?? 'Çok fazla deneme yaptınız. Lütfen 1 dakika bekleyin.' };
      }

      if (!res.ok || data.error) {
        return { error: data.error ?? 'Organizasyona katılırken hata oluştu.' };
      }

      await loadOrg();
      return { error: null };
    } catch (e) {
      return { error: String(e) };
    }
  };

  const regenerateInviteCode = async (): Promise<{ error: string | null; newCode?: string }> => {
    if (!org) return { error: 'Organizasyon bulunamadı.' };
    if (org.role !== 'admin') return { error: 'Sadece admin davet kodunu yenileyebilir.' };
    try {
      const newCode = generateInviteCode();
      const { error } = await supabase
        .from('organizations')
        .update({ invite_code: newCode })
        .eq('id', org.id);
      if (error) return { error: error.message };
      await loadOrg();
      return { error: null, newCode };
    } catch (e) {
      return { error: String(e) };
    }
  };

  const clearMustChangePassword = async (): Promise<void> => {
    if (!user) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return;

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/setup-organization`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'clear_must_change_password' }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[clearMustChangePassword] Edge function failed:', res.status, errText);
        return;
      }

      setOrg(prev => prev ? { ...prev, mustChangePassword: false } : null);
    } catch (e) {
      console.error('[clearMustChangePassword] exception:', e);
    }
  };

  return {
    org,
    loading,
    loadError,
    isSwitching,
    orgIdRef,
    createOrg,
    joinOrg,
    regenerateInviteCode,
    refetch: loadOrg,
    clearMustChangePassword,
    switchActiveFirma,
    fetchActiveFirmNames,
  };
}
