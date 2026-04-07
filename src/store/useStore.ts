import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Firma, Personel, Evrak, Egitim, Muayene, Uygunsuzluk, Ekipman, Gorev, Tutanak, CurrentUser,
  UygunsuzlukStatus, IsIzni,
} from '../types';
import { getEvrakKategori } from '../utils/evrakKategori';
import { supabase } from '../lib/supabase';
import { uploadFileToStorage } from '../utils/fileUpload';

// ──────── ID & numbering ────────
function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ── Supabase RPC ile race-condition-safe numara üretimi ──
async function generateRecordNoFromDB(type: 'dof' | 'tutanak' | 'is_izni'): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('generate_record_no', { record_type: type });
    if (error) {
      console.error(`[ISG] generateRecordNo RPC error (${type}):`, error);
      return null;
    }
    return data as string;
  } catch (err) {
    console.error(`[ISG] generateRecordNo unexpected error (${type}):`, err);
    return null;
  }
}

// Fallback: frontend'de üret (RPC başarısız olursa)
export function generateTutanakNo(existing: { tutanakNo: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `TTK-${year}-`;
  const maxNum = existing
    .filter(t => t.tutanakNo?.startsWith(prefix))
    .map(t => parseInt(t.tutanakNo.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

export function generateDofNo(existing: { acilisNo?: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `DÖF-${year}-`;
  const maxNum = existing
    .filter(u => u.acilisNo?.startsWith(prefix))
    .map(u => parseInt(u.acilisNo!.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

export function generateIsIzniNo(existing: { izinNo: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `IZN-${year}-`;
  const maxNum = existing
    .filter(t => t.izinNo?.startsWith(prefix))
    .map(t => parseInt(t.izinNo.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

const defaultUser: CurrentUser = { id: 'u1', ad: '', email: '', rol: 'Admin' };

export type LogFn = (
  actionType: string, module: string, recordId: string, recordName?: string, description?: string,
) => void;

// ──────── Supabase DB helpers ────────
async function dbUpsert(
  table: string,
  item: { id: string } & Record<string, unknown>,
  userId: string,
  organizationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const isSilinmis = item.silinmis === true;
  const silinmeTarihi = typeof item.silinmeTarihi === 'string' ? item.silinmeTarihi : (isSilinmis ? now : null);
  const payload: Record<string, unknown> = {
    id: item.id,
    user_id: userId,
    organization_id: organizationId,
    data: item,
    updated_at: now,
    deleted_at: isSilinmis ? silinmeTarihi : null,
  };
  console.log(`[ISG] Saving ${table}/${item.id}`, { organization_id: organizationId, user_id: userId, deleted_at: payload.deleted_at });
  const { data, error } = await supabase.from(table).upsert(payload, { onConflict: 'id' }).select('id');
  if (error) {
    const errMsg = error.message || error.details || error.hint || JSON.stringify(error);
    console.error(`[ISG] SAVE ERROR ${table}/${item.id}:`, errMsg, error);
    // RLS hatasını daha anlaşılır göster
    if (errMsg.includes('row-level security') || errMsg.includes('RLS') || errMsg.includes('policy')) {
      throw new Error(`Yetki hatası: Bu işlem için yetkiniz yok. (${errMsg})`);
    }
    throw new Error(errMsg);
  }
  if (!data || data.length === 0) {
    // Önce kaydın var olup olmadığını kontrol et
    const { data: existing } = await supabase.from(table).select('id').eq('id', item.id).maybeSingle();
    if (!existing) {
      const msg = `Kayıt veritabanına yazılamadı (${table}). RLS politikası engelliyor olabilir.`;
      console.error(`[ISG] ${msg}`);
      throw new Error(msg);
    }
    // Kayıt var ama select döndürmedi — bu normal olabilir (RLS select kısıtlaması)
    console.log(`[ISG] SAVE OK ${table}/${item.id} ✓ (verified via select)`);
    return;
  }
  console.log(`[ISG] SAVE OK ${table}/${item.id} ✓ (rows confirmed: ${data.length})`);
}

async function dbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.error(`[ISG] DELETE ERROR ${table}/${id}:`, error);
    throw error;
  }
  console.log(`[ISG] DELETE OK ${table}/${id} ✓`);
}

async function dbDeleteMany(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) {
    console.error(`[ISG] DELETE_MANY ERROR ${table}:`, error);
    throw error;
  }
  console.log(`[ISG] DELETE_MANY OK ${table} (${ids.length} rows) ✓`);
}

// ──────── Main hook ────────
export function useStore(
  organizationId: string | null,
  logFn?: LogFn,
  onSaveError?: (msg: string) => void,
  userId?: string,
  orgLoading?: boolean,
  onRemoteChange?: (module: string) => void,
) {
  const [firmalar, _setFirmalar] = useState<Firma[]>([]);
  const [personeller, _setPersoneller] = useState<Personel[]>([]);
  const [evraklar, _setEvraklar] = useState<Evrak[]>([]);
  const [egitimler, _setEgitimler] = useState<Egitim[]>([]);
  const [muayeneler, _setMuayeneler] = useState<Muayene[]>([]);
  const [uygunsuzluklar, _setUygunsuzluklar] = useState<Uygunsuzluk[]>([]);
  const [ekipmanlar, _setEkipmanlar] = useState<Ekipman[]>([]);
  const [gorevler, _setGorevler] = useState<Gorev[]>([]);
  const [tutanaklar, _setTutanaklar] = useState<Tutanak[]>([]);
  const [isIzinleri, _setIsIzinleri] = useState<IsIzni[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(defaultUser);
  const [dataLoading, setDataLoading] = useState(true);

  const uygRef = useRef<Uygunsuzluk[]>([]);
  const tutRef = useRef<Tutanak[]>([]);
  const isIzRef = useRef<IsIzni[]>([]);
  const logFnRef = useRef(logFn);
  useEffect(() => { logFnRef.current = logFn; }, [logFn]);
  const onSaveErrorRef = useRef(onSaveError);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);
  const onRemoteChangeRef = useRef(onRemoteChange);
  useEffect(() => { onRemoteChangeRef.current = onRemoteChange; }, [onRemoteChange]);

  const orgIdRef = useRef(organizationId);
  const userIdRef = useRef(userId);
  useEffect(() => { orgIdRef.current = organizationId; }, [organizationId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── Pending saves queue ──
  const pendingSavesRef = useRef<{ table: string; item: { id: string } & Record<string, unknown> }[]>([]);

  // Flush fonksiyonu — org hazır olunca pending queue'yu gönder
  const flushPendingSaves = useCallback(() => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid) return;
    if (pendingSavesRef.current.length === 0) return;
    const pending = [...pendingSavesRef.current];
    pendingSavesRef.current = [];
    console.log(`[ISG] Flushing ${pending.length} pending saves for org=${orgId}`);
    pending.forEach(({ table, item }) => {
      dbUpsert(table, item, uid, orgId).then(() => {
        console.log(`[ISG] Pending save OK ${table}/${item.id} ✓`);
      }).catch(err => {
        console.error(`[ISG] Pending save FAILED ${table}/${item.id}:`, err);
        // Başarısız olanı tekrar queue'ya ekle
        pendingSavesRef.current.push({ table, item });
        onSaveErrorRef.current?.(`Bekleyen kayıt hatası (${table}): ${err instanceof Error ? err.message : String(err)}`);
      });
    });
  }, []);

  // org/user hazır olunca flush
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    flushPendingSaves();
  }, [organizationId, userId, orgLoading, flushPendingSaves]);

  // ── Online event listener — internet gelince pending saves flush et ──
  useEffect(() => {
    const handleOnline = () => {
      console.log('[ISG] Network online — flushing pending saves...');
      flushPendingSaves();
    };
    window.addEventListener('online', handleOnline);
    // Sayfa açıldığında zaten online ise de flush et
    if (navigator.onLine) flushPendingSaves();
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [flushPendingSaves]);

  // ── Stable setters ──
  const setFirmalar = useCallback((u: Firma[] | ((p: Firma[]) => Firma[])) => { _setFirmalar(u); }, []);
  const setPersoneller = useCallback((u: Personel[] | ((p: Personel[]) => Personel[])) => { _setPersoneller(u); }, []);
  const setEvraklar = useCallback((u: Evrak[] | ((p: Evrak[]) => Evrak[])) => { _setEvraklar(u); }, []);
  const setEgitimler = useCallback((u: Egitim[] | ((p: Egitim[]) => Egitim[])) => { _setEgitimler(u); }, []);
  const setMuayeneler = useCallback((u: Muayene[] | ((p: Muayene[]) => Muayene[])) => { _setMuayeneler(u); }, []);
  const setUygunsuzluklar = useCallback((u: Uygunsuzluk[] | ((p: Uygunsuzluk[]) => Uygunsuzluk[])) => {
    _setUygunsuzluklar(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      uygRef.current = next;
      return next;
    });
  }, []);
  const setEkipmanlar = useCallback((u: Ekipman[] | ((p: Ekipman[]) => Ekipman[])) => { _setEkipmanlar(u); }, []);
  const setGorevler = useCallback((u: Gorev[] | ((p: Gorev[]) => Gorev[])) => { _setGorevler(u); }, []);
  const setTutanaklar = useCallback((u: Tutanak[] | ((p: Tutanak[]) => Tutanak[])) => {
    _setTutanaklar(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      tutRef.current = next;
      return next;
    });
  }, []);
  const setIsIzinleri = useCallback((u: IsIzni[] | ((p: IsIzni[]) => IsIzni[])) => {
    _setIsIzinleri(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      isIzRef.current = next;
      return next;
    });
  }, []);

  // ── DB write helpers ──
  const saveToDb = useCallback(async (table: string, item: { id: string } & Record<string, unknown>, throwOnError = false): Promise<void> => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid) {
      console.warn(`[ISG] SAVE QUEUED ${table}/${item.id}: orgId=${orgId} userId=${uid} not ready yet`);
      pendingSavesRef.current.push({ table, item });
      if (throwOnError) throw new Error(`Organizasyon bilgisi henüz hazır değil. Lütfen tekrar deneyin.`);
      return;
    }
    try {
      await dbUpsert(table, item, uid, orgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ISG] SAVE FAILED ${table}/${item.id}:`, msg);
      onSaveErrorRef.current?.(`Kayıt hatası (${table}): ${msg}`);
      if (throwOnError) throw err;
    }
  }, []);

  const deleteFromDb = useCallback(async (table: string, id: string) => {
    try {
      await dbDelete(table, id);
    } catch (err) {
      console.error(`[ISG] DELETE FAILED ${table}/${id}:`, err);
    }
  }, []);

  const deleteManyFromDb = useCallback(async (table: string, ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await dbDeleteMany(table, ids);
    } catch (err) {
      console.error(`[ISG] DELETE_MANY FAILED ${table}:`, err);
    }
  }, []);

  // ── Core data loader (reusable) ──
  const loadAllData = useCallback(async (orgId: string) => {
    const TABLES = [
      'firmalar', 'personeller', 'evraklar', 'egitimler',
      'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'gorevler', 'tutanaklar', 'is_izinleri',
    ] as const;

    // FIX 7: Use Promise.allSettled instead of Promise.all
    // This ensures partial failures don't wipe all data — each table loads independently
    // deleted_at IS NULL filtresi: silinmiş kayıtları yükleme (soft-delete pattern)
    const results = await Promise.allSettled(
      TABLES.map(table =>
        supabase
          .from(table)
          .select('id, data, created_at')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ),
    );

    // Helper: extract rows from settled result — returns empty array on failure
    const getRows = <T>(settled: PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>): T[] => {
      if (settled.status === 'rejected') {
        console.error('[ISG] Table load rejected:', settled.reason);
        return [];
      }
      const res = settled.value;
      if (res.error) {
        console.error('[ISG] Load error:', res.error);
        return [];
      }
      return (res.data ?? []).map(row => row.data as T);
    };

    const [
      firmaRes, personelRes, evrakRes, egitimRes,
      muayeneRes, uygRes, ekipmanRes, gorevRes, tutanakRes, isIzRes,
    ] = results;

    const KAN: Record<string, string> = {
      'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-',
      'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-',
    };

    setFirmalar(getRows<Firma>(firmaRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>));
    setPersoneller(getRows<Personel>(personelRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>).map(p => ({
      ...p, kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? ''),
    })));
    setEvraklar(getRows<Evrak>(evrakRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>).map(e => ({
      ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? ''),
    })));
    setEgitimler(getRows<Egitim>(egitimRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>));
    setMuayeneler(getRows<Muayene>(muayeneRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>));
    setUygunsuzluklar(getRows<Uygunsuzluk>(uygRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>).map(u => {
      let durum = u.durum as string;
      if (durum === 'Kapatıldı') durum = 'Kapandı';
      if (durum === 'İncelemede') durum = 'Açık';
      return { ...u, durum: durum as UygunsuzlukStatus };
    }));
    setEkipmanlar(getRows<Ekipman>(ekipmanRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>));
    setGorevler(getRows<Gorev>(gorevRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>));
    setTutanaklar(getRows<Tutanak>(tutanakRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>));
    setIsIzinleri(getRows<IsIzni>(isIzRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>));

    console.log(`[ISG] Data loaded ✓ firms=${firmaRes.status === 'fulfilled' ? (firmaRes.value.data?.length ?? 0) : 'ERR'} personnel=${personelRes.status === 'fulfilled' ? (personelRes.value.data?.length ?? 0) : 'ERR'}`);
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, setTutanaklar, setIsIzinleri]);

  // ── Public refresh function — called by UI refresh buttons ──
  const refreshAllData = useCallback(async () => {
    const orgId = orgIdRef.current;
    if (!orgId) return;
    setDataLoading(true);
    try {
      await loadAllData(orgId);
    } finally {
      setDataLoading(false);
    }
  }, [loadAllData]);

  // ── Load from Supabase ──
  useEffect(() => {
    if (orgLoading) return;
    if (!organizationId || !userId) {
      setFirmalar([]); setPersoneller([]); setEvraklar([]);
      setEgitimler([]); setMuayeneler([]); setUygunsuzluklar([]);
      setEkipmanlar([]); setGorevler([]); setTutanaklar([]); setIsIzinleri([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    console.log(`[ISG] Loading data for org=${organizationId} user=${userId}`);

    loadAllData(organizationId).then(() => {
      setDataLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, orgLoading]);

  // ── Real-time subscription ──
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;

    const TABLE_MAP: Record<string, (rows: unknown[]) => void> = {
      firmalar:       (rows) => setFirmalar(rows as Firma[]),
      personeller:    (rows) => setPersoneller((rows as Personel[]).map(p => {
        const KAN: Record<string, string> = { 'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-', 'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-' };
        return { ...p, kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? '') };
      })),
      evraklar:       (rows) => setEvraklar((rows as Evrak[]).map(e => ({ ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? '') }))),
      egitimler:      (rows) => setEgitimler(rows as Egitim[]),
      muayeneler:     (rows) => setMuayeneler(rows as Muayene[]),
      uygunsuzluklar: (rows) => setUygunsuzluklar((rows as Uygunsuzluk[]).map(u => ({ ...u, durum: (u.durum === 'Kapatıldı' ? 'Kapandı' : u.durum === 'İncelemede' ? 'Açık' : u.durum) as UygunsuzlukStatus }))),
      ekipmanlar:     (rows) => setEkipmanlar(rows as Ekipman[]),
      gorevler:       (rows) => setGorevler(rows as Gorev[]),
      tutanaklar:     (rows) => setTutanaklar(rows as Tutanak[]),
      is_izinleri:    (rows) => setIsIzinleri(rows as IsIzni[]),
    };

    const TABLES = Object.keys(TABLE_MAP);

    const reloadTable = async (table: string) => {
      const { data, error } = await supabase
        .from(table)
        .select('id, data, created_at')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error || !data) return;
      const rows = data.map(r => r.data as unknown);
      TABLE_MAP[table]?.(rows);
    };

    let channel = supabase.channel(`isg_realtime_${organizationId}`);

    TABLES.forEach(table => {
      channel = channel.on(
        'postgres_changes' as Parameters<typeof channel.on>[0],
        { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` } as Parameters<typeof channel.on>[1],
        (payload: { eventType: string; new: { user_id?: string } }) => {
          const remoteUserId = (payload.new as { user_id?: string })?.user_id;
          if (remoteUserId && remoteUserId === userId) return;
          reloadTable(table);
          const MODULE_NAMES: Record<string, string> = {
            firmalar: 'Firmalar', personeller: 'Personeller', evraklar: 'Evraklar',
            egitimler: 'Eğitimler', muayeneler: 'Muayeneler', uygunsuzluklar: 'Saha Denetim',
            ekipmanlar: 'Ekipmanlar', gorevler: 'Görevler', tutanaklar: 'Tutanaklar', is_izinleri: 'İş İzinleri',
          };
          onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
        },
      ) as typeof channel;
    });

    channel.subscribe((status) => {
      console.log(`[ISG] Realtime ${status} for org=${organizationId}`);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, orgLoading]);

  // ──────── FIRMA ────────
  const addFirma = useCallback((firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newFirma: Firma = { ...firma, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setFirmalar(prev => [newFirma, ...prev]);
    saveToDb('firmalar', newFirma as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('firma_created', 'Firmalar', newFirma.id, newFirma.ad, `${newFirma.ad} firması oluşturuldu.`);
    return newFirma;
  }, [setFirmalar, saveToDb]);

  const updateFirma = useCallback((id: string, updates: Partial<Firma>) => {
    let updated: Firma | null = null;
    setFirmalar(prev => prev.map(f => {
      if (f.id !== id) return f;
      updated = { ...f, ...updates, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('firmalar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('firma_updated', 'Firmalar', id, updates.ad, 'Firma bilgileri güncellendi.');
  }, [setFirmalar, saveToDb]);

  const deleteFirma = useCallback((id: string) => {
    const now = new Date().toISOString();
    const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: id };
    const updatedItems: { table: string; item: { id: string } & Record<string, unknown> }[] = [];

    setFirmalar(prev => prev.map(f => {
      if (f.id !== id) return f;
      const u = { ...f, silinmis: true as const, silinmeTarihi: now };
      updatedItems.push({ table: 'firmalar', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setPersoneller(prev => prev.map(p => {
      if (p.firmaId !== id || p.silinmis) return p;
      const u = { ...p, ...cascadeFields };
      updatedItems.push({ table: 'personeller', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setEvraklar(prev => prev.map(e => {
      if (e.silinmis || e.firmaId !== id || e.personelId) return e;
      const u = { ...e, ...cascadeFields };
      updatedItems.push({ table: 'evraklar', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setEgitimler(prev => prev.map(e => {
      if (e.firmaId !== id || e.silinmis) return e;
      const u = { ...e, ...cascadeFields };
      updatedItems.push({ table: 'egitimler', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setMuayeneler(prev => prev.map(m => {
      if (m.firmaId !== id || m.silinmis) return m;
      const u = { ...m, ...cascadeFields };
      updatedItems.push({ table: 'muayeneler', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.firmaId !== id || u.silinmis) return u;
      const updated = { ...u, ...cascadeFields };
      updatedItems.push({ table: 'uygunsuzluklar', item: updated as unknown as { id: string } & Record<string, unknown> });
      return updated;
    }));
    setEkipmanlar(prev => prev.map(e => {
      if (e.firmaId !== id || e.silinmis) return e;
      const u = { ...e, ...cascadeFields };
      updatedItems.push({ table: 'ekipmanlar', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setGorevler(prev => prev.map(g => {
      if (g.firmaId !== id || g.silinmis) return g;
      const u = { ...g, ...cascadeFields };
      updatedItems.push({ table: 'gorevler', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));

    updatedItems.forEach(({ table, item }) => saveToDb(table, item));
    logFnRef.current?.('firma_deleted', 'Firmalar', id, undefined, 'Firma silindi.');
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, saveToDb]);

  const restoreFirma = useCallback((id: string) => {
    const rf = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
    const updatedItems: { table: string; item: { id: string } & Record<string, unknown> }[] = [];

    const updateAndCollect = <T extends { id: string }>(
      setter: (fn: (prev: T[]) => T[]) => void,
      table: string,
      predicate: (item: T) => boolean,
    ) => {
      setter(prev => prev.map(item => {
        if (!predicate(item)) return item;
        const u = { ...item, ...rf };
        updatedItems.push({ table, item: u as unknown as { id: string } & Record<string, unknown> });
        return u;
      }));
    };

    setFirmalar(prev => prev.map(f => {
      if (f.id !== id) return f;
      const u = { ...f, silinmis: false as const, silinmeTarihi: undefined };
      updatedItems.push({ table: 'firmalar', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    updateAndCollect<Personel>(setPersoneller, 'personeller', p => p.cascadeFirmaId === id && !!p.cascadeSilindi);
    updateAndCollect<Evrak>(setEvraklar, 'evraklar', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    updateAndCollect<Egitim>(setEgitimler, 'egitimler', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    updateAndCollect<Muayene>(setMuayeneler, 'muayeneler', m => m.cascadeFirmaId === id && !!m.cascadeSilindi);
    updateAndCollect<Uygunsuzluk>(setUygunsuzluklar, 'uygunsuzluklar', u => u.cascadeFirmaId === id && !!u.cascadeSilindi);
    updateAndCollect<Ekipman>(setEkipmanlar, 'ekipmanlar', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    updateAndCollect<Gorev>(setGorevler, 'gorevler', g => g.cascadeFirmaId === id && !!g.cascadeSilindi);

    updatedItems.forEach(({ table, item }) => saveToDb(table, item));
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, saveToDb]);

  const permanentDeleteFirma = useCallback(async (id: string) => {
    // Snapshot all affected state for rollback
    let snapshotFirmalar: Firma[] = [];
    let snapshotPersoneller: Personel[] = [];
    let snapshotEvraklar: Evrak[] = [];
    let snapshotEgitimler: Egitim[] = [];
    let snapshotMuayeneler: Muayene[] = [];
    let snapshotUyg: Uygunsuzluk[] = [];
    let snapshotEkipmanlar: Ekipman[] = [];
    let snapshotGorevler: Gorev[] = [];

    let personelIds: string[] = [];
    let evrakIds: string[] = [];
    let egitimIds: string[] = [];
    let muayeneIds: string[] = [];
    let uygIds: string[] = [];
    let ekipmanIds: string[] = [];
    let gorevIds: string[] = [];

    // Optimistic UI update — collect snapshots and IDs simultaneously
    await Promise.all([
      new Promise<void>(resolve => { _setFirmalar(prev => { snapshotFirmalar = prev; resolve(); return prev.filter(f => f.id !== id); }); }),
      new Promise<void>(resolve => { _setPersoneller(prev => { snapshotPersoneller = prev; personelIds = prev.filter(p => p.firmaId === id).map(p => p.id); resolve(); return prev.filter(p => p.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setEvraklar(prev => { snapshotEvraklar = prev; evrakIds = prev.filter(e => e.firmaId === id).map(e => e.id); resolve(); return prev.filter(e => e.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setEgitimler(prev => { snapshotEgitimler = prev; egitimIds = prev.filter(e => e.firmaId === id).map(e => e.id); resolve(); return prev.filter(e => e.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setMuayeneler(prev => { snapshotMuayeneler = prev; muayeneIds = prev.filter(m => m.firmaId === id).map(m => m.id); resolve(); return prev.filter(m => m.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setUygunsuzluklar(prev => { snapshotUyg = prev; uygIds = prev.filter(u => u.firmaId === id).map(u => u.id); resolve(); return prev.filter(u => u.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setEkipmanlar(prev => { snapshotEkipmanlar = prev; ekipmanIds = prev.filter(e => e.firmaId === id).map(e => e.id); resolve(); return prev.filter(e => e.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setGorevler(prev => { snapshotGorevler = prev; gorevIds = prev.filter(g => g.firmaId === id).map(g => g.id); resolve(); return prev.filter(g => g.firmaId !== id); }); }),
    ]);

    try {
      await Promise.all([
        dbDelete('firmalar', id),
        dbDeleteMany('personeller', personelIds),
        dbDeleteMany('evraklar', evrakIds),
        dbDeleteMany('egitimler', egitimIds),
        dbDeleteMany('muayeneler', muayeneIds),
        dbDeleteMany('uygunsuzluklar', uygIds),
        dbDeleteMany('ekipmanlar', ekipmanIds),
        dbDeleteMany('gorevler', gorevIds),
      ]);
    } catch (err) {
      console.error('[ISG] permanentDeleteFirma FAILED, rolling back:', err);
      _setFirmalar(snapshotFirmalar);
      _setPersoneller(snapshotPersoneller);
      _setEvraklar(snapshotEvraklar);
      _setEgitimler(snapshotEgitimler);
      _setMuayeneler(snapshotMuayeneler);
      _setUygunsuzluklar(snapshotUyg);
      _setEkipmanlar(snapshotEkipmanlar);
      _setGorevler(snapshotGorevler);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (firma): ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // ──────── PERSONEL ────────
  const addPersonel = useCallback((personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newPersonel: Personel = { ...personel, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setPersoneller(prev => [newPersonel, ...prev]);
    saveToDb('personeller', newPersonel as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('personel_created', 'Personeller', newPersonel.id, newPersonel.adSoyad, `${newPersonel.adSoyad} personel olarak eklendi.`);
    return newPersonel;
  }, [setPersoneller, saveToDb]);

  const updatePersonel = useCallback((id: string, updates: Partial<Personel>) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      updated = { ...p, ...updates, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setPersoneller, saveToDb]);

  const deletePersonel = useCallback((id: string) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      updated = { ...p, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('personel_deleted', 'Personeller', id, undefined, 'Personel silindi.');
  }, [setPersoneller, saveToDb]);

  const restorePersonel = useCallback((id: string) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      updated = { ...p, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setPersoneller, saveToDb]);

  const personellerRef = useRef<Personel[]>([]);
  useEffect(() => { personellerRef.current = personeller; }, [personeller]);

  const permanentDeletePersonel = useCallback(async (id: string) => {
    const snapshot = personellerRef.current;
    _setPersoneller(prev => prev.filter(p => p.id !== id));
    try {
      await dbDelete('personeller', id);
    } catch (err) {
      console.error('[ISG] permanentDeletePersonel FAILED, rolling back:', err);
      _setPersoneller(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (personeller): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── EVRAK ────────
  const addEvrak = useCallback((evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    // dosyaVeri (base64) artık kabul edilmiyor — sadece dosyaUrl kullanılır
    const { dosyaVeri: _ignored, ...rest } = evrak as Evrak & { dosyaVeri?: string };
    const kategori = evrak.kategori || getEvrakKategori(evrak.tur, evrak.ad);
    const newEvrak: Evrak = { ...rest, kategori, id, olusturmaTarihi: new Date().toISOString() };
    setEvraklar(prev => [newEvrak, ...prev]);
    saveToDb('evraklar', newEvrak as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_created', 'Evraklar', id, newEvrak.ad, `${newEvrak.ad} evrakı eklendi.`);
    return newEvrak;
  }, [setEvraklar, saveToDb]);

  const updateEvrak = useCallback((id: string, updates: Partial<Evrak>) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Evrak> & { dosyaVeri?: string };
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => {
      if (e.id !== id) return e;
      const merged = { ...e, ...rest };
      if (rest.tur !== undefined || rest.ad !== undefined) merged.kategori = getEvrakKategori(merged.tur, merged.ad);
      updated = merged;
      return merged;
    }));
    if (updated) saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEvraklar, saveToDb]);

  const deleteEvrak = useCallback((id: string) => {
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_deleted', 'Evraklar', id, undefined, 'Evrak silindi.');
  }, [setEvraklar, saveToDb]);

  const restoreEvrak = useCallback((id: string) => {
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEvraklar, saveToDb]);

  const evraklarRef = useRef<Evrak[]>([]);
  useEffect(() => { evraklarRef.current = evraklar; }, [evraklar]);

  const permanentDeleteEvrak = useCallback(async (id: string) => {
    const snapshot = evraklarRef.current;
    _setEvraklar(prev => prev.filter(e => e.id !== id));
    try {
      await dbDelete('evraklar', id);
    } catch (err) {
      console.error('[ISG] permanentDeleteEvrak FAILED, rolling back:', err);
      _setEvraklar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (evraklar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── EĞİTİM ────────
  const addEgitim = useCallback((egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const { belgeDosyaVeri: _ignored, ...rest } = egitim as Egitim & { belgeDosyaVeri?: string };
    const newEgitim: Egitim = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    setEgitimler(prev => [newEgitim, ...prev]);
    saveToDb('egitimler', newEgitim as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_created', 'Eğitimler', id, newEgitim.ad, `${newEgitim.ad} eğitimi oluşturuldu.`);
    return newEgitim;
  }, [setEgitimler, saveToDb]);

  const updateEgitim = useCallback((id: string, updates: Partial<Egitim>) => {
    const { belgeDosyaVeri: _ignored, ...rest } = updates as Partial<Egitim> & { belgeDosyaVeri?: string };
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, ...rest };
      return updated;
    }));
    if (updated) saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEgitimler, saveToDb]);

  const deleteEgitim = useCallback((id: string) => {
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_deleted', 'Eğitimler', id, undefined, 'Eğitim silindi.');
  }, [setEgitimler, saveToDb]);

  const restoreEgitim = useCallback((id: string) => {
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEgitimler, saveToDb]);

  const egitimlerRef = useRef<Egitim[]>([]);
  useEffect(() => { egitimlerRef.current = egitimler; }, [egitimler]);

  const permanentDeleteEgitim = useCallback(async (id: string) => {
    const snapshot = egitimlerRef.current;
    _setEgitimler(prev => prev.filter(e => e.id !== id));
    try {
      await dbDelete('egitimler', id);
    } catch (err) {
      console.error('[ISG] permanentDeleteEgitim FAILED, rolling back:', err);
      _setEgitimler(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (egitimler): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── MUAYENE ────────
  const addMuayene = useCallback((muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => {
    const newMuayene: Muayene = { ...muayene, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setMuayeneler(prev => [newMuayene, ...prev]);
    saveToDb('muayeneler', newMuayene as unknown as { id: string } & Record<string, unknown>);
    return newMuayene;
  }, [setMuayeneler, saveToDb]);

  const updateMuayene = useCallback((id: string, updates: Partial<Muayene>) => {
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => {
      if (m.id !== id) return m;
      updated = { ...m, ...updates };
      return updated;
    }));
    if (updated) saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setMuayeneler, saveToDb]);

  const deleteMuayene = useCallback((id: string) => {
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => {
      if (m.id !== id) return m;
      updated = { ...m, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('muayene_deleted', 'Sağlık', id, undefined, 'Sağlık evrakı silindi.');
  }, [setMuayeneler, saveToDb]);

  const restoreMuayene = useCallback((id: string) => {
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => {
      if (m.id !== id) return m;
      updated = { ...m, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setMuayeneler, saveToDb]);

  const muayenelerRef = useRef<Muayene[]>([]);
  useEffect(() => { muayenelerRef.current = muayeneler; }, [muayeneler]);

  const permanentDeleteMuayene = useCallback(async (id: string) => {
    const snapshot = muayenelerRef.current;
    _setMuayeneler(prev => prev.filter(m => m.id !== id));
    try {
      await dbDelete('muayeneler', id);
    } catch (err) {
      console.error('[ISG] permanentDeleteMuayene FAILED, rolling back:', err);
      _setMuayeneler(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (muayeneler): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── UYGUNSUZLUK ────────
  const addUygunsuzluk = useCallback(async (u: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const now = new Date().toISOString();
    // Supabase RPC ile race-condition-safe numara üret, fallback: frontend
    const rpcNo = await generateRecordNoFromDB('dof');
    const acilisNo = rpcNo ?? generateDofNo(uygRef.current);
    const durum = u.kapatmaFotoMevcut ? 'Kapandı' as const : 'Açık' as const;
    const newU: Uygunsuzluk = { ...u, id, durum, olusturmaTarihi: now, acilisNo };
    setUygunsuzluklar(prev => [newU, ...prev]);
    saveToDb('uygunsuzluklar', newU as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('uygunsuzluk_created', 'Uygunsuzluklar', id, u.baslik, `${u.baslik} uygunsuzluk kaydı oluşturuldu.`);
    return newU;
  }, [setUygunsuzluklar, saveToDb]);

  const updateUygunsuzluk = useCallback((id: string, updates: Partial<Uygunsuzluk>) => {
    let updated: Uygunsuzluk | null = null;
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.id !== id) return u;
      const merged = { ...u, ...updates };
      merged.durum = merged.kapatmaFotoMevcut ? 'Kapandı' : 'Açık';
      updated = merged;
      return merged;
    }));
    if (updated) saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>);
    if (updates.kapatmaFotoMevcut) logFnRef.current?.('uygunsuzluk_closed', 'Uygunsuzluklar', id, updates.baslik, 'Uygunsuzluk kapatıldı.');
  }, [setUygunsuzluklar, saveToDb]);

  const deleteUygunsuzluk = useCallback((id: string) => {
    let updated: Uygunsuzluk | null = null;
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.id !== id) return u;
      updated = { ...u, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('uygunsuzluk_deleted', 'Uygunsuzluklar', id, undefined, 'Uygunsuzluk silindi.');
  }, [setUygunsuzluklar, saveToDb]);

  const uygunsuzluklarRef = useRef<Uygunsuzluk[]>([]);
  useEffect(() => { uygunsuzluklarRef.current = uygunsuzluklar; }, [uygunsuzluklar]);

  const permanentDeleteUygunsuzluk = useCallback(async (id: string) => {
    const snapshot = uygunsuzluklarRef.current;
    _setUygunsuzluklar(prev => prev.filter(u => u.id !== id));
    try {
      await dbDelete('uygunsuzluklar', id);
      console.log(`[ISG] permanentDeleteUygunsuzluk OK: ${id}`);
    } catch (err) {
      console.error('[ISG] permanentDeleteUygunsuzluk FAILED, rolling back:', err);
      _setUygunsuzluklar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (uygunsuzluklar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  const getUygunsuzlukPhoto = useCallback((id: string, type: 'acilis' | 'kapatma'): string | undefined => {
    const record = uygRef.current.find(u => u.id === id);
    if (record) {
      const url = type === 'acilis' ? record.acilisFotoUrl : record.kapatmaFotoUrl;
      if (url) return url;
    }
    return undefined;
  }, []);

  const setUygunsuzlukPhoto = useCallback(async (id: string, type: 'acilis' | 'kapatma', base64: string): Promise<string | null> => {
    try {
      const orgId = orgIdRef.current ?? 'unknown';
      const [meta, data] = base64.split(',');
      const mimeMatch = meta.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
      const byteString = atob(data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mime });
      const file = new File([blob], `${type}-${id}.${ext}`, { type: mime });

      // Tek standart path: {orgId}/{module}/{id}.{ext}
      const url = await uploadFileToStorage(file, orgId, `uygunsuzluk-${type}`, id);
      console.log(`[ISG] Photo uploaded to Storage: ${url}`);
      return url;
    } catch (err) {
      console.error('[ISG] setUygunsuzlukPhoto error:', err);
      return null;
    }
  }, []);

  // ──────── EKİPMAN ────────
  const addEkipman = useCallback((e: Omit<Ekipman, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const { dosyaVeri: _ignored, ...rest } = e as Ekipman & { dosyaVeri?: string };
    const newE: Ekipman = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    setEkipmanlar(prev => [newE, ...prev]);
    saveToDb('ekipmanlar', newE as unknown as { id: string } & Record<string, unknown>);
    return newE;
  }, [setEkipmanlar, saveToDb]);

  // Fields that denetci role is allowed to update (FIX 1: field-level restriction)
  const DENETCI_ALLOWED_EKIPMAN_FIELDS = new Set([
    'sonKontrolTarihi', 'sonrakiKontrolTarihi', 'durum', 'kontrolGecmisi', 'notlar',
  ]);

  const updateEkipman = useCallback((id: string, updates: Partial<Ekipman>, callerRole?: string) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Ekipman> & { dosyaVeri?: string };

    // FIX 1: If caller is denetci, only allow whitelisted fields
    let safeRest = rest;
    if (callerRole === 'denetci') {
      safeRest = Object.fromEntries(
        Object.entries(rest).filter(([key]) => DENETCI_ALLOWED_EKIPMAN_FIELDS.has(key))
      ) as Partial<Ekipman>;
    }

    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, ...safeRest };
      return updated;
    }));
    if (updated) saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEkipmanlar, saveToDb]);

  const deleteEkipman = useCallback((id: string) => {
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('ekipman_deleted', 'Ekipmanlar', id, undefined, 'Ekipman silindi.');
  }, [setEkipmanlar, saveToDb]);

  const restoreEkipman = useCallback((id: string) => {
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEkipmanlar, saveToDb]);

  const ekipmanlarRef = useRef<Ekipman[]>([]);
  useEffect(() => { ekipmanlarRef.current = ekipmanlar; }, [ekipmanlar]);

  const permanentDeleteEkipman = useCallback(async (id: string) => {
    const snapshot = ekipmanlarRef.current;
    _setEkipmanlar(prev => prev.filter(e => e.id !== id));
    try {
      await dbDelete('ekipmanlar', id);
      console.log(`[ISG] permanentDeleteEkipman OK: ${id}`);
    } catch (err) {
      console.error('[ISG] permanentDeleteEkipman FAILED, rolling back:', err);
      _setEkipmanlar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (ekipmanlar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  const permanentDeleteEkipmanMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const snapshot = ekipmanlarRef.current;
    _setEkipmanlar(prev => prev.filter(e => !ids.includes(e.id)));
    try {
      await dbDeleteMany('ekipmanlar', ids);
      console.log(`[ISG] permanentDeleteEkipmanMany OK: ${ids.length} items`);
    } catch (err) {
      console.error('[ISG] permanentDeleteEkipmanMany FAILED, rolling back:', err);
      _setEkipmanlar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (ekipmanlar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── GÖREV ────────
  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>) => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setGorevler(prev => [newG, ...prev]);
    saveToDb('gorevler', newG as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('gorev_created', 'Görevler', newG.id, newG.baslik, `${newG.baslik} görevi oluşturuldu.`);
    return newG;
  }, [setGorevler, saveToDb]);

  const updateGorev = useCallback((id: string, updates: Partial<Gorev>) => {
    let updated: Gorev | null = null;
    setGorevler(prev => prev.map(g => {
      if (g.id !== id) return g;
      updated = { ...g, ...updates };
      return updated;
    }));
    if (updated) saveToDb('gorevler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setGorevler, saveToDb]);

  const deleteGorev = useCallback((id: string) => {
    setGorevler(prev => prev.filter(g => g.id !== id));
    deleteFromDb('gorevler', id);
  }, [setGorevler, deleteFromDb]);

  // ──────── TUTANAK ────────
  const addTutanak = useCallback(async (t: Omit<Tutanak, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri: _ignored, ...rest } = t as Tutanak & { dosyaVeri?: string };
    const rpcNo = await generateRecordNoFromDB('tutanak');
    // Fallback: fetch fresh count from DB to avoid stale-ref race condition
    let tutanakNo: string;
    if (rpcNo) {
      tutanakNo = rpcNo;
    } else {
      // Fresh fetch from DB to avoid stale tutRef race condition
      const orgId = orgIdRef.current;
      if (orgId) {
        const { data } = await supabase.from('tutanaklar').select('data').eq('organization_id', orgId);
        const freshList = (data ?? []).map(r => r.data as { tutanakNo: string });
        tutanakNo = generateTutanakNo(freshList);
      } else {
        tutanakNo = generateTutanakNo(tutRef.current);
      }
    }
    const newT: Tutanak = { ...rest, id, tutanakNo, olusturmaTarihi: now, guncellemeTarihi: now };
    setTutanaklar(prev => [newT, ...prev]);
    saveToDb('tutanaklar', newT as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_created', 'Tutanaklar', id, newT.baslik, `${newT.tutanakNo} - ${newT.baslik} tutanağı oluşturuldu.`);
    return newT;
  }, [setTutanaklar, saveToDb]);

  const updateTutanak = useCallback((id: string, updates: Partial<Tutanak>) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Tutanak> & { dosyaVeri?: string };
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => {
      if (t.id !== id) return t;
      updated = { ...t, ...rest, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setTutanaklar, saveToDb]);

  const deleteTutanak = useCallback((id: string) => {
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => {
      if (t.id !== id) return t;
      updated = { ...t, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_deleted', 'Tutanaklar', id, undefined, 'Tutanak silindi.');
  }, [setTutanaklar, saveToDb]);

  const restoreTutanak = useCallback((id: string) => {
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => {
      if (t.id !== id) return t;
      updated = { ...t, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setTutanaklar, saveToDb]);

  const tutanaklarRef2 = useRef<Tutanak[]>([]);
  useEffect(() => { tutanaklarRef2.current = tutanaklar; }, [tutanaklar]);

  const permanentDeleteTutanak = useCallback(async (id: string) => {
    const snapshot = tutanaklarRef2.current;
    _setTutanaklar(prev => prev.filter(t => t.id !== id));
    try {
      await dbDelete('tutanaklar', id);
    } catch (err) {
      console.error('[ISG] permanentDeleteTutanak FAILED, rolling back:', err);
      _setTutanaklar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (tutanaklar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── İŞ İZNİ ────────
  const addIsIzni = useCallback(async (iz: Omit<IsIzni, 'id' | 'izinNo' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const rpcNo = await generateRecordNoFromDB('is_izni');
    const izinNo = rpcNo ?? generateIsIzniNo(isIzRef.current);
    const newIz: IsIzni = { ...iz, id, izinNo, olusturmaTarihi: now, guncellemeTarihi: now };
    setIsIzinleri(prev => [newIz, ...prev]);
    // DB'ye yazılmasını bekle ve hata fırlat — evrak yükleme bu tamamlanmadan yapılmamalı
    await saveToDb('is_izinleri', newIz as unknown as { id: string } & Record<string, unknown>, true);
    logFnRef.current?.('is_izni_created', 'İş İzinleri', id, izinNo, `${izinNo} iş izni oluşturuldu.`);
    return newIz;
  }, [setIsIzinleri, saveToDb]);

  const updateIsIzni = useCallback(async (id: string, updates: Partial<IsIzni>): Promise<void> => {
    let updated: IsIzni | null = null;
    let snapshot: IsIzni | null = null;
    setIsIzinleri(prev => prev.map(iz => {
      if (iz.id !== id) return iz;
      snapshot = iz;
      updated = { ...iz, ...updates, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) {
      try {
        await saveToDb('is_izinleri', updated as unknown as { id: string } & Record<string, unknown>, true);
      } catch (err) {
        // Rollback optimistic update on failure
        if (snapshot) {
          setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot! : iz));
        }
        throw err;
      }
    }
    logFnRef.current?.('is_izni_updated', 'İş İzinleri', id, updates.izinNo, 'İş izni güncellendi.');
  }, [setIsIzinleri, saveToDb]);

  const deleteIsIzni = useCallback((id: string) => {
    const now = new Date().toISOString();
    // Snapshot'tan updated kaydı bul — state setter async olduğu için önce ref'ten al
    const current = isIzRef.current.find(iz => iz.id === id);
    if (!current) return;
    const updated: IsIzni = { ...current, silinmis: true as const, silinmeTarihi: now };
    setIsIzinleri(prev => prev.map(iz => iz.id === id ? updated : iz));
    // is_izinleri tablosu deleted_at kolonunu kullanıyor — direkt update
    supabase
      .from('is_izinleri')
      .update({ deleted_at: now, data: updated, updated_at: now })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[ISG] deleteIsIzni DB error:', error);
          // Rollback
          setIsIzinleri(prev => prev.map(iz => iz.id === id ? current : iz));
          onSaveErrorRef.current?.(`İş izni silme hatası: ${error.message}`);
        } else {
          console.log('[ISG] deleteIsIzni OK:', id);
        }
      });
    logFnRef.current?.('is_izni_deleted', 'İş İzinleri', id, undefined, 'İş izni silindi.');
  }, [setIsIzinleri]);

  const restoreIsIzni = useCallback((id: string) => {
    const now = new Date().toISOString();
    const current = isIzRef.current.find(iz => iz.id === id);
    if (!current) return;
    const updated: IsIzni = { ...current, silinmis: false as const, silinmeTarihi: undefined };
    setIsIzinleri(prev => prev.map(iz => iz.id === id ? updated : iz));
    // is_izinleri tablosu deleted_at kolonunu kullanıyor — null'a çek
    supabase
      .from('is_izinleri')
      .update({ deleted_at: null, data: updated, updated_at: now })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[ISG] restoreIsIzni DB error:', error);
          setIsIzinleri(prev => prev.map(iz => iz.id === id ? current : iz));
        } else {
          console.log(`[ISG] restoreIsIzni OK: ${id}`);
        }
      });
  }, [setIsIzinleri]);

  const isIzinleriRef2 = useRef<IsIzni[]>([]);
  useEffect(() => { isIzinleriRef2.current = isIzinleri; }, [isIzinleri]);

  const permanentDeleteIsIzni = useCallback(async (id: string) => {
    const snapshot = isIzinleriRef2.current;
    _setIsIzinleri(prev => prev.filter(iz => iz.id !== id));
    try {
      await dbDelete('is_izinleri', id);
      logFnRef.current?.('is_izni_perm_deleted', 'İş İzinleri', id, undefined, 'İş izni kalıcı silindi.');
    } catch (err) {
      console.error('[ISG] permanentDeleteIsIzni FAILED, rolling back:', err);
      _setIsIzinleri(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (is_izinleri): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── LOGO — Supabase Storage ────────
  /**
   * Firma logosunu Storage'a yükle ve URL'yi firmalar tablosuna kaydet.
   * Artık localStorage kullanılmıyor — tüm cihazlarda çalışır.
   * file: File objesi veya zaten yüklenmiş URL string'i kabul eder.
   */
  const setFirmaLogo = useCallback(async (firmaId: string, fileOrUrl: File | string): Promise<string | null> => {
    if (typeof fileOrUrl === 'string') {
      // Zaten bir URL — sadece DB'ye kaydet
      updateFirma(firmaId, { logoUrl: fileOrUrl } as Partial<Firma>);
      return fileOrUrl;
    }
    const orgId = orgIdRef.current ?? 'unknown';
    const url = await uploadFileToStorage(fileOrUrl, orgId, 'firma-logo', firmaId);
    if (url) {
      updateFirma(firmaId, { logoUrl: url } as Partial<Firma>);
    }
    return url;
  }, [updateFirma]);



  // ──────── PERSONEL FOTO — Supabase Storage ────────
  /**
   * Personel fotoğrafını Storage'a yükle ve URL'yi personeller tablosuna kaydet.
   */
  const setPersonelFoto = useCallback(async (personelId: string, file: File): Promise<string | null> => {
    const orgId = orgIdRef.current ?? 'unknown';
    const url = await uploadFileToStorage(file, orgId, 'personel-foto', personelId);
    if (url) {
      updatePersonel(personelId, { fotoUrl: url } as Partial<Personel>);
    }
    return url;
  }, [updatePersonel]);

  const getPersonelFoto = useCallback((personelId: string): string | null => {
    const p = _setPersoneller.length !== undefined
      ? undefined
      : undefined;
    void p;
    // fotoUrl doğrudan personel state'inden okunur
    const found = personeller.find(x => x.id === personelId);
    return found?.fotoUrl ?? null;
  }, [personeller]);

  // ──────── CURRENT USER ────────
  const updateCurrentUser = useCallback((updates: Partial<CurrentUser>) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, gorevler, tutanaklar, isIzinleri, currentUser,
    dataLoading,
    isSaving: false,
    refreshAllData,
    addFirma, updateFirma, deleteFirma, restoreFirma, permanentDeleteFirma,
    addPersonel, updatePersonel, deletePersonel, restorePersonel, permanentDeletePersonel,
    addEvrak, updateEvrak, deleteEvrak, restoreEvrak, permanentDeleteEvrak,
    addEgitim, updateEgitim, deleteEgitim, restoreEgitim, permanentDeleteEgitim,
    addMuayene, updateMuayene, deleteMuayene, restoreMuayene, permanentDeleteMuayene,
    addUygunsuzluk, updateUygunsuzluk, deleteUygunsuzluk, permanentDeleteUygunsuzluk, getUygunsuzlukPhoto, setUygunsuzlukPhoto,
    addEkipman, updateEkipman, deleteEkipman, restoreEkipman, permanentDeleteEkipman, permanentDeleteEkipmanMany,
    addGorev, updateGorev, deleteGorev,
    addTutanak, updateTutanak, deleteTutanak, restoreTutanak, permanentDeleteTutanak,
    addIsIzni, updateIsIzni, deleteIsIzni, restoreIsIzni, permanentDeleteIsIzni,
    setFirmaLogo,
    getPersonelFoto, setPersonelFoto,
    updateCurrentUser,
  };
}

export type StoreType = ReturnType<typeof useStore>;