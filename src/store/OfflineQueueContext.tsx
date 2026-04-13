/**
 * OfflineQueueContext — Global tek queue instance
 *
 * Tüm saha işlemleri tek IndexedDB queue'sunda toplanır.
 * Central applyHandler switch-case ile tüm action type'larını yönetir.
 * Validation, size-limit, crash-recovery useOfflineQueue hook'unda sağlanır.
 */

import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import {
  useOfflineQueue,
  type OfflineQueueItem,
  type UseOfflineQueueReturn,
  type ZiyaretCheckinPayload,
  type ZiyaretCheckoutPayload,
  type EkipmanKontrolPayload,
  type EkipmanDurumPayload,
  type EkipmanKontrolKaydi,
} from '@/hooks/useOfflineQueue';

// ─── LocalStorage keys ────────────────────────────────────────────────────────
export const LS_AKTIF_ZIYARET       = 'isg_aktif_ziyaret';
export const LS_HEKIM_AKTIF_ZIYARET = 'isg_hekim_aktif_ziyaret';

// ─── Context ─────────────────────────────────────────────────────────────────
const OfflineQueueContext = createContext<UseOfflineQueueReturn | null>(null);

// ─── Central Apply Handler ────────────────────────────────────────────────────
async function applyQueueItem(item: OfflineQueueItem): Promise<void> {
  switch (item.type) {

    // ── Ziyaret Check-in ───────────────────────────────────────────────────
    case 'ziyaret_checkin': {
      const p = item.payload as unknown as ZiyaretCheckinPayload;

      // Çakışma kontrolü
      const { data: existing } = await supabase
        .from('osgb_ziyaretler')
        .select('id')
        .eq('uzman_user_id', p.uzmanUserId)
        .is('cikis_saati', null)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Duplicate — başarılı say (queue'dan sil)
        console.info('[Queue] checkin skipped: active visit already exists', p.tempId);
        return;
      }

      const { data: yeni, error } = await supabase
        .from('osgb_ziyaretler')
        .insert({
          osgb_org_id:         p.osgbOrgId,
          firma_org_id:        p.firmaOrgId,
          firma_ad:            p.firmaAd,
          uzman_user_id:       p.uzmanUserId,
          uzman_ad:            p.uzmanAd,
          uzman_email:         p.uzmanEmail,
          giris_saati:         p.girisAt,
          durum:               'aktif',
          qr_ile_giris:        p.qrIleGiris,
          check_in_lat:        p.checkInLat,
          check_in_lng:        p.checkInLng,
          gps_status:          p.gpsStatus,
          check_in_distance_m: p.checkInDistanceM,
          created_at:          p.girisAt,
          updated_at:          new Date().toISOString(),
        })
        .select('id, firma_ad')
        .maybeSingle();

      if (error) throw new Error(`[checkin] Supabase: ${error.message} (code: ${error.code})`);

      if (yeni?.id) {
        _updateLocalStorageZiyaret(LS_AKTIF_ZIYARET,       p.tempId, yeni.id, yeni.firma_ad);
        _updateLocalStorageZiyaret(LS_HEKIM_AKTIF_ZIYARET, p.tempId, yeni.id, yeni.firma_ad);
      }
      break;
    }

    // ── Ziyaret Check-out ──────────────────────────────────────────────────
    case 'ziyaret_checkout': {
      const p = item.payload as unknown as ZiyaretCheckoutPayload;
      let targetId = p.realId;

      if (!targetId && p.tempId) {
        targetId = _findRealIdByTempId(LS_AKTIF_ZIYARET, p.tempId)
          ?? _findRealIdByTempId(LS_HEKIM_AKTIF_ZIYARET, p.tempId);
      }

      if (!targetId) {
        const { data: aktif } = await supabase
          .from('osgb_ziyaretler')
          .select('id')
          .eq('uzman_user_id', p.uzmanUserId)
          .is('cikis_saati', null)
          .limit(1)
          .maybeSingle();
        if (aktif) targetId = aktif.id;
      }

      // Hedef yok → retry'a bırak (check-in henüz sync olmamış olabilir)
      if (!targetId) {
        throw new Error('[checkout] Hedef kayıt bulunamadı — check-in sync bekleniyor olabilir');
      }

      const { error } = await supabase
        .from('osgb_ziyaretler')
        .update({
          cikis_saati:   p.cikisAt,
          durum:         'tamamlandi',
          sure_dakika:   p.sureDakika,
          check_out_lat: p.checkOutLat,
          check_out_lng: p.checkOutLng,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', targetId)
        .is('cikis_saati', null);

      if (error) throw new Error(`[checkout] Supabase: ${error.message} (code: ${error.code})`);

      _clearLocalStorageZiyaret(LS_AKTIF_ZIYARET,       p.tempId ?? targetId);
      _clearLocalStorageZiyaret(LS_HEKIM_AKTIF_ZIYARET, p.tempId ?? targetId);
      break;
    }

    // ── Ekipman Kontrol ────────────────────────────────────────────────────
    case 'ekipman_kontrol': {
      const p = item.payload as unknown as EkipmanKontrolPayload;

      // 1. Mevcut ekipman verisini Supabase'den çek
      const { data: row, error: fetchErr } = await supabase
        .from('ekipmanlar')
        .select('data')
        .eq('id', p.ekipmanId)
        .eq('organization_id', p.organizationId)
        .maybeSingle();

      if (fetchErr) throw new Error(`[ekipman_kontrol] Fetch error: ${fetchErr.message}`);

      // Kayıt yoksa (farklı org / silinmiş) — sessizce başarılı say
      if (!row) {
        console.info('[Queue] ekipman_kontrol: kayıt bulunamadı (başka org veya silinmiş), skip');
        break;
      }

      const mevcutData = (row.data ?? {}) as Record<string, unknown>;

      // 2. Mevcut kontrolGecmisi array'ine yeni kaydı ekle (duplicate kontrol)
      const mevcutKontroller = (mevcutData.kontrolGecmisi ?? []) as EkipmanKontrolKaydi[];
      const alreadyExists = mevcutKontroller.some(k => k.id === p.yeniKayit.id);

      const yeniKontroller = alreadyExists
        ? mevcutKontroller
        : [p.yeniKayit, ...mevcutKontroller];

      // 3. Güncel data objesini oluştur
      const updatedData: Record<string, unknown> = {
        ...mevcutData,
        durum:               p.durum,
        sonKontrolTarihi:    p.sonKontrolTarihi,
        sonrakiKontrolTarihi: p.sonrakiKontrolTarihi,
        kontrolGecmisi:      yeniKontroller,
      };

      // 4. Supabase'e yaz
      const { error: updateErr } = await supabase
        .from('ekipmanlar')
        .update({
          data:       updatedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.ekipmanId)
        .eq('organization_id', p.organizationId);

      if (updateErr) throw new Error(`[ekipman_kontrol] Update error: ${updateErr.message}`);

      console.info('[Queue] ekipman_kontrol OK →', p.ekipmanId, 'durum:', p.durum);
      break;
    }

    // ── Ekipman Durum Değişikliği ──────────────────────────────────────────
    case 'ekipman_durum': {
      const p = item.payload as unknown as EkipmanDurumPayload;

      // 1. Mevcut ekipman verisini çek
      const { data: row, error: fetchErr } = await supabase
        .from('ekipmanlar')
        .select('data')
        .eq('id', p.ekipmanId)
        .eq('organization_id', p.organizationId)
        .maybeSingle();

      if (fetchErr) throw new Error(`[ekipman_durum] Fetch error: ${fetchErr.message}`);

      if (!row) {
        console.info('[Queue] ekipman_durum: kayıt bulunamadı, skip');
        break;
      }

      const mevcutData = (row.data ?? {}) as Record<string, unknown>;

      // 2. Kontrol geçmişine ekle (duplicate kontrolü ile)
      const mevcutKontroller = (mevcutData.kontrolGecmisi ?? []) as EkipmanKontrolKaydi[];
      const alreadyExists = mevcutKontroller.some(k => k.id === p.yeniKayit.id);

      const yeniKontroller = alreadyExists
        ? mevcutKontroller
        : [p.yeniKayit, ...mevcutKontroller];

      // 3. Güncel data — sadece durum ve kontrol geçmişi değişir
      const updatedData: Record<string, unknown> = {
        ...mevcutData,
        durum:          p.durum,
        kontrolGecmisi: yeniKontroller,
      };

      // 4. Supabase'e yaz
      const { error: updateErr } = await supabase
        .from('ekipmanlar')
        .update({
          data:       updatedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.ekipmanId)
        .eq('organization_id', p.organizationId);

      if (updateErr) throw new Error(`[ekipman_durum] Update error: ${updateErr.message}`);

      console.info('[Queue] ekipman_durum OK →', p.ekipmanId, 'yeni durum:', p.durum);
      break;
    }

    default:
      console.warn('[Queue] Unknown action type:', item.type);
  }
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
interface StoredZiyaret {
  id: string | null;
  tempId: string;
  firmaAd: string | null;
  isOffline: boolean;
  [key: string]: unknown;
}

function _updateLocalStorageZiyaret(key: string, tempId: string, realId: string, firmaAd: string | null): void {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredZiyaret;
    if (parsed.tempId === tempId) {
      localStorage.setItem(key, JSON.stringify({ ...parsed, id: realId, isOffline: false, firmaAd: firmaAd ?? parsed.firmaAd }));
    }
  } catch { /* ignore */ }
}

function _findRealIdByTempId(key: string, tempId: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredZiyaret;
    if (parsed.tempId === tempId && parsed.id) return parsed.id;
  } catch { /* ignore */ }
  return null;
}

function _clearLocalStorageZiyaret(key: string, tempIdOrRealId: string): void {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredZiyaret;
    if (parsed.tempId === tempIdOrRealId || parsed.id === tempIdOrRealId) {
      localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const applyRef = useRef(applyQueueItem);

  const stableApply = useCallback(
    (item: OfflineQueueItem) => applyRef.current(item),
    []
  );

  const queue = useOfflineQueue(stableApply);

  return (
    <OfflineQueueContext.Provider value={queue}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useQueue(): UseOfflineQueueReturn {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error('useQueue must be used inside <OfflineQueueProvider>');
  return ctx;
}
