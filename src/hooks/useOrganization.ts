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
}

function getLegacyStorageKey(userId: string): string {
  return `isg_data_${userId}`;
}

export function useOrganization(user: User | null) {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const autoCreateDoneRef = useRef<string | null>(null);

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

    // Helper: create org directly via Supabase client (fallback when edge function fails)
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
        });
        return true;
      } catch (e) {
        console.error('[ISG] createOrgDirectly exception:', e);
        return false;
      }
    };

    // Helper: load/create via edge function (uses service role key — bypasses RLS, auto-creates org if needed)
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
          organization?: { id: string; name: string; invite_code: string };
          role?: string;
          is_active?: boolean;
          must_change_password?: boolean;
          display_name?: string;
          email?: string;
          created?: boolean;
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
      // PRIMARY: Try direct Supabase query first (fast path)
      const { data, error } = await supabase
        .from('user_organizations')
        .select('role, is_active, must_change_password, display_name, email, organizations(id, name, invite_code)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        // RLS error — fallback to edge function
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
        const o = data.organizations as { id: string; name: string; invite_code: string };
        setOrg({
          id: o.id,
          name: o.name,
          invite_code: o.invite_code,
          role: data.role ?? 'admin',
          isActive: data.is_active !== false,
          mustChangePassword: data.must_change_password === true,
          displayName: data.display_name ?? undefined,
          email: data.email ?? undefined,
        });
      } else {
        // No org found — try edge function first (auto-creates org + admin membership)
        const ok = await loadViaEdgeFunction();
        if (!ok) {
          // Edge function failed — fallback: create org directly via Supabase client
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
      const raw = localStorage.getItem(getLegacyStorageKey(userId));
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
      await supabase
        .from('app_data')
        .upsert({
          organization_id: organizationId,
          data: slim as object,
          updated_at: new Date().toISOString(),
        });
    } catch {
      // Migration failed silently
    }
  };

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
    if (!user || !org) return;
    try {
      await supabase
        .from('user_organizations')
        .update({ must_change_password: false })
        .eq('user_id', user.id)
        .eq('organization_id', org.id);
      setOrg(prev => prev ? { ...prev, mustChangePassword: false } : null);
    } catch {
      // silent
    }
  };

  return {
    org,
    loading,
    loadError,
    createOrg,
    joinOrg,
    regenerateInviteCode,
    refetch: loadOrg,
    clearMustChangePassword,
  };
}
