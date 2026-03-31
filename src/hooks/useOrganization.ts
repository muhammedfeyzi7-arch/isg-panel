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
  const autoCreateDoneRef = useRef<string | null>(null); // tracks userId for which autoCreate ran

  const loadOrg = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);

    // Safety timeout: if Supabase hangs > 12s, unblock the UI
    const timeoutId = setTimeout(() => {
      console.warn('[ISG] loadOrg timeout — unblocking UI');
      setLoadError('Bağlantı zaman aşımına uğradı. Lütfen sayfayı yenileyin.');
      setOrg(null);
      setLoading(false);
    }, 12000);
    try {
      // CRITICAL: ORDER BY joined_at ASC to ALWAYS get the oldest/original org.
      // Without this, maybeSingle() is non-deterministic and may return different
      // orgs on different logins — causing data to appear "lost" when actually
      // the user has multiple orgs and data is in a different one.
      const { data, error } = await supabase
        .from('user_organizations')
        .select('role, is_active, must_change_password, display_name, email, organizations(id, name, invite_code)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        console.error('[ISG] loadOrg error:', error.message);
        setLoadError(error.message);
      }

      if (data && data.organizations) {
        const o = data.organizations as { id: string; name: string; invite_code: string };
        setOrg({
          id: o.id,
          name: o.name,
          invite_code: o.invite_code,
          role: data.role ?? 'member',
          isActive: data.is_active !== false,
          mustChangePassword: data.must_change_password === true,
          displayName: data.display_name ?? undefined,
          email: data.email ?? undefined,
        });
      } else {
        setOrg(null);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[ISG] loadOrg exception:', err);
      setLoadError(err instanceof Error ? err.message : String(err));
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrg();
    // Reset autoCreate tracking when user changes
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
    // CRITICAL: Prevent multiple simultaneous calls
    if (autoCreateInProgressRef.current) {
      console.log('[ISG] autoCreateOrg already in progress, skipping');
      return;
    }
    // CRITICAL: Only run once per user session
    if (autoCreateDoneRef.current === user.id) {
      console.log('[ISG] autoCreateOrg already ran for this user, skipping');
      return;
    }

    autoCreateInProgressRef.current = true;
    autoCreateDoneRef.current = user.id;

    try {
      // CRITICAL: Check if user ALREADY has an org before creating a new one.
      // ALSO check for errors — maybeSingle() returns data=null for BOTH empty result AND error.
      const { data: existingMembership, error: memberCheckError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberCheckError) {
        // Query failed — user might already have an org but we can't confirm.
        // Safe approach: try to reload. If org loads, great. If not, we'll try again next session.
        console.warn('[ISG] autoCreateOrg: membership check failed, attempting reload:', memberCheckError.message);
        await loadOrg();
        return;
      }

      if (existingMembership) {
        console.log('[ISG] autoCreateOrg: user already has org, reloading...');
        await loadOrg();
        return;
      }

      console.log('[ISG] autoCreateOrg: creating new org for user', user.id);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        console.error('[ISG] autoCreateOrg: no valid session, aborting', sessionError?.message);
        autoCreateDoneRef.current = null; // allow retry on next load
        return;
      }

      const inviteCode = generateInviteCode();
      const orgName = user.email
        ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() || 'Firmam'
        : 'Firmam';
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName, invite_code: inviteCode, created_by: user.id })
        .select()
        .maybeSingle();

      if (orgError || !newOrg) {
        console.error('[ISG] autoCreateOrg org insert error:', orgError?.message);
        // Could be a race condition (two tabs). Try to reload existing org.
        await loadOrg();
        return;
      }

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

      if (memberError) {
        console.error('[ISG] autoCreateOrg member insert error:', memberError.message);
        // CRITICAL: Even if membership insert failed (e.g. UNIQUE constraint — user already
        // has another org), try to load whatever org exists. Never leave org=null silently.
        await loadOrg();
        return;
      }

      await supabase.from('app_data').upsert(
        { organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' },
      );
      await migrateLegacyData(user.id, newOrg.id);
      await loadOrg();
      console.log('[ISG] autoCreateOrg: org created and loaded successfully ✓');
    } catch (err) {
      console.error('[ISG] autoCreateOrg exception:', err);
      // Last resort: try loading whatever org might exist
      try { await loadOrg(); } catch { /* ignore */ }
    } finally {
      autoCreateInProgressRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadOrg]);

  const joinOrg = async (inviteCode: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Kullanıcı bulunamadı.' };
    try {
      const { data: targetOrg } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .maybeSingle();

      if (!targetOrg) return { error: 'Geçersiz davet kodu.' };

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
