import { useState, useEffect, useCallback } from 'react';
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

  const loadOrg = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_organizations')
        .select('role, is_active, must_change_password, display_name, email, organizations(id, name, invite_code)')
        .eq('user_id', user.id)
        .maybeSingle();

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
    } catch {
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

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

      await migrateLegacyData(userId, newOrg.id);
      await loadOrg();
      return { error: null };
    } catch (e) {
      return { error: String(e) };
    }
  };

  const autoCreateOrg = async (): Promise<void> => {
    if (!user) return;
    try {
      const inviteCode = generateInviteCode();
      const orgName = user.email
        ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() || 'Firmam'
        : 'Firmam';
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName, invite_code: inviteCode, created_by: user.id })
        .select()
        .maybeSingle();

      if (orgError || !newOrg) return;

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

      if (memberError) return;

      await migrateLegacyData(user.id, newOrg.id);
      await loadOrg();
    } catch {
      // Silent fail
    }
  };

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
    createOrg,
    joinOrg,
    regenerateInviteCode,
    refetch: loadOrg,
    autoCreateOrg,
    clearMustChangePassword,
  };
}
