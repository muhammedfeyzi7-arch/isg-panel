import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Firma, Personel, Evrak, Egitim, Muayene, Uygunsuzluk, Ekipman, Gorev, Tutanak, CurrentUser,
  UygunsuzlukStatus,
} from '../types';
import { getEvrakKategori } from '../utils/evrakKategori';
import { supabase } from '../lib/supabase';

// ──────── File binary helpers (localStorage — binary stays local) ────────
function getFileKey(orgId: string, type: string, id: string): string {
  return `isg_org_file_${orgId}_${type}_${id}`;
}
function saveFileData(orgId: string, type: string, id: string, veri: string): void {
  try { localStorage.setItem(getFileKey(orgId, type, id), veri); } catch { /* storage full */ }
}
function getFileData(orgId: string, type: string, id: string): string | undefined {
  return localStorage.getItem(getFileKey(orgId, type, id)) ?? undefined;
}
function removeFileData(orgId: string, type: string, id: string): void {
  try { localStorage.removeItem(getFileKey(orgId, type, id)); } catch { /* ignore */ }
}

// ──────── ID & numbering ────────
function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

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
  const payload = {
    id: item.id,
    user_id: userId,
    organization_id: organizationId,
    data: item,
    updated_at: new Date().toISOString(),
  };
  console.log(`[ISG] Saving ${table}/${item.id}`, { organization_id: organizationId, user_id: userId });
  const { data, error } = await supabase.from(table).upsert(payload).select('id');
  if (error) {
    console.error(`[ISG] SAVE ERROR ${table}/${item.id}:`, error);
    throw error;
  }
  if (!data || data.length === 0) {
    const msg = `[ISG] SAVE SILENT FAIL ${table}/${item.id}: upsert returned 0 rows. Possible RLS block.`;
    console.error(msg);
    throw new Error(msg);
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
  const [currentUser, setCurrentUser] = useState<CurrentUser>(defaultUser);
  const [dataLoading, setDataLoading] = useState(true);

  const uygRef = useRef<Uygunsuzluk[]>([]);
  const tutRef = useRef<Tutanak[]>([]);
  const logFnRef = useRef(logFn);
  useEffect(() => { logFnRef.current = logFn; }, [logFn]);
  const onSaveErrorRef = useRef(onSaveError);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);

  const orgIdRef = useRef(organizationId);
  const userIdRef = useRef(userId);
  useEffect(() => { orgIdRef.current = organizationId; }, [organizationId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── Pending saves queue (saves queued before org is loaded) ──
  const pendingSavesRef = useRef<{ table: string; item: { id: string } & Record<string, unknown> }[]>([]);

  // Flush pending saves when orgId + userId become available
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    if (pendingSavesRef.current.length === 0) return;
    const pending = [...pendingSavesRef.current];
    pendingSavesRef.current = [];
    console.log(`[ISG] Flushing ${pending.length} pending saves for org=${organizationId}`);
    pending.forEach(({ table, item }) => {
      dbUpsert(table, item, userId, organizationId).then(() => {
        console.log(`[ISG] Pending save OK ${table}/${item.id} ✓`);
      }).catch(err => {
        console.error(`[ISG] Pending save FAILED ${table}/${item.id}:`, err);
        onSaveErrorRef.current?.(`Bekleyen kayıt hatası (${table}): ${err instanceof Error ? err.message : String(err)}`);
      });
    });
  }, [organizationId, userId, orgLoading]);

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

  // ── DB write helpers (use refs to always get latest ids) ──
  const saveToDb = useCallback(async (table: string, item: { id: string } & Record<string, unknown>) => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid) {
      // Queue the save — will be flushed once org becomes available
      console.warn(`[ISG] SAVE QUEUED ${table}/${item.id}: orgId=${orgId} userId=${uid} not ready yet`);
      pendingSavesRef.current.push({ table, item });
      return;
    }
    try {
      await dbUpsert(table, item, uid, orgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ISG] SAVE FAILED ${table}/${item.id}:`, msg);
      onSaveErrorRef.current?.(`Kayıt hatası (${table}): ${msg}`);
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

  // ── Load from Supabase ──
  useEffect(() => {
    if (orgLoading) return;
    if (!organizationId || !userId) {
      setFirmalar([]); setPersoneller([]); setEvraklar([]);
      setEgitimler([]); setMuayeneler([]); setUygunsuzluklar([]);
      setEkipmanlar([]); setGorevler([]); setTutanaklar([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    console.log(`[ISG] Loading data for org=${organizationId} user=${userId}`);

    const TABLES = [
      'firmalar', 'personeller', 'evraklar', 'egitimler',
      'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'gorevler', 'tutanaklar',
    ] as const;

    Promise.all(
      TABLES.map(table =>
        supabase
          .from(table)
          .select('id, data, created_at')
          .eq('user_id', userId)
          // No organization_id filter — fetch ALL user data regardless of which org it's in.
          // This prevents data loss when auto-org creation generates a new org ID.
          .order('created_at', { ascending: false }),
      ),
    ).then(results => {
      const [
        firmaRes, personelRes, evrakRes, egitimRes,
        muayeneRes, uygRes, ekipmanRes, gorevRes, tutanakRes,
      ] = results;

      const getRows = <T>(res: typeof firmaRes): T[] => {
        if (res.error) {
          console.error('[ISG] Load error:', res.error);
          return [];
        }
        return (res.data ?? []).map(row => row.data as T);
      };

      const KAN: Record<string, string> = {
        'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-',
        'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-',
      };

      setFirmalar(getRows<Firma>(firmaRes));
      setPersoneller(getRows<Personel>(personelRes).map(p => ({
        ...p, kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? ''),
      })));
      setEvraklar(getRows<Evrak>(evrakRes).map(e => ({
        ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? ''),
      })));
      setEgitimler(getRows<Egitim>(egitimRes));
      setMuayeneler(getRows<Muayene>(muayeneRes));
      setUygunsuzluklar(getRows<Uygunsuzluk>(uygRes).map(u => {
        let durum = u.durum as string;
        if (durum === 'Kapatıldı') durum = 'Kapandı';
        if (durum === 'İncelemede') durum = 'Açık';
        return { ...u, durum: durum as UygunsuzlukStatus };
      }));
      setEkipmanlar(getRows<Ekipman>(ekipmanRes));
      setGorevler(getRows<Gorev>(gorevRes));
      setTutanaklar(getRows<Tutanak>(tutanakRes));

      console.log(`[ISG] Data loaded ✓ firms=${firmaRes.data?.length ?? 0} personnel=${personelRes.data?.length ?? 0}`);
      setDataLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, orgLoading]);

  // ──────── FIRMA ────────
  const addFirma = useCallback((firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newFirma: Firma = { ...firma, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setFirmalar(prev => [...prev, newFirma]);
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

    // Persist all cascade changes
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

  const permanentDeleteFirma = useCallback((id: string) => {
    const orgId = orgIdRef.current ?? '';
    removeFileData(orgId, 'firmalogo', id);

    let personelIds: string[] = [];
    let evrakIds: string[] = [];
    let egitimIds: string[] = [];
    let uygIds: string[] = [];
    let ekipmanIds: string[] = [];
    let gorevIds: string[] = [];

    setPersoneller(prev => { personelIds = prev.filter(p => p.firmaId === id).map(p => p.id); return prev.filter(p => p.firmaId !== id); });
    setEvraklar(prev => { evrakIds = prev.filter(e => e.firmaId === id).map(e => e.id); evrakIds.forEach(eid => removeFileData(orgId, 'evrak', eid)); return prev.filter(e => e.firmaId !== id); });
    setEgitimler(prev => { egitimIds = prev.filter(e => e.firmaId === id).map(e => e.id); return prev.filter(e => e.firmaId !== id); });
    setMuayeneler(prev => prev.filter(m => m.firmaId !== id));
    setUygunsuzluklar(prev => { uygIds = prev.filter(u => u.firmaId === id).map(u => u.id); return prev.filter(u => u.firmaId !== id); });
    setEkipmanlar(prev => { ekipmanIds = prev.filter(e => e.firmaId === id).map(e => e.id); return prev.filter(e => e.firmaId !== id); });
    setGorevler(prev => { gorevIds = prev.filter(g => g.firmaId === id).map(g => g.id); return prev.filter(g => g.firmaId !== id); });
    setFirmalar(prev => prev.filter(f => f.id !== id));

    // Cascade permanent deletes from Supabase
    deleteFromDb('firmalar', id);
    deleteManyFromDb('personeller', personelIds);
    deleteManyFromDb('evraklar', evrakIds);
    deleteManyFromDb('egitimler', egitimIds);
    deleteManyFromDb('muayeneler', []);
    deleteManyFromDb('uygunsuzluklar', uygIds);
    deleteManyFromDb('ekipmanlar', ekipmanIds);
    deleteManyFromDb('gorevler', gorevIds);
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, deleteFromDb, deleteManyFromDb]);

  // ──────── PERSONEL ────────
  const addPersonel = useCallback((personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newPersonel: Personel = { ...personel, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setPersoneller(prev => [...prev, newPersonel]);
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

  const permanentDeletePersonel = useCallback((id: string) => {
    setPersoneller(prev => prev.filter(p => p.id !== id));
    deleteFromDb('personeller', id);
  }, [setPersoneller, deleteFromDb]);

  // ──────── EVRAK ────────
  const addEvrak = useCallback((evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const id = genId();
    const { dosyaVeri, ...rest } = evrak;
    const kategori = evrak.kategori || getEvrakKategori(evrak.tur, evrak.ad);
    const newEvrak: Evrak = { ...rest, kategori, id, olusturmaTarihi: new Date().toISOString() };
    if (dosyaVeri) saveFileData(orgId, 'evrak', id, dosyaVeri);
    setEvraklar(prev => [...prev, newEvrak]);
    saveToDb('evraklar', newEvrak as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_created', 'Evraklar', id, newEvrak.ad, `${newEvrak.ad} evrakı eklendi.`);
    return { ...newEvrak, dosyaVeri };
  }, [setEvraklar, saveToDb]);

  const updateEvrak = useCallback((id: string, updates: Partial<Evrak>) => {
    const orgId = orgIdRef.current ?? '';
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(orgId, 'evrak', id, dosyaVeri);
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

  const permanentDeleteEvrak = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'evrak', id);
    setEvraklar(prev => prev.filter(e => e.id !== id));
    deleteFromDb('evraklar', id);
  }, [setEvraklar, deleteFromDb]);

  const getEvrakFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'evrak', id), []);

  // ──────── EĞİTİM ────────
  const addEgitim = useCallback((egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const id = genId();
    const { belgeDosyaVeri, ...rest } = egitim;
    const newEgitim: Egitim = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    if (belgeDosyaVeri) saveFileData(orgId, 'egitim', id, belgeDosyaVeri);
    setEgitimler(prev => [...prev, newEgitim]);
    saveToDb('egitimler', newEgitim as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_created', 'Eğitimler', id, newEgitim.ad, `${newEgitim.ad} eğitimi oluşturuldu.`);
    return newEgitim;
  }, [setEgitimler, saveToDb]);

  const updateEgitim = useCallback((id: string, updates: Partial<Egitim>) => {
    const orgId = orgIdRef.current ?? '';
    const { belgeDosyaVeri, ...rest } = updates;
    if (belgeDosyaVeri) saveFileData(orgId, 'egitim', id, belgeDosyaVeri);
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, ...rest };
      return updated;
    }));
    if (updated) saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEgitimler, saveToDb]);

  const deleteEgitim = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'egitim', id);
    setEgitimler(prev => prev.filter(e => e.id !== id));
    deleteFromDb('egitimler', id);
  }, [setEgitimler, deleteFromDb]);

  const getEgitimFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'egitim', id), []);

  // ──────── MUAYENE ────────
  const addMuayene = useCallback((muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => {
    const newMuayene: Muayene = { ...muayene, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setMuayeneler(prev => [...prev, newMuayene]);
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
    setMuayeneler(prev => prev.filter(m => m.id !== id));
    deleteFromDb('muayeneler', id);
  }, [setMuayeneler, deleteFromDb]);

  // ──────── UYGUNSUZLUK ────────
  const addUygunsuzluk = useCallback((u: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const now = new Date().toISOString();
    const acilisNo = generateDofNo(uygRef.current);
    const durum = u.kapatmaFotoMevcut ? 'Kapandı' as const : 'Açık' as const;
    const newU: Uygunsuzluk = { ...u, id, durum, olusturmaTarihi: now, acilisNo };
    setUygunsuzluklar(prev => [...prev, newU]);
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
    const orgId = orgIdRef.current ?? '';
    removeFileData(orgId, 'uyg_acilis', id);
    removeFileData(orgId, 'uyg_kapatma', id);
    setUygunsuzluklar(prev => prev.filter(u => u.id !== id));
    deleteFromDb('uygunsuzluklar', id);
  }, [setUygunsuzluklar, deleteFromDb]);

  const getUygunsuzlukPhoto = useCallback((id: string, type: 'acilis' | 'kapatma') =>
    getFileData(orgIdRef.current ?? '', `uyg_${type}`, id), []);

  const setUygunsuzlukPhoto = useCallback(async (id: string, type: 'acilis' | 'kapatma', base64: string): Promise<string | null> => {
    saveFileData(orgIdRef.current ?? '', `uyg_${type}`, id, base64);
    return null;
  }, []);

  // ──────── EKİPMAN ────────
  const addEkipman = useCallback((e: Omit<Ekipman, 'id' | 'olusturmaTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const id = genId();
    const { dosyaVeri, ...rest } = e;
    const newE: Ekipman = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    if (dosyaVeri) saveFileData(orgId, 'ekipman', id, dosyaVeri);
    setEkipmanlar(prev => [...prev, newE]);
    saveToDb('ekipmanlar', newE as unknown as { id: string } & Record<string, unknown>);
    return newE;
  }, [setEkipmanlar, saveToDb]);

  const updateEkipman = useCallback((id: string, updates: Partial<Ekipman>) => {
    const orgId = orgIdRef.current ?? '';
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(orgId, 'ekipman', id, dosyaVeri);
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, ...rest };
      return updated;
    }));
    if (updated) saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEkipmanlar, saveToDb]);

  const deleteEkipman = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'ekipman', id);
    setEkipmanlar(prev => prev.filter(e => e.id !== id));
    deleteFromDb('ekipmanlar', id);
  }, [setEkipmanlar, deleteFromDb]);

  const getEkipmanFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'ekipman', id), []);

  // ──────── GÖREV ────────
  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>) => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setGorevler(prev => [...prev, newG]);
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
  const addTutanak = useCallback((t: Omit<Tutanak, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri, ...rest } = t;
    const tutanakNo = generateTutanakNo(tutRef.current);
    const newT: Tutanak = { ...rest, id, tutanakNo, olusturmaTarihi: now, guncellemeTarihi: now };
    if (dosyaVeri) saveFileData(orgId, 'tutanak', id, dosyaVeri);
    setTutanaklar(prev => [...prev, newT]);
    saveToDb('tutanaklar', newT as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_created', 'Tutanaklar', id, newT.baslik, `${newT.tutanakNo} - ${newT.baslik} tutanağı oluşturuldu.`);
    return { ...newT, dosyaVeri };
  }, [setTutanaklar, saveToDb]);

  const updateTutanak = useCallback((id: string, updates: Partial<Tutanak>) => {
    const orgId = orgIdRef.current ?? '';
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(orgId, 'tutanak', id, dosyaVeri);
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => {
      if (t.id !== id) return t;
      updated = { ...t, ...rest, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setTutanaklar, saveToDb]);

  const deleteTutanak = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'tutanak', id);
    setTutanaklar(prev => prev.filter(t => t.id !== id));
    deleteFromDb('tutanaklar', id);
  }, [setTutanaklar, deleteFromDb]);

  const getTutanakFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'tutanak', id), []);

  // ──────── LOGO ────────
  const getFirmaLogo = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'firmalogo', id), []);
  const setFirmaLogo = useCallback((id: string, logo: string) => saveFileData(orgIdRef.current ?? '', 'firmalogo', id, logo), []);
  const clearFirmaLogo = useCallback((id: string) => removeFileData(orgIdRef.current ?? '', 'firmalogo', id), []);

  // ──────── CURRENT USER ────────
  const updateCurrentUser = useCallback((updates: Partial<CurrentUser>) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, gorevler, tutanaklar, currentUser,
    dataLoading,
    isSaving: false,
    addFirma, updateFirma, deleteFirma, restoreFirma, permanentDeleteFirma,
    addPersonel, updatePersonel, deletePersonel, restorePersonel, permanentDeletePersonel,
    addEvrak, updateEvrak, deleteEvrak, restoreEvrak, permanentDeleteEvrak, getEvrakFile,
    addEgitim, updateEgitim, deleteEgitim, getEgitimFile,
    addMuayene, updateMuayene, deleteMuayene,
    addUygunsuzluk, updateUygunsuzluk, deleteUygunsuzluk, getUygunsuzlukPhoto, setUygunsuzlukPhoto,
    addEkipman, updateEkipman, deleteEkipman, getEkipmanFile,
    addGorev, updateGorev, deleteGorev,
    addTutanak, updateTutanak, deleteTutanak, getTutanakFile,
    getFirmaLogo, setFirmaLogo, clearFirmaLogo,
    updateCurrentUser,
  };
}

export type StoreType = ReturnType<typeof useStore>;
