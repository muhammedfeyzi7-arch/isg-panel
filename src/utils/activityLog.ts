import { supabase } from '../lib/supabase';

export interface ActivityLogPayload {
  organizationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  actionType: string;
  module?: string;
  recordId?: string;
  recordName?: string;
  description?: string;
}

/**
 * Writes an activity log entry to the activity_logs table.
 *
 * MİMARİ NOT (Multi-firma):
 * - DB trigger'ları kaldırıldı — organization_id artık frontend'den explicit gelir
 * - organization_id = org.id (aktif firma — switcher'dan seçilen)
 * - RLS WITH CHECK: can_access_org(organization_id) ile doğrulanır
 * - Yanlış org_id gönderilirse RLS reddeder (403) → veri tutarlılığı garanti
 *
 * SECURITY:
 * - user_id her zaman auth.uid() — client'tan gelen userId asla kullanılmaz
 * - organizationId RLS'de can_access_org() ile sunucu tarafında doğrulanır
 */
export async function logActivity(payload: ActivityLogPayload): Promise<void> {
  try {
    // organizationId boşsa log yaz — veriyi yanlış org'a yazmaktan daha iyi
    if (!payload.organizationId) {
      console.warn('[ISG] logActivity: organizationId empty, skipping log');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return; // Oturum yok — log atla

    const { error } = await supabase.from('activity_logs').insert({
      // organization_id: aktif firmadan geliyor (DB trigger override etmiyor artık)
      organization_id: payload.organizationId,
      user_id: user.id,           // Her zaman auth.uid() — payload'dan asla
      user_email: payload.userEmail,
      user_name: payload.userName,
      user_role: payload.userRole,
      action_type: payload.actionType,
      module: payload.module ?? null,
      record_id: payload.recordId ?? null,
      record_name: payload.recordName ?? null,
      description: payload.description ?? null,
    });

    if (error) {
      // can_access_org false ise RLS reddeder — bu durumda organizationId yanlış demektir
      console.warn('[ISG] Activity log write failed:', error.message, '| orgId:', payload.organizationId);
    }
  } catch (err) {
    console.warn('[ISG] Activity log exception:', err);
  }
}

export const ACTION_LABELS: Record<string, string> = {
  user_login: 'Giriş Yapıldı',
  user_created: 'Kullanıcı Oluşturuldu',
  password_changed: 'Şifre Değiştirildi',
  firma_created: 'Firma Oluşturuldu',
  firma_updated: 'Firma Güncellendi',
  firma_deleted: 'Firma Silindi',
  personel_created: 'Personel Eklendi',
  personel_updated: 'Personel Güncellendi',
  personel_deleted: 'Personel Silindi',
  evrak_created: 'Evrak Eklendi',
  evrak_deleted: 'Evrak Silindi',
  tutanak_created: 'Tutanak Oluşturuldu',
  egitim_created: 'Eğitim Eklendi',
  gorev_created: 'Görev Oluşturuldu',
  uygunsuzluk_created: 'Uygunsuzluk Oluşturuldu',
  uygunsuzluk_closed: 'Uygunsuzluk Kapatıldı',
};

export const ACTION_COLORS: Record<string, { bg: string; color: string; icon: string }> = {
  user_login: { bg: 'rgba(99,102,241,0.1)', color: '#818CF8', icon: 'ri-login-circle-line' },
  user_created: { bg: 'rgba(16,185,129,0.1)', color: '#10B981', icon: 'ri-user-add-line' },
  password_changed: { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B', icon: 'ri-lock-password-line' },
  firma_created: { bg: 'rgba(59,130,246,0.1)', color: '#60A5FA', icon: 'ri-building-2-line' },
  firma_updated: { bg: 'rgba(59,130,246,0.08)', color: '#60A5FA', icon: 'ri-edit-2-line' },
  firma_deleted: { bg: 'rgba(239,68,68,0.1)', color: '#F87171', icon: 'ri-delete-bin-6-line' },
  personel_created: { bg: 'rgba(34,197,94,0.1)', color: '#4ADE80', icon: 'ri-user-add-line' },
  personel_updated: { bg: 'rgba(34,197,94,0.08)', color: '#4ADE80', icon: 'ri-user-settings-line' },
  personel_deleted: { bg: 'rgba(239,68,68,0.1)', color: '#F87171', icon: 'ri-user-unfollow-line' },
  evrak_created: { bg: 'rgba(168,85,247,0.1)', color: '#C084FC', icon: 'ri-file-add-line' },
  evrak_deleted: { bg: 'rgba(239,68,68,0.1)', color: '#F87171', icon: 'ri-file-damage-line' },
  tutanak_created: { bg: 'rgba(249,115,22,0.1)', color: '#FB923C', icon: 'ri-file-text-line' },
  egitim_created: { bg: 'rgba(20,184,166,0.1)', color: '#2DD4BF', icon: 'ri-graduation-cap-line' },
  gorev_created: { bg: 'rgba(251,191,36,0.1)', color: '#FCD34D', icon: 'ri-task-line' },
  uygunsuzluk_created: { bg: 'rgba(239,68,68,0.1)', color: '#F87171', icon: 'ri-alert-line' },
  uygunsuzluk_closed: { bg: 'rgba(16,185,129,0.1)', color: '#4ADE80', icon: 'ri-checkbox-circle-line' },
};
