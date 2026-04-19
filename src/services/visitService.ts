import { supabase } from '@/lib/supabase';
import { logActivity } from '@/services/activityLogService';
import type { AppVisit, VisitRow, VisitStatus, VerificationType } from '@/types/database';

// ─── Mapper ───────────────────────────────────────────────────────────────────

function durationStr(minutes: number | null): string {
  if (minutes == null) return '—';
  return `${Math.floor(minutes / 60)}s ${minutes % 60}dk`;
}

function toAppVisit(row: VisitRow): AppVisit {
  const p = row.personnel;
  const f = row.firm;
  const roleLabel = p?.role === 'doctor' ? 'Hekim' : 'Uzman';
  return {
    id: row.id,
    personnelId: row.personnel_id ?? '',
    personnel: p?.full_name ?? '(Silinmiş Personel)',
    role: roleLabel,
    firmId: row.firm_id ?? '',
    firm: f?.name ?? '(Silinmiş Firma)',
    date: row.visit_date,
    startTime: row.check_in,
    endTime: row.check_out ?? '',
    duration: durationStr(row.duration_minutes),
    status: row.status,
    notes: row.notes ?? '',
    verificationType: row.verification_type ?? null,
    locationVerified: row.location_verified ?? false,
    startedViaQr: row.started_via_qr ?? false,
    endedViaQr: row.ended_via_qr ?? false,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getVisits(organizationId: string): Promise<AppVisit[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, personnel:profiles(*), firm:firms(*)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toAppVisit(r as VisitRow));
}

export async function getMyVisits(personnelId: string): Promise<AppVisit[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, personnel:profiles(*), firm:firms(*)')
    .eq('personnel_id', personnelId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toAppVisit(r as VisitRow));
}

export async function getActiveVisit(personnelId: string): Promise<AppVisit | null> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, personnel:profiles(*), firm:firms(*)')
    .eq('personnel_id', personnelId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return toAppVisit(data as VisitRow);
}

// ─── Business Rule Checks ─────────────────────────────────────────────────────

async function assertNoActiveVisit(personnelId: string): Promise<void> {
  const { data } = await supabase
    .from('visits')
    .select('id')
    .eq('personnel_id', personnelId)
    .eq('status', 'active')
    .maybeSingle();
  if (data) throw new Error('Zaten aktif bir ziyaretiniz var. Önce mevcut ziyareti bitirin.');
}

async function assertPersonnelAssigned(personnelId: string, firmId: string): Promise<void> {
  const { data } = await supabase
    .from('firm_assignments')
    .select('id')
    .eq('personnel_id', personnelId)
    .eq('firm_id', firmId)
    .maybeSingle();
  if (!data) throw new Error('Bu firmaya atanmış değilsiniz. Ziyaret başlatılamaz.');
}

async function assertFirmActive(firmId: string): Promise<void> {
  const { data } = await supabase
    .from('firms')
    .select('status, deleted_at')
    .eq('id', firmId)
    .maybeSingle();
  if (!data) throw new Error('Firma bulunamadı.');
  if (data.deleted_at) throw new Error('Bu firma silinmiş. Ziyaret başlatılamaz.');
  if (data.status !== 'Aktif') throw new Error('Bu firma aktif değil. Ziyaret başlatılamaz.');
}

async function assertPersonnelActive(personnelId: string): Promise<void> {
  const { data } = await supabase
    .from('profiles')
    .select('status, deleted_at')
    .eq('id', personnelId)
    .maybeSingle();
  if (!data) throw new Error('Personel bulunamadı.');
  if (data.deleted_at) throw new Error('Personel hesabı silinmiş.');
  if (data.status !== 'active') throw new Error('Personel hesabı pasif. Ziyaret başlatılamaz.');
}

// ─── Create Visit (with business rules) ──────────────────────────────────────

export async function createVisit(
  organizationId: string,
  payload: {
    personnelId: string;
    firmId: string;
    date: string;
    startTime: string;
    notes?: string;
    verificationType?: VerificationType;
    locationVerified?: boolean;
    startedViaQr?: boolean;
  }
): Promise<AppVisit> {
  await assertPersonnelActive(payload.personnelId);
  await assertFirmActive(payload.firmId);
  await assertPersonnelAssigned(payload.personnelId, payload.firmId);
  await assertNoActiveVisit(payload.personnelId);

  const { data, error } = await supabase
    .from('visits')
    .insert({
      organization_id: organizationId,
      personnel_id: payload.personnelId,
      firm_id: payload.firmId,
      visit_date: payload.date,
      check_in: payload.startTime,
      status: 'active' as VisitStatus,
      notes: payload.notes || null,
      verification_type: payload.verificationType ?? null,
      location_verified: payload.locationVerified ?? false,
      started_via_qr: payload.startedViaQr ?? false,
      ended_via_qr: false,
    })
    .select('*, personnel:profiles(*), firm:firms(*)')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') throw new Error('Zaten aktif bir ziyaretiniz var.');
    throw new Error(error.message);
  }
  if (!data) throw new Error('Ziyaret oluşturulamadı');

  const visit = toAppVisit(data as VisitRow);

  // Audit log — hata ana akışı durdurmasın
  logActivity({
    organizationId,
    userId: payload.personnelId,
    action: 'visit_started',
    entityType: 'visit',
    entityId: visit.id,
    meta: { firmId: payload.firmId, startedViaQr: payload.startedViaQr ?? false },
  });

  return visit;
}

// ─── End Visit (manuel) ───────────────────────────────────────────────────────

export async function endVisit(id: string, checkIn: string, checkOut: string): Promise<AppVisit> {
  const [sh, sm] = checkIn.split(':').map(Number);
  const [eh, em] = checkOut.split(':').map(Number);
  const durationMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

  const { data, error } = await supabase
    .from('visits')
    .update({
      check_out: checkOut,
      duration_minutes: durationMinutes,
      status: 'completed' as VisitStatus,
      ended_via_qr: false,
    })
    .eq('id', id)
    .select('*, personnel:profiles(*), firm:firms(*)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Ziyaret bulunamadı');
  return toAppVisit(data as VisitRow);
}

// ─── Update Visit ─────────────────────────────────────────────────────────────

export async function updateVisit(
  id: string,
  payload: { status?: VisitStatus; notes?: string; checkOut?: string; durationMinutes?: number }
): Promise<AppVisit> {
  const update: Record<string, unknown> = {};
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.notes !== undefined) update.notes = payload.notes;
  if (payload.checkOut !== undefined) update.check_out = payload.checkOut;
  if (payload.durationMinutes !== undefined) update.duration_minutes = payload.durationMinutes;

  const { data, error } = await supabase
    .from('visits')
    .update(update)
    .eq('id', id)
    .select('*, personnel:profiles(*), firm:firms(*)')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Ziyaret bulunamadı');
  return toAppVisit(data as VisitRow);
}

export async function deleteVisit(id: string): Promise<void> {
  const { error } = await supabase.from('visits').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DISTANCE_LIMIT_KM = 1;

// ─── QR Visit Start ───────────────────────────────────────────────────────────

export interface QrVisitPayload {
  qrToken: string;
  personnelId: string;
  organizationId: string;
  userLat?: number;
  userLng?: number;
}

export interface QrVisitResult {
  success: boolean;
  visit?: AppVisit;
  error?: string;
}

export async function startVisitViaQr(payload: QrVisitPayload): Promise<QrVisitResult> {
  // 1. qr_token ile firmayı bul
  const { data: firmData, error: firmError } = await supabase
    .from('firms')
    .select('*')
    .eq('qr_token', payload.qrToken)
    .maybeSingle();

  if (firmError || !firmData) {
    return { success: false, error: 'Geçersiz QR kodu. Firma bulunamadı.' };
  }

  // 2. Firma aktif mi?
  if (firmData.deleted_at) {
    return { success: false, error: 'Bu firma silinmiş. Ziyaret başlatılamaz.' };
  }
  if (firmData.status !== 'Aktif') {
    return { success: false, error: 'Bu firma aktif değil. Ziyaret başlatılamaz.' };
  }

  // 3. Personel aktif mi?
  const { data: profileData } = await supabase
    .from('profiles')
    .select('status, deleted_at')
    .eq('id', payload.personnelId)
    .maybeSingle();

  if (!profileData || profileData.deleted_at || profileData.status !== 'active') {
    return { success: false, error: 'Hesabınız aktif değil. Yöneticinizle iletişime geçin.' };
  }

  // 4. Personel bu firmaya atanmış mı?
  const { data: assignment } = await supabase
    .from('firm_assignments')
    .select('id')
    .eq('firm_id', firmData.id)
    .eq('personnel_id', payload.personnelId)
    .maybeSingle();

  if (!assignment) {
    return { success: false, error: 'Bu firmaya atanmış değilsiniz. Ziyaret başlatılamaz.' };
  }

  // 5. Zaten aktif ziyaret var mı?
  const { data: activeVisit } = await supabase
    .from('visits')
    .select('id')
    .eq('personnel_id', payload.personnelId)
    .eq('status', 'active')
    .maybeSingle();

  if (activeVisit) {
    return { success: false, error: 'Zaten aktif bir ziyaretiniz var. Önce mevcut ziyareti bitirin.' };
  }

  // 6. QR+GPRS ise konum kontrolü
  let locationVerified = false;
  if (firmData.verification_type === 'qr_gprs') {
    if (payload.userLat == null || payload.userLng == null) {
      return { success: false, error: 'Bu firma QR+GPRS doğrulaması gerektiriyor. Konum izni verin.' };
    }
    if (firmData.latitude == null || firmData.longitude == null) {
      return { success: false, error: 'Firma konumu tanımlı değil. Yöneticinizle iletişime geçin.' };
    }
    const dist = haversineKm(payload.userLat, payload.userLng, firmData.latitude, firmData.longitude);
    if (dist > DISTANCE_LIMIT_KM) {
      return {
        success: false,
        error: `Firma konumuna çok uzaksınız (${dist.toFixed(1)} km). En fazla ${DISTANCE_LIMIT_KM} km içinde olmalısınız.`,
      };
    }
    locationVerified = true;
  }

  // 7. Ziyaret oluştur
  const now = new Date();
  const checkIn = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const visitDate = now.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('visits')
    .insert({
      organization_id: payload.organizationId,
      personnel_id: payload.personnelId,
      firm_id: firmData.id,
      visit_date: visitDate,
      check_in: checkIn,
      status: 'active' as VisitStatus,
      verification_type: firmData.verification_type as VerificationType,
      location_verified: locationVerified,
      started_via_qr: true,
      ended_via_qr: false,
    })
    .select('*, personnel:profiles(*), firm:firms(*)')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Zaten aktif bir ziyaretiniz var.' };
    }
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: 'Ziyaret oluşturulamadı' };

  const visit = toAppVisit(data as VisitRow);

  // Audit log
  logActivity({
    organizationId: payload.organizationId,
    userId: payload.personnelId,
    action: 'visit_started',
    entityType: 'visit',
    entityId: visit.id,
    meta: { firmId: firmData.id, startedViaQr: true, locationVerified },
  });

  return { success: true, visit };
}

// ─── QR Visit End ─────────────────────────────────────────────────────────────

export interface QrEndVisitPayload {
  qrToken: string;
  visitId: string;
  personnelId: string;
  organizationId: string;
  userLat?: number;
  userLng?: number;
}

export interface QrEndVisitResult {
  success: boolean;
  visit?: AppVisit;
  error?: string;
}

export async function endVisitViaQr(payload: QrEndVisitPayload): Promise<QrEndVisitResult> {
  // 1. Aktif ziyareti getir
  const { data: visitData, error: visitError } = await supabase
    .from('visits')
    .select('*, firm:firms(*)')
    .eq('id', payload.visitId)
    .eq('personnel_id', payload.personnelId)
    .eq('status', 'active')
    .maybeSingle();

  if (visitError || !visitData) {
    return { success: false, error: 'Aktif ziyaret bulunamadı.' };
  }

  // 2. QR token ile firma eşleşiyor mu?
  const firm = visitData.firm as {
    id: string;
    qr_token: string | null;
    verification_type: string;
    latitude: number | null;
    longitude: number | null;
  } | null;

  if (!firm || firm.qr_token !== payload.qrToken) {
    return {
      success: false,
      error: 'QR kodu bu ziyaretin firmasıyla eşleşmiyor. Doğru firmadaki QR kodu okutun.',
    };
  }

  // 3. qr_gprs ise bitirirken de konum kontrolü
  if (firm.verification_type === 'qr_gprs') {
    if (payload.userLat == null || payload.userLng == null) {
      return { success: false, error: 'Ziyareti bitirmek için konum izni gerekiyor.' };
    }
    if (firm.latitude == null || firm.longitude == null) {
      return { success: false, error: 'Firma konumu tanımlı değil.' };
    }
    const dist = haversineKm(payload.userLat, payload.userLng, firm.latitude, firm.longitude);
    if (dist > DISTANCE_LIMIT_KM) {
      return {
        success: false,
        error: `Firma konumuna çok uzaksınız (${dist.toFixed(1)} km). Ziyareti bitirmek için firmada olmanız gerekiyor.`,
      };
    }
  }

  // 4. Ziyareti bitir
  const now = new Date();
  const checkOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const [sh, sm] = (visitData.check_in as string).split(':').map(Number);
  const [eh, em] = checkOut.split(':').map(Number);
  const durationMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

  const { data, error } = await supabase
    .from('visits')
    .update({
      check_out: checkOut,
      duration_minutes: durationMinutes,
      status: 'completed' as VisitStatus,
      ended_via_qr: true,
    })
    .eq('id', payload.visitId)
    .select('*, personnel:profiles(*), firm:firms(*)')
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Ziyaret güncellenemedi.' };

  const visit = toAppVisit(data as VisitRow);

  // Audit log
  logActivity({
    organizationId: payload.organizationId,
    userId: payload.personnelId,
    action: 'visit_ended',
    entityType: 'visit',
    entityId: visit.id,
    meta: { firmId: firm.id, endedViaQr: true, durationMinutes },
  });

  return { success: true, visit };
}
