import { useState, useCallback } from 'react';

// Super admin hook — Supabase client kullanmıyor, direkt REST API
// sessionStorage'daki sa_access_token ile istek atıyor

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

function saHeaders() {
  const token = sessionStorage.getItem('sa_access_token') ?? '';
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function saFetch(path: string, options?: Parameters<typeof fetch>[1]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...saHeaders(), ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export interface OrgAdmin {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  subscription_start: string | null;
  subscription_end: string | null;
  is_active: boolean;
  member_count?: number;
  founder_email?: string | null;
}

export function useOrganizationAdmin() {
  const [orgs, setOrgs] = useState<OrgAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Tüm organizasyonları çek
      const orgData: OrgAdmin[] = await saFetch(
        'organizations?select=*&order=created_at.desc'
      );

      // Üye sayılarını çek
      const memberData: { organization_id: string }[] = await saFetch(
        'user_organizations?select=organization_id&is_active=eq.true'
      );

      // Üye sayısı map
      const memberCountMap: Record<string, number> = {};
      (memberData || []).forEach(m => {
        memberCountMap[m.organization_id] = (memberCountMap[m.organization_id] || 0) + 1;
      });

      const enriched: OrgAdmin[] = (orgData || []).map(org => ({
        ...org,
        member_count: memberCountMap[org.id] || 0,
        founder_email: null,
      }));

      setOrgs(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSubscription = useCallback(async (
    orgId: string,
    fields: { subscription_end?: string; is_active?: boolean }
  ) => {
    await saFetch(
      `organizations?id=eq.${orgId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
      }
    );
    await fetchOrgs();
  }, [fetchOrgs]);

  const deleteOrg = useCallback(async (orgId: string) => {
    await saFetch(
      `organizations?id=eq.${orgId}`,
      { method: 'DELETE' }
    );
    await fetchOrgs();
  }, [fetchOrgs]);

  return { orgs, loading, error, fetchOrgs, updateSubscription, deleteOrg };
}
