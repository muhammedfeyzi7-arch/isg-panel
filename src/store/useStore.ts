import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Firma, Personel, Evrak, Egitim, Muayene, Uygunsuzluk, Ekipman, Gorev, Tutanak, CurrentUser,
  UygunsuzlukStatus,
} from '../types';
import { getEvrakKategori } from '../utils/evrakKategori';

// ──────── File binary helpers (localStorage only — not DB) ────────
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
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
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

// ──────── Constants ────────
const KAN: Record<string, string> = {
  'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-',
  'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-',
};

const defaultUser: CurrentUser = { id: 'u1', ad: '', email: '', rol: 'Kullanıcı' };

// ──────── Storage photo upload ────────
async function uploadPhotoToStorage(orgId: string, path: string, base64: string): Promise<string | null> {
  try {
    const res = await fetch(base64);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    const filePath = `${orgId}/${path}.${ext}`;
    const { error } = await supabase.storage.from('org-photos').upload(filePath, blob, {
      upsert: true, contentType: blob.type,
    });
    if (error) { console.error('[ISG] Photo upload error:', error.message); return null; }
    const { data: urlData } = supabase.storage.from('org-photos').getPublicUrl(filePath);
    return urlData.publicUrl ?? null;
  } catch (err) {
    console.error('[ISG] Photo upload exception:', err);
    return null;
  }
}

// ──────── LogFn ────────
export type LogFn = (
  actionType: string, module: string, recordId: string, recordName?: string, description?: string,
) => void;

// ──────── Entity table names ────────
type EntityTable = 'firmalar' | 'personeller' | 'evraklar' | 'egitimler' | 'muayeneler'
  | 'uygunsuzluklar' | 'ekipmanlar' | 'gorevler' | 'tutanaklar';

// ──────── Main hook ────────
export function useStore(
  organizationId: string | null,
  logFn?: LogFn,
  onSaveError?: (msg: string) => void,
  userId?: string,
) {
  // ── Per-entity state ──
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
  const [savingCount, setSavingCount] = useState(0);

  // Refs for synchronous access (for auto-numbering, etc.)
  const uygRef = useRef<Uygunsuzluk[]>([]);
  const tutRef = useRef<Tutanak[]>([]);

  // Setters that also update refs
  const setFirmalar = useCallback((u: Firma[] | ((p: Firma[]) => Firma[])) => {
    _setFirmalar(u);
  }, []);
  const setPersoneller = useCallback((u: Personel[] | ((p: Personel[]) => Personel[])) => {
    _setPersoneller(u);
  }, []);
  const setEvraklar = useCallback((u: Evrak[] | ((p: Evrak[]) => Evrak[])) => {
    _setEvraklar(u);
  }, []);
  const setEgitimler = useCallback((u: Egitim[] | ((p: Egitim[]) => Egitim[])) => {
    _setEgitimler(u);
  }, []);
  const setMuayeneler = useCallback((u: Muayene[] | ((p: Muayene[]) => Muayene[])) => {
    _setMuayeneler(u);
  }, []);
  const setUygunsuzluklar = useCallback((u: Uygunsuzluk[] | ((p: Uygunsuzluk[]) => Uygunsuzluk[])) => {
    _setUygunsuzluklar(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      uygRef.current = next;
      return next;
    });
  }, []);
  const setEkipmanlar = useCallback((u: Ekipman[] | ((p: Ekipman[]) => Ekipman[])) => {
    _setEkipmanlar(u);
  }, []);
  const setGorevler = useCallback((u: Gorev[] | ((p: Gorev[]) => Gorev[])) => {
    _setGorevler(u);
  }, []);
  const setTutanaklar = useCallback((u: Tutanak[] | ((p: Tutanak[]) => Tutanak[])) => {
    _setTutanaklar(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      tutRef.current = next;
      return next;
    });
  }, []);

  // ── Refs for async callbacks ──
  const orgIdRef = useRef(organizationId);
  const userIdRef = useRef(userId);
  const logFnRef = useRef(logFn);
  const onSaveErrorRef = useRef(onSaveError);

  useEffect(() => { orgIdRef.current = organizationId; }, [organizationId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { logFnRef.current = logFn; }, [logFn]);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);

  // ── Save tracking ──
  const savingRef = useRef(0);
  const beginSave = useCallback(() => {
    savingRef.current++;
    if (savingRef.current === 1) setSavingCount(1);
  }, []);
  const endSave = useCallback(() => {
    savingRef.current = Math.max(0, savingRef.current - 1);
    if (savingRef.current === 0) setSavingCount(0);
  }, []);

  // ── Core DB upsert — writes one entity row ──
  const dbUpsert = useCallback(async (table: EntityTable, id: string, entityData: object) => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId) {
      console.warn('[ISG] dbUpsert: no orgId, skipping');
      return;
    }
    beginSave();
    console.log(`[ISG] Saving ${table}/${id}`);
    try {
      const { error } = await supabase
        .from(table)
        .upsert(
          {
            id,
            organization_id: orgId,
            user_id: uid ?? null,
            data: entityData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );
      if (error) {
        console.error(`[ISG] Save error ${table}/${id}:`, error.message, error.code, error.details);
        onSaveErrorRef.current?.(`Kayıt hatası (${table}): ${error.message}`);
      } else {
        console.log(`[ISG] Saved ${table}/${id} ✓`);
      }
    } catch (err) {
      console.error(`[ISG] Save exception ${table}/${id}:`, err);
      onSaveErrorRef.current?.('Bağlantı hatası: Veriler kaydedilemedi.');
    } finally {
      endSave();
    }
  }, [beginSave, endSave]);

  // ── Core DB delete ──
  const dbDelete = useCallback(async (table: EntityTable, id: string) => {
    const orgId = orgIdRef.current;
    if (!orgId) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id).eq('organization_id', orgId);
      if (error) console.error(`[ISG] Delete error ${table}/${id}:`, error.message);
      else console.log(`[ISG] Deleted ${table}/${id} ✓`);
    } catch (err) {
      console.error(`[ISG] Delete exception ${table}/${id}:`, err);
    }
  }, []);

  // ── Load all entities from DB on org change ──
  useEffect(() => {
    if (!organizationId) {
      setFirmalar([]); setPersoneller([]); setEvraklar([]);
      setEgitimler([]); setMuayeneler([]); setUygunsuzluklar([]);
      setEkipmanlar([]); setGorevler([]); setTutanaklar([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    console.log('[ISG] Loading all entities for org:', organizationId);

    const eid = (result: { data: { data: unknown }[] | null; error: { message: string } | null }) => {
      if (result.error) console.error('[ISG] Load error:', result.error.message);
      return (result.data ?? []) as { data: unknown }[];
    };

    Promise.all([
      supabase.from('firmalar').select('id,data').eq('organization_id', organizationId),
      supabase.from('personeller').select('id,data').eq('organization_id', organizationId),
      supabase.from('evraklar').select('id,data').eq('organization_id', organizationId),
      supabase.from('egitimler').select('id,data').eq('organization_id', organizationId),
      supabase.from('muayeneler').select('id,data').eq('organization_id', organizationId),
      supabase.from('uygunsuzluklar').select('id,data').eq('organization_id', organizationId),
      supabase.from('ekipmanlar').select('id,data').eq('organization_id', organizationId),
      supabase.from('gorevler').select('id,data').eq('organization_id', organizationId),
      supabase.from('tutanaklar').select('id,data').eq('organization_id', organizationId),
    ] as const).then(([firms, pers, docs, trains, exams, ncs, equips, tasks, mins]) => {
      const lFirmalar = eid(firms as Parameters<typeof eid>[0]).map(r => r.data as Firma);
      const lPersoneller = eid(pers as Parameters<typeof eid>[0]).map(r => {
        const p = r.data as Personel;
        return { ...p, kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? '') };
      });
      const lEvraklar = eid(docs as Parameters<typeof eid>[0]).map(r => {
        const e = r.data as Evrak;
        return { ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? '') };
      });
      const lEgitimler = eid(trains as Parameters<typeof eid>[0]).map(r => r.data as Egitim);
      const lMuayeneler = eid(exams as Parameters<typeof eid>[0]).map(r => r.data as Muayene);
      const lUygunsuzluklar = eid(ncs as Parameters<typeof eid>[0]).map(r => {
        const u = r.data as Uygunsuzluk;
        let durum = u.durum as string;
        if (durum === 'Kapatıldı') durum = 'Kapandı';
        if (durum === 'İncelemede') durum = 'Açık';
        return { ...u, durum: durum as UygunsuzlukStatus };
      });
      const lEkipmanlar = eid(equips as Parameters<typeof eid>[0]).map(r => r.data as Ekipman);
      const lGorevler = eid(tasks as Parameters<typeof eid>[0]).map(r => r.data as Gorev);
      const lTutanaklar = eid(mins as Parameters<typeof eid>[0]).map(r => r.data as Tutanak);

      console.log('[ISG] Loaded — firmalar:', lFirmalar.length, 'personeller:', lPersoneller.length,
        'uygunsuzluklar:', lUygunsuzluklar.length);

      setFirmalar(lFirmalar);
      setPersoneller(lPersoneller);
      setEvraklar(lEvraklar);
      setEgitimler(lEgitimler);
      setMuayeneler(lMuayeneler);
      setUygunsuzluklar(lUygunsuzluklar);
      setEkipmanlar(lEkipmanlar);
      setGorevler(lGorevler);
      setTutanaklar(lTutanaklar);
      setDataLoading(false);
    }).catch(err => {
      console.error('[ISG] Load failed:', err);
      setDataLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // ──────── FIRMA ────────
  const addFirma = useCallback((firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newFirma: Firma = { ...firma, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setFirmalar(prev => [...prev, newFirma]);
    dbUpsert('firmalar', newFirma.id, newFirma);
    logFnRef.current?.('firma_created', 'Firmalar', newFirma.id, newFirma.ad, `${newFirma.ad} firması oluşturuldu.`);
    return newFirma;
  }, [setFirmalar, dbUpsert]);

  const updateFirma = useCallback((id: string, updates: Partial<Firma>) => {
    let updated: Firma | null = null;
    setFirmalar(prev => prev.map(f => {
      if (f.id !== id) return f;
      updated = { ...f, ...updates, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    setTimeout(() => { if (updated) dbUpsert('firmalar', id, updated); }, 0);
    logFnRef.current?.('firma_updated', 'Firmalar', id, updates.ad, 'Firma bilgileri güncellendi.');
  }, [setFirmalar, dbUpsert]);

  const deleteFirma = useCallback((id: string) => {
    const now = new Date().toISOString();
    const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: id };

    setFirmalar(prev => {
      const firma = prev.find(f => f.id === id);
      const updated = prev.map(f => f.id === id ? { ...f, silinmis: true as const, silinmeTarihi: now } : f);
      const del = updated.find(f => f.id === id);
      if (del) dbUpsert('firmalar', id, del);
      logFnRef.current?.('firma_deleted', 'Firmalar', id, firma?.ad, `${firma?.ad ?? id} firması silindi.`);
      return updated;
    });

    setPersoneller(prev => prev.map(p => {
      if (p.firmaId !== id || p.silinmis) return p;
      const u = { ...p, ...cascadeFields };
      dbUpsert('personeller', p.id, u);
      return u;
    }));
    setEvraklar(prev => prev.map(e => {
      if (e.silinmis) return e;
      const hit = e.firmaId === id && !e.personelId;
      if (!hit) return e;
      const u = { ...e, ...cascadeFields };
      dbUpsert('evraklar', e.id, u);
      return u;
    }));
    setEgitimler(prev => prev.map(e => {
      if (e.firmaId !== id || e.silinmis) return e;
      const u = { ...e, ...cascadeFields };
      dbUpsert('egitimler', e.id, u);
      return u;
    }));
    setMuayeneler(prev => prev.map(m => {
      if (m.firmaId !== id || m.silinmis) return m;
      const u = { ...m, ...cascadeFields };
      dbUpsert('muayeneler', m.id, u);
      return u;
    }));
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.firmaId !== id || u.silinmis) return u;
      const upd = { ...u, ...cascadeFields };
      dbUpsert('uygunsuzluklar', u.id, upd);
      return upd;
    }));
    setEkipmanlar(prev => prev.map(e => {
      if (e.firmaId !== id || e.silinmis) return e;
      const u = { ...e, ...cascadeFields };
      dbUpsert('ekipmanlar', e.id, u);
      return u;
    }));
    setGorevler(prev => prev.map(g => {
      if ((g.firmaId !== id) || g.silinmis) return g;
      const u = { ...g, ...cascadeFields };
      dbUpsert('gorevler', g.id, u);
      return u;
    }));
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, dbUpsert]);

  const restoreFirma = useCallback((id: string) => {
    const rf = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
    setFirmalar(prev => prev.map(f => {
      if (f.id !== id) return f;
      const u = { ...f, silinmis: false as const, silinmeTarihi: undefined };
      dbUpsert('firmalar', id, u);
      return u;
    }));
    setPersoneller(prev => prev.map(p => {
      if (p.cascadeFirmaId !== id || !p.cascadeSilindi) return p;
      const u = { ...p, ...rf };
      dbUpsert('personeller', p.id, u);
      return u;
    }));
    setEvraklar(prev => prev.map(e => {
      if (e.cascadeFirmaId !== id || !e.cascadeSilindi) return e;
      const u = { ...e, ...rf };
      dbUpsert('evraklar', e.id, u);
      return u;
    }));
    setEgitimler(prev => prev.map(e => {
      if (e.cascadeFirmaId !== id || !e.cascadeSilindi) return e;
      const u = { ...e, ...rf };
      dbUpsert('egitimler', e.id, u);
      return u;
    }));
    setMuayeneler(prev => prev.map(m => {
      if (m.cascadeFirmaId !== id || !m.cascadeSilindi) return m;
      const u = { ...m, ...rf };
      dbUpsert('muayeneler', m.id, u);
      return u;
    }));
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.cascadeFirmaId !== id || !u.cascadeSilindi) return u;
      const upd = { ...u, ...rf };
      dbUpsert('uygunsuzluklar', u.id, upd);
      return upd;
    }));
    setEkipmanlar(prev => prev.map(e => {
      if (e.cascadeFirmaId !== id || !e.cascadeSilindi) return e;
      const u = { ...e, ...rf };
      dbUpsert('ekipmanlar', e.id, u);
      return u;
    }));
    setGorevler(prev => prev.map(g => {
      if (g.cascadeFirmaId !== id || !g.cascadeSilindi) return g;
      const u = { ...g, ...rf };
      dbUpsert('gorevler', g.id, u);
      return u;
    }));
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, dbUpsert]);

  const permanentDeleteFirma = useCallback((id: string) => {
    const orgId = orgIdRef.current ?? '';
    removeFileData(orgId, 'firmalogo', id);
    setFirmalar(prev => { prev.filter(f => f.id === id).forEach(() => dbDelete('firmalar', id)); return prev.filter(f => f.id !== id); });
    setPersoneller(prev => {
      const del = prev.filter(p => p.firmaId === id);
      del.forEach(p => { dbDelete('personeller', p.id); });
      return prev.filter(p => p.firmaId !== id);
    });
    setEvraklar(prev => {
      const del = prev.filter(e => e.firmaId === id);
      del.forEach(e => { removeFileData(orgId, 'evrak', e.id); dbDelete('evraklar', e.id); });
      return prev.filter(e => e.firmaId !== id);
    });
    setEgitimler(prev => {
      const del = prev.filter(e => e.firmaId === id);
      del.forEach(e => { removeFileData(orgId, 'egitim', e.id); dbDelete('egitimler', e.id); });
      return prev.filter(e => e.firmaId !== id);
    });
    setMuayeneler(prev => { prev.filter(m => m.firmaId === id).forEach(m => dbDelete('muayeneler', m.id)); return prev.filter(m => m.firmaId !== id); });
    setUygunsuzluklar(prev => { prev.filter(u => u.firmaId === id).forEach(u => dbDelete('uygunsuzluklar', u.id)); return prev.filter(u => u.firmaId !== id); });
    setEkipmanlar(prev => {
      const del = prev.filter(e => e.firmaId === id);
      del.forEach(e => { removeFileData(orgId, 'ekipman', e.id); dbDelete('ekipmanlar', e.id); });
      return prev.filter(e => e.firmaId !== id);
    });
    setGorevler(prev => { prev.filter(g => g.firmaId === id).forEach(g => dbDelete('gorevler', g.id)); return prev.filter(g => g.firmaId !== id); });
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, dbDelete]);

  // ──────── PERSONEL ────────
  const addPersonel = useCallback((personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newPersonel: Personel = { ...personel, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setPersoneller(prev => [...prev, newPersonel]);
    dbUpsert('personeller', newPersonel.id, newPersonel);
    logFnRef.current?.('personel_created', 'Personeller', newPersonel.id, newPersonel.adSoyad, `${newPersonel.adSoyad} personel olarak eklendi.`);
    return newPersonel;
  }, [setPersoneller, dbUpsert]);

  const updatePersonel = useCallback((id: string, updates: Partial<Personel>) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      updated = { ...p, ...updates, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    setTimeout(() => { if (updated) dbUpsert('personeller', id, updated); }, 0);
    if (updates.adSoyad) logFnRef.current?.('personel_updated', 'Personeller', id, updates.adSoyad, 'Personel bilgileri güncellendi.');
  }, [setPersoneller, dbUpsert]);

  const deletePersonel = useCallback((id: string) => {
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      const u = { ...p, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      dbUpsert('personeller', id, u);
      logFnRef.current?.('personel_deleted', 'Personeller', id, p.adSoyad, `${p.adSoyad} personel silindi.`);
      return u;
    }));
  }, [setPersoneller, dbUpsert]);

  const restorePersonel = useCallback((id: string) => {
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      const u = { ...p, silinmis: false as const, silinmeTarihi: undefined };
      dbUpsert('personeller', id, u);
      return u;
    }));
  }, [setPersoneller, dbUpsert]);

  const permanentDeletePersonel = useCallback((id: string) => {
    setPersoneller(prev => { dbDelete('personeller', id); return prev.filter(p => p.id !== id); });
  }, [setPersoneller, dbDelete]);

  // ──────── EVRAK ────────
  const addEvrak = useCallback((evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const id = genId();
    const { dosyaVeri, ...rest } = evrak;
    const kategori = evrak.kategori || getEvrakKategori(evrak.tur, evrak.ad);
    const newEvrak: Evrak = { ...rest, kategori, id, olusturmaTarihi: new Date().toISOString() };
    if (dosyaVeri) saveFileData(orgId, 'evrak', id, dosyaVeri);
    setEvraklar(prev => [...prev, newEvrak]);
    dbUpsert('evraklar', id, newEvrak); // no binary in DB
    logFnRef.current?.('evrak_created', 'Evraklar', id, newEvrak.ad, `${newEvrak.ad} evrakı eklendi.`);
    return { ...newEvrak, dosyaVeri };
  }, [setEvraklar, dbUpsert]);

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
    setTimeout(() => { if (updated) dbUpsert('evraklar', id, updated); }, 0);
  }, [setEvraklar, dbUpsert]);

  const deleteEvrak = useCallback((id: string) => {
    setEvraklar(prev => prev.map(e => {
      if (e.id !== id) return e;
      const u = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      dbUpsert('evraklar', id, u);
      logFnRef.current?.('evrak_deleted', 'Evraklar', id, e.ad, `${e.ad} evrakı silindi.`);
      return u;
    }));
  }, [setEvraklar, dbUpsert]);

  const restoreEvrak = useCallback((id: string) => {
    setEvraklar(prev => prev.map(e => {
      if (e.id !== id) return e;
      const u = { ...e, silinmis: false as const, silinmeTarihi: undefined };
      dbUpsert('evraklar', id, u);
      return u;
    }));
  }, [setEvraklar, dbUpsert]);

  const permanentDeleteEvrak = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'evrak', id);
    setEvraklar(prev => { dbDelete('evraklar', id); return prev.filter(e => e.id !== id); });
  }, [setEvraklar, dbDelete]);

  const getEvrakFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'evrak', id), []);

  // ──────── EĞİTİM ────────
  const addEgitim = useCallback((egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const id = genId();
    const { belgeDosyaVeri, ...rest } = egitim;
    const newEgitim: Egitim = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    if (belgeDosyaVeri) saveFileData(orgId, 'egitim', id, belgeDosyaVeri);
    setEgitimler(prev => [...prev, newEgitim]);
    dbUpsert('egitimler', id, newEgitim);
    logFnRef.current?.('egitim_created', 'Eğitimler', id, newEgitim.ad, `${newEgitim.ad} eğitimi oluşturuldu.`);
    return newEgitim;
  }, [setEgitimler, dbUpsert]);

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
    setTimeout(() => { if (updated) dbUpsert('egitimler', id, updated); }, 0);
  }, [setEgitimler, dbUpsert]);

  const deleteEgitim = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'egitim', id);
    setEgitimler(prev => { dbDelete('egitimler', id); return prev.filter(e => e.id !== id); });
  }, [setEgitimler, dbDelete]);

  const getEgitimFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'egitim', id), []);

  // ──────── MUAYENE ────────
  const addMuayene = useCallback((muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => {
    const newMuayene: Muayene = { ...muayene, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setMuayeneler(prev => [...prev, newMuayene]);
    dbUpsert('muayeneler', newMuayene.id, newMuayene);
    return newMuayene;
  }, [setMuayeneler, dbUpsert]);

  const updateMuayene = useCallback((id: string, updates: Partial<Muayene>) => {
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => {
      if (m.id !== id) return m;
      updated = { ...m, ...updates };
      return updated;
    }));
    setTimeout(() => { if (updated) dbUpsert('muayeneler', id, updated); }, 0);
  }, [setMuayeneler, dbUpsert]);

  const deleteMuayene = useCallback((id: string) => {
    setMuayeneler(prev => { dbDelete('muayeneler', id); return prev.filter(m => m.id !== id); });
  }, [setMuayeneler, dbDelete]);

  // ──────── UYGUNSUZLUK ────────
  const addUygunsuzluk = useCallback((u: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const now = new Date().toISOString();
    const acilisNo = generateDofNo(uygRef.current);
    const durum = u.kapatmaFotoMevcut ? 'Kapandı' as const : 'Açık' as const;
    const newU: Uygunsuzluk = { ...u, id, durum, olusturmaTarihi: now, acilisNo };
    setUygunsuzluklar(prev => [...prev, newU]);
    dbUpsert('uygunsuzluklar', id, newU);
    logFnRef.current?.('uygunsuzluk_created', 'Uygunsuzluklar', id, u.baslik, `${u.baslik} uygunsuzluk kaydı oluşturuldu.`);
    return newU;
  }, [setUygunsuzluklar, dbUpsert]);

  const updateUygunsuzluk = useCallback((id: string, updates: Partial<Uygunsuzluk>) => {
    let updated: Uygunsuzluk | null = null;
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.id !== id) return u;
      const merged = { ...u, ...updates };
      merged.durum = merged.kapatmaFotoMevcut ? 'Kapandı' : 'Açık';
      updated = merged;
      return merged;
    }));
    setTimeout(() => {
      if (updated) {
        dbUpsert('uygunsuzluklar', id, updated);
        if (updates.kapatmaFotoMevcut) logFnRef.current?.('uygunsuzluk_closed', 'Uygunsuzluklar', id, updates.baslik, 'Uygunsuzluk kapatıldı.');
      }
    }, 0);
  }, [setUygunsuzluklar, dbUpsert]);

  const deleteUygunsuzluk = useCallback((id: string) => {
    const orgId = orgIdRef.current ?? '';
    removeFileData(orgId, 'uyg_acilis', id);
    removeFileData(orgId, 'uyg_kapatma', id);
    setUygunsuzluklar(prev => { dbDelete('uygunsuzluklar', id); return prev.filter(u => u.id !== id); });
  }, [setUygunsuzluklar, dbDelete]);

  const getUygunsuzlukPhoto = useCallback((id: string, type: 'acilis' | 'kapatma') =>
    getFileData(orgIdRef.current ?? '', `uyg_${type}`, id), []);

  const setUygunsuzlukPhoto = useCallback(async (id: string, type: 'acilis' | 'kapatma', base64: string): Promise<string | null> => {
    const orgId = orgIdRef.current ?? '';
    saveFileData(orgId, `uyg_${type}`, id, base64);
    if (orgId) {
      const url = await uploadPhotoToStorage(orgId, `nonconformity/${id}-${type}`, base64);
      return url;
    }
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
    dbUpsert('ekipmanlar', id, newE);
    return newE;
  }, [setEkipmanlar, dbUpsert]);

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
    setTimeout(() => { if (updated) dbUpsert('ekipmanlar', id, updated); }, 0);
  }, [setEkipmanlar, dbUpsert]);

  const deleteEkipman = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'ekipman', id);
    setEkipmanlar(prev => { dbDelete('ekipmanlar', id); return prev.filter(e => e.id !== id); });
  }, [setEkipmanlar, dbDelete]);

  const getEkipmanFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'ekipman', id), []);

  // ──────── GÖREV ────────
  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>) => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setGorevler(prev => [...prev, newG]);
    dbUpsert('gorevler', newG.id, newG);
    logFnRef.current?.('gorev_created', 'Görevler', newG.id, newG.baslik, `${newG.baslik} görevi oluşturuldu.`);
    return newG;
  }, [setGorevler, dbUpsert]);

  const updateGorev = useCallback((id: string, updates: Partial<Gorev>) => {
    let updated: Gorev | null = null;
    setGorevler(prev => prev.map(g => {
      if (g.id !== id) return g;
      updated = { ...g, ...updates };
      return updated;
    }));
    setTimeout(() => { if (updated) dbUpsert('gorevler', id, updated); }, 0);
  }, [setGorevler, dbUpsert]);

  const deleteGorev = useCallback((id: string) => {
    setGorevler(prev => { dbDelete('gorevler', id); return prev.filter(g => g.id !== id); });
  }, [setGorevler, dbDelete]);

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
    dbUpsert('tutanaklar', id, newT);
    logFnRef.current?.('tutanak_created', 'Tutanaklar', id, newT.baslik, `${newT.tutanakNo} - ${newT.baslik} tutanağı oluşturuldu.`);
    return { ...newT, dosyaVeri };
  }, [setTutanaklar, dbUpsert]);

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
    setTimeout(() => { if (updated) dbUpsert('tutanaklar', id, updated); }, 0);
  }, [setTutanaklar, dbUpsert]);

  const deleteTutanak = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'tutanak', id);
    setTutanaklar(prev => { dbDelete('tutanaklar', id); return prev.filter(t => t.id !== id); });
  }, [setTutanaklar, dbDelete]);

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
    isSaving: savingCount > 0,
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
