import { useState, useCallback, useMemo } from 'react';
import type { StoreType } from './useStore';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Bildirim {
  id: string;
  tip:
    | 'evrak_surecek'
    | 'evrak_dolmus'
    | 'ekipman_kontrol'
    | 'egitim_surecek'
    | 'saglik_surecek'
    | 'ekipman_kontrol_yapildi'
    | 'is_izni_onaylandi'
    | 'is_izni_reddedildi';
  mesaj: string;
  detay: string;
  tarih: string;
  okundu: boolean;
  kalanGun: number;
  module: string;
  recordId?: string;
}

// ── Persistence helpers ────────────────────────────────────────────────────

const STORAGE_KEY = 'isg_okunan_bildirimler';
const MAX_OKUNAN_IDS = 500;

function loadOkunanlar(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? new Set<string>(JSON.parse(saved) as string[]) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function saveOkunanlar(ids: Set<string>): void {
  try {
    const arr = [...ids].slice(-MAX_OKUNAN_IDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

// ── Store params ───────────────────────────────────────────────────────────

export interface NotificationStoreParams {
  evraklar: StoreType['evraklar'];
  ekipmanlar: StoreType['ekipmanlar'];
  // egitimler: hook içinde kullanılmıyor — kaldırıldı (gereksiz re-render engeli)
  muayeneler: StoreType['muayeneler'];
  personeller: StoreType['personeller'];
  firmalar: StoreType['firmalar'];
}

export interface NotificationStore {
  bildirimler: Bildirim[];
  okunmamisBildirimSayisi: number;
  bildirimOku: (id: string) => void;
  tumunuOku: () => void;
  ekipmanKontrolBildirimi: (ekipmanAd: string, ekipmanId: string, durum: string, gecikmisDi: boolean) => void;
  isIzniBildirimi: (izinNo: string, izinId: string, tip: 'onaylandi' | 'reddedildi', sahaNotu?: string) => void;
}

// ── Shared date helpers (defined outside hook to avoid re-creation) ────────

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDaysRemaining(dateStr: string | null | undefined, today: Date): number | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useNotificationStore(params: NotificationStoreParams): NotificationStore {
  const { evraklar, ekipmanlar, muayeneler, personeller, firmalar } = params;
  // egitimler intentionally not destructured — not used in any notification calculation

  const [kontrolBildirimleri, setKontrolBildirimleri] = useState<Bildirim[]>([]);
  const [okunanlar, setOkunanlar] = useState<Set<string>>(loadOkunanlar);

  // ── Persist helper ──
  const persistOkunanlar = useCallback((ids: Set<string>) => {
    saveOkunanlar(ids);
  }, []);

  // ── Actions ──
  const bildirimOku = useCallback((id: string) => {
    setOkunanlar(prev => {
      const next = new Set([...prev, id]);
      persistOkunanlar(next);
      return next;
    });
  }, [persistOkunanlar]);

  const ekipmanKontrolBildirimi = useCallback((
    ekipmanAd: string,
    ekipmanId: string,
    durum: string,
    gecikmisDi: boolean,
  ) => {
    const id = `kontrol_yapildi_${ekipmanId}_${Date.now()}`;
    const now = new Date().toISOString().split('T')[0];
    const yeniBildirim: Bildirim = {
      id,
      tip: 'ekipman_kontrol_yapildi',
      mesaj: gecikmisDi
        ? `${ekipmanAd} — Gecikmiş kontrol tamamlandı`
        : `${ekipmanAd} — Kontrol tamamlandı`,
      detay: `Durum: ${durum} · ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
      tarih: now,
      okundu: false,
      kalanGun: 0,
      module: 'ekipmanlar',
      recordId: ekipmanId,
    };
    setKontrolBildirimleri(prev => [yeniBildirim, ...prev].slice(0, 20));
    setTimeout(() => {
      setKontrolBildirimleri(prev =>
        prev.map(b => (b.id === id ? { ...b, okundu: true } : b)),
      );
    }, 30000);
  }, []);

  const isIzniBildirimi = useCallback((
    izinNo: string,
    izinId: string,
    tip: 'onaylandi' | 'reddedildi',
    sahaNotu?: string,
  ) => {
    const id = `is_izni_${tip}_${izinId}_${Date.now()}`;
    const now = new Date().toISOString().split('T')[0];
    const yeniBildirim: Bildirim = {
      id,
      tip: tip === 'onaylandi' ? 'is_izni_onaylandi' : 'is_izni_reddedildi',
      mesaj:
        tip === 'onaylandi'
          ? `İş izni onaylandı — ${izinNo}`
          : `İş izni reddedildi — ${izinNo}`,
      detay: sahaNotu
        ? `Saha notu: ${sahaNotu}`
        : tip === 'onaylandi'
          ? 'Sahada uygundur'
          : 'Uygun değil',
      tarih: now,
      okundu: false,
      kalanGun: 0,
      module: 'is-izinleri',
      recordId: izinId,
    };
    setKontrolBildirimleri(prev => [yeniBildirim, ...prev].slice(0, 30));
    setTimeout(() => {
      setKontrolBildirimleri(prev =>
        prev.map(b => (b.id === id ? { ...b, okundu: true } : b)),
      );
    }, 60000);
  }, []);

  // ── EVRAK bildirimleri (sadece evraklar / personeller / firmalar değişince çalışır) ──
  const evrakBildirimleri = useMemo<Bildirim[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const result: Bildirim[] = [];

    evraklar.forEach(e => {
      if (e.silinmis) return;
      const personel = e.personelId ? personeller.find(p => p.id === e.personelId) : null;
      const firma = firmalar.find(f => f.id === e.firmaId);
      const detayBase = `${personel ? personel.adSoyad + ' — ' : ''}${firma?.ad || ''}`;

      if (e.durum === 'Süre Dolmuş') {
        const d = parseDate(e.gecerlilikTarihi);
        const tarihBilgi = d
          ? `${d.toLocaleDateString('tr-TR')} tarihinde doldu`
          : 'Süresi dolmuş';
        result.push({
          id: `evrak_dolmus_${e.id}`,
          tip: 'evrak_dolmus',
          mesaj: `${e.ad} evrakının süresi dolmuş`,
          detay: `${detayBase}${detayBase ? ' — ' : ''}${tarihBilgi}`,
          tarih: e.gecerlilikTarihi || new Date().toISOString().split('T')[0],
          okundu: false,
          kalanGun: -1,
          module: 'evraklar',
          recordId: e.id,
        });
        return;
      }

      if (e.durum === 'Eksik') {
        result.push({
          id: `evrak_eksik_${e.id}`,
          tip: 'evrak_dolmus',
          mesaj: `${e.ad} evrakı eksik`,
          detay: `${detayBase}${detayBase ? ' — ' : ''}Evrak henüz yüklenmemiş`,
          tarih: new Date().toISOString().split('T')[0],
          okundu: false,
          kalanGun: -1,
          module: 'evraklar',
          recordId: e.id,
        });
        return;
      }

      const d = parseDate(e.gecerlilikTarihi);
      if (!d) return;
      const kalanGun = getDaysRemaining(e.gecerlilikTarihi, today)!;

      if (d >= today && d <= in30) {
        result.push({
          id: `evrak_surecek_${e.id}`,
          tip: 'evrak_surecek',
          mesaj: `${e.ad} evrakının süresi yaklaşıyor`,
          detay: `${detayBase}${detayBase ? ' — ' : ''}${kalanGun === 0 ? 'Bugün dolacak!' : `${kalanGun} gün kaldı`}`,
          tarih: e.gecerlilikTarihi!,
          okundu: false,
          kalanGun,
          module: 'evraklar',
          recordId: e.id,
        });
      } else if (d < today) {
        result.push({
          id: `evrak_dolmus_${e.id}`,
          tip: 'evrak_dolmus',
          mesaj: `${e.ad} evrakının süresi dolmuş`,
          detay: `${detayBase}${detayBase ? ' — ' : ''}${d.toLocaleDateString('tr-TR')} tarihinde doldu`,
          tarih: e.gecerlilikTarihi!,
          okundu: false,
          kalanGun,
          module: 'evraklar',
          recordId: e.id,
        });
      }
    });

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evraklar, personeller, firmalar]);

  // ── EKİPMAN bildirimleri (sadece ekipmanlar / firmalar değişince çalışır) ──
  const ekipmanBildirimleri = useMemo<Bildirim[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: Bildirim[] = [];

    ekipmanlar.forEach(ek => {
      if (ek.silinmis) return;
      const firma = firmalar.find(f => f.id === ek.firmaId);

      if (ek.durum === 'Uygun Değil') {
        result.push({
          id: `ekipman_uygunsuz_${ek.id}`,
          tip: 'ekipman_kontrol',
          mesaj: `${ek.ad} — KRİTİK: Uygun Değil`,
          detay: `${firma?.ad ? firma.ad + ' — ' : ''}Ekipman uygunsuz olarak işaretlendi`,
          tarih: new Date().toISOString().split('T')[0],
          okundu: false,
          kalanGun: -999,
          module: 'ekipmanlar',
          recordId: ek.id,
        });
        return;
      }

      if (ek.durum === 'Bakımda') {
        result.push({
          id: `ekipman_bakimda_${ek.id}`,
          tip: 'ekipman_kontrol',
          mesaj: `${ek.ad} bakımda`,
          detay: `${firma?.ad ? firma.ad + ' — ' : ''}Ekipman bakım sürecinde`,
          tarih: new Date().toISOString().split('T')[0],
          okundu: false,
          kalanGun: -1,
          module: 'ekipmanlar',
          recordId: ek.id,
        });
        return;
      }

      const d = parseDate(ek.sonrakiKontrolTarihi);
      if (!d) return;
      const kalanGun = getDaysRemaining(ek.sonrakiKontrolTarihi, today)!;

      if (kalanGun < 0) {
        result.push({
          id: `ekipman_gecikti_${ek.id}`,
          tip: 'ekipman_kontrol',
          mesaj: `${ek.ad} kontrolü gecikti`,
          detay: `${firma?.ad ? firma.ad + ' — ' : ''}${Math.abs(kalanGun)} gün gecikti`,
          tarih: ek.sonrakiKontrolTarihi,
          okundu: false,
          kalanGun,
          module: 'ekipmanlar',
          recordId: ek.id,
        });
        return;
      }

      if (kalanGun > 60) return;

      result.push({
        id: `ekipman_${ek.id}`,
        tip: 'ekipman_kontrol',
        mesaj: `${ek.ad} kontrolü yaklaşıyor`,
        detay: `${firma?.ad ? firma.ad + ' — ' : ''}${kalanGun === 0 ? 'Bugün kontrol edilmeli!' : `${kalanGun} gün kaldı`}`,
        tarih: ek.sonrakiKontrolTarihi,
        okundu: false,
        kalanGun,
        module: 'ekipmanlar',
        recordId: ek.id,
      });
    });

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ekipmanlar, firmalar]);

  // ── MUAYENE bildirimleri (sadece muayeneler / personeller değişince çalışır) ──
  const muayeneBildirimleri = useMemo<Bildirim[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: Bildirim[] = [];

    muayeneler.forEach(m => {
      if (m.silinmis) return;
      const tarihStr = m.sonrakiTarih || m.muayeneTarihi;
      const d = parseDate(tarihStr);
      if (!d) return;
      const kalanGun = getDaysRemaining(tarihStr, today)!;
      if (kalanGun < 0 || kalanGun > 60) return;
      const personel = personeller.find(p => p.id === m.personelId);
      result.push({
        id: `saglik_${m.id}`,
        tip: 'saglik_surecek',
        mesaj: `${personel?.adSoyad || 'Personel'} muayene tarihi yaklaşıyor`,
        detay: `Periyodik Muayene — ${kalanGun === 0 ? 'Bugün!' : `${kalanGun} gün kaldı`}`,
        tarih: tarihStr!,
        okundu: false,
        kalanGun,
        module: 'muayeneler',
        recordId: m.id,
      });
    });

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muayeneler, personeller]);

  // ── Tüm bildirimleri birleştir + okundu durumunu uygula ──
  // Bu memo sadece parça memo'lardan biri veya okunanlar değişince çalışır
  const bildirimler = useMemo<Bildirim[]>(() => {
    const kontrolMerged = kontrolBildirimleri.map(b => ({
      ...b,
      okundu: b.okundu || okunanlar.has(b.id),
    }));

    const withOkundu = (list: Bildirim[]) =>
      list.map(b => ({ ...b, okundu: okunanlar.has(b.id) }));

    const sorted = [
      ...withOkundu(evrakBildirimleri),
      ...withOkundu(ekipmanBildirimleri),
      ...withOkundu(muayeneBildirimleri),
    ].sort((a, b) => a.kalanGun - b.kalanGun);

    return [...kontrolMerged, ...sorted];
  }, [kontrolBildirimleri, evrakBildirimleri, ekipmanBildirimleri, muayeneBildirimleri, okunanlar]);

  const tumunuOku = useCallback(() => {
    const ids = bildirimler.map(b => b.id);
    setOkunanlar(prev => {
      const next = new Set([...prev, ...ids]);
      persistOkunanlar(next);
      return next;
    });
  }, [bildirimler, persistOkunanlar]);

  const okunmamisBildirimSayisi = useMemo(
    () => bildirimler.filter(b => !b.okundu).length,
    [bildirimler],
  );

  return {
    bildirimler,
    okunmamisBildirimSayisi,
    bildirimOku,
    tumunuOku,
    ekipmanKontrolBildirimi,
    isIzniBildirimi,
  };
}
