import { supabase } from './supabase';

export type ActionType =
  | 'user_login'
  | 'user_created'
  | 'password_changed'
  | 'document_added'
  | 'document_deleted'
  | 'tutanak_created'
  | 'tutanak_updated'
  | 'firma_created'
  | 'firma_updated'
  | 'firma_deleted'
  | 'personel_created'
  | 'personel_updated'
  | 'personel_deleted'
  | 'user_deactivated'
  | 'user_activated';

export interface LogEntry {
  id: string;
  organization_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  action_type: ActionType;
  module: string | null;
  record_id: string | null;
  record_name: string | null;
  description: string | null;
  created_at: string;
}

export interface LogParams {
  organizationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  actionType: ActionType;
  module?: string;
  recordId?: string;
  recordName?: string;
  description?: string;
}

export async function logActivity(params: LogParams): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      user_email: params.userEmail,
      user_name: params.userName,
      user_role: params.userRole,
      action_type: params.actionType,
      module: params.module ?? null,
      record_id: params.recordId ?? null,
      record_name: params.recordName ?? null,
      description: params.description ?? null,
    });
  } catch {
    // Silent — log failure never breaks the app
  }
}

export const ACTION_LABELS: Record<ActionType, string> = {
  user_login: 'Giriş yapıldı',
  user_created: 'Kullanıcı oluşturuldu',
  password_changed: 'Şifre değiştirildi',
  document_added: 'Evrak eklendi',
  document_deleted: 'Evrak silindi',
  tutanak_created: 'Tutanak oluşturuldu',
  tutanak_updated: 'Tutanak güncellendi',
  firma_created: 'Firma eklendi',
  firma_updated: 'Firma güncellendi',
  firma_deleted: 'Firma silindi',
  personel_created: 'Personel eklendi',
  personel_updated: 'Personel güncellendi',
  personel_deleted: 'Personel silindi',
  user_deactivated: 'Kullanıcı pasif yapıldı',
  user_activated: 'Kullanıcı aktif yapıldı',
};

export const ACTION_ICONS: Record<ActionType, string> = {
  user_login: 'ri-login-box-line',
  user_created: 'ri-user-add-line',
  password_changed: 'ri-lock-password-line',
  document_added: 'ri-file-add-line',
  document_deleted: 'ri-file-reduce-line',
  tutanak_created: 'ri-file-text-line',
  tutanak_updated: 'ri-edit-line',
  firma_created: 'ri-building-2-line',
  firma_updated: 'ri-building-line',
  firma_deleted: 'ri-delete-bin-line',
  personel_created: 'ri-user-line',
  personel_updated: 'ri-user-settings-line',
  personel_deleted: 'ri-user-unfollow-line',
  user_deactivated: 'ri-pause-circle-line',
  user_activated: 'ri-play-circle-line',
};

export const ACTION_COLORS: Record<ActionType, string> = {
  user_login: '#6366F1',
  user_created: '#10B981',
  password_changed: '#F59E0B',
  document_added: '#3B82F6',
  document_deleted: '#EF4444',
  tutanak_created: '#8B5CF6',
  tutanak_updated: '#8B5CF6',
  firma_created: '#10B981',
  firma_updated: '#F59E0B',
  firma_deleted: '#EF4444',
  personel_created: '#10B981',
  personel_updated: '#F59E0B',
  personel_deleted: '#EF4444',
  user_deactivated: '#EF4444',
  user_activated: '#10B981',
};

export const MODULE_LABELS: Record<string, string> = {
  Firmalar: 'Firmalar',
  Personeller: 'Personeller',
  Evraklar: 'Evraklar',
  Tutanaklar: 'Tutanaklar',
  Kullanicilar: 'Kullanıcılar',
  Hesap: 'Hesap',
};
