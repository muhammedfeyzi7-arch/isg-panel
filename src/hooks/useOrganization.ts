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
  const autoCreateInProgressRef = useRef(false);
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
    }, 12000);

    // Helper: load via edge function (bypasses RLS entirely — always reliable)
    const loadViaEdgeFunction = async (): Promise<boolean> => {
      try {
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
        if (!res.ok) return false;
        const resData = await res.json() as {
          organization?: { id: string; name: string; invite_code: string };
          role?: string;
          is_active?: boolean;
          must_change_password?: boolean;
          display_name?: string;
          email?: string;
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
      } catch {
        return false;
      }
    };

    try {
      // PRIMARY: Try direct Supabase query first (fast path)
      const { data, error } = await supabase
        .from('user_organizations')
        .select('role, is_active, must_change_password, display_name, email, organizations(id, name, invite_code)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        // RLS error (infinite recursion, permission denied, etc.)
        // FALLBACK: Use edge function which uses service role key — bypasses RLS
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
        // No org found via direct query — try edge function (it will create one if needed)
        console.log('[ISG] loadOrg: no org found, trying edge function');
        await loadViaEdgeFunction();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[ISG] loadOrg exception:', err);
      // Last resort: edge function
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

  const autoCreateOrg = useCallback(async (): Promise<void> => {
    if (!user) return;
    if (autoCreateInProgressRef.current) {
      console.log('[ISG] autoCreateOrg already in progress, skipping');
      return;
    }
    if (autoCreateDoneRef.current === user.id) {
      console.log('[ISG] autoCreateOrg already ran for this user, skipping');
      return;
    }

    autoCreateInProgressRef.current = true;
    autoCreateDoneRef.current = user.id;

    try {
      // Always use edge function — it uses service role key, bypasses RLS entirely.
      // This avoids infinite recursion in user_organizations RLS policies.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        console.error('[ISG] autoCreateOrg: no session');
        autoCreateDoneRef.current = null;
        return;
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/setup-organization`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        console.log('[ISG] autoCreateOrg: edge function succeeded');
        await loadOrg();
      } else {
        const errText = await res.text();
        console.error('[ISG] autoCreateOrg: edge function failed:', errText);
        autoCreateDoneRef.current = null;
      }
    } catch (err) {
      console.error('[ISG] autoCreateOrg exception:', err);
      autoCreateDoneRef.current = null;
    } finally {
      autoCreateInProgressRef.current = false;
    }
  }, [user, loadOrg]);

  const joinOrg = async (inviteCode: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Kullanıcı bulunamadı.' };
    try {
      const { data: targetOrg } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .maybeSingle();

      if (!targetOrg) return { error: 'Geçersiz davet kodu.' };

      // Check if already a member
      const { data: alreadyMember } = await supabase
        .from('user_organizations')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', targetOrg.id)
        .maybeSingle();

      if (alreadyMember) return { error: 'Bu organizasyona zaten üyesiniz.' };

      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: targetOrg.id,
          role: 'member',
          email: user.email ?? '',
          is_active: true,
          must_change_password: false,
        });

      if (memberError) {
        if (memberError.message.includes('duplicate')) return { error: 'Bu organizasyona zaten üyesiniz.' };
        return { error: memberError.message };
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
    autoCreateOrg,
    clearMustChangePassword,
  };
}
