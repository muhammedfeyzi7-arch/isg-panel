import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AuthSession, MemberRole } from '@/types/database';

export interface LoginCredentials { email: string; password: string }

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: 'specialist' | 'doctor';
  organizationId: string;
  specializationClass?: string;
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  if (!isSupabaseConfigured()) throw new Error('Supabase bağlı değil');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    // Supabase hata mesajlarını Türkçeye çevir
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      throw new Error('E-posta veya şifre hatalı.');
    }
    if (msg.includes('email not confirmed')) {
      throw new Error('E-posta adresiniz doğrulanmamış.');
    }
    if (msg.includes('too many requests')) {
      throw new Error('Çok fazla deneme yapıldı. Lütfen bekleyin.');
    }
    throw new Error(error.message);
  }

  if (!data.user || !data.session) throw new Error('Giriş başarısız. Lütfen tekrar deneyin.');

  // Token'ın client'a yazılması için kısa bir bekleme
  await new Promise((resolve) => setTimeout(resolve, 100));

  return resolveSession(data.user.id);
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── Get current session ──────────────────────────────────────────────────────
export async function getCurrentSession(): Promise<AuthSession | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  try { return await resolveSession(data.session.user.id); } catch { return null; }
}

// ─── Resolve session from profiles table ─────────────────────────────────────
async function resolveSession(userId: string): Promise<AuthSession> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, organization_id, role, status')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error('Profil bulunamadı. Lütfen yöneticinizle iletişime geçin.');
  if (profile.status === 'passive') throw new Error('Hesabınız pasif durumda. Yöneticinizle iletişime geçin.');

  // Organization adını ayrı sorguda çek
  let orgName = '';
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .maybeSingle();
    orgName = org?.name ?? '';
  } catch { /* org adı kritik değil, devam et */ }

  return {
    userId,
    email: profile.email,
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    organizationName: orgName,
    role: profile.role,
    status: profile.status,
  };
}

// ─── Create user (via Edge Function — server-side) ────────────────────────────
export async function createUser(payload: CreateUserPayload): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase bağlı değil');

  const { data, error } = await supabase.functions.invoke('create-user', { body: payload });

  if (error) {
    // FunctionsHttpError: gerçek hata mesajı context.json() içinde
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any).context;
      if (ctx) {
        const json = typeof ctx.json === 'function' ? await ctx.json() : null;
        if (json?.error) throw new Error(json.error);
      }
    } catch (innerErr) {
      if (innerErr instanceof Error && innerErr.message !== error.message) {
        throw innerErr;
      }
    }
    throw new Error(data?.error ?? error.message ?? 'Kullanıcı oluşturulamadı');
  }

  if (data?.error) {
    throw new Error(data.error);
  }
}

// ─── List org profiles ────────────────────────────────────────────────────────
export async function listOrgProfiles(organizationId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Update profile (admin) ───────────────────────────────────────────────────
export async function updateProfile(
  id: string,
  payload: { role?: MemberRole; status?: 'active' | 'passive'; fullName?: string; phone?: string }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (payload.role !== undefined) update.role = payload.role;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.fullName !== undefined) update.full_name = payload.fullName;
  if (payload.phone !== undefined) update.phone = payload.phone;

  const { error } = await supabase.from('profiles').update(update).eq('id', id);
  if (error) throw new Error(error.message);
}
