import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type {
  AppData, Firma, Personel, Evrak, Egitim, Muayene, Uygunsuzluk, Ekipman, Gorev, Tutanak, CurrentUser,
} from '../types';
import { getEvrakKategori } from '../utils/evrakKategori';

// ──────── Storage helpers ────────
function getCacheKey(orgId: string): string { return `isg_org_cache_${orgId}`; }
function getFileKey(orgId: string, type: string, id: string): string { return `isg_org_file_${orgId}_${type}_${id}`; }

function saveFileData(orgId: string, type: string, id: string, veri: string): void {
  try { localStorage.setItem(getFileKey(orgId, type, id), veri); } catch { /* Storage full */ }
}
function getFileData(orgId: string, type: string, id: string): string | undefined {
  return localStorage.getItem(getFileKey(orgId, type, id)) ?? undefined;
}
function removeFileData(orgId: string, type: string, id: string): void {
  try { localStorage.removeItem(getFileKey(orgId, type, id)); } catch { /* ignore */ }
}

// ──────── ID generator ────────
function genId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ──────── Tutanak no generator ────────
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

// ──────── DÖF no generator ────────
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

// ──────── Default data ────────
const defaultUser: CurrentUser = { id: 'u1', ad: '', email: '', rol: 'Kullanıcı' };

const defaultData: AppData = {
  firmalar: [], personeller: [], evraklar: [], egitimler: [],
  muayeneler: [], uygunsuzluklar: [], ekipmanlar: [], gorevler: [],
  tutanaklar: [], currentUser: defaultUser,
};

// ──────── Array safety ────────
function ensureArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

// ──────── Blood type migration ────────
const KAN: Record<string, string> = {
  'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-',
  'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-',
};

// ──────── Parse raw data from storage/Supabase ────────
function parseAppData(parsed: Partial<AppData>): AppData {
  return {
    firmalar: ensureArray<Firma>(parsed.firmalar),
    personeller: ensureArray<Personel>(parsed.personeller).map(p => ({
      ...p,
      kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? ''),
    })),
    evraklar: ensureArray<Evrak>(parsed.evraklar).map(e => ({
      ...e,
      kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? ''),
    })),
    egitimler: ensureArray<Egitim>(parsed.egitimler),
    muayeneler: ensureArray<Muayene>(parsed.muayeneler),
    uygunsuzluklar: ensureArray<Uygunsuzluk>(parsed.uygunsuzluklar).map(u => {
      // Migrate old status values
      let durum = u.durum as string;
      if (durum === 'Kapatıldı' || durum === 'İncelemede') {
        durum = durum === 'Kapatıldı' ? 'Kapandı' : 'Açık';
      }
      return {
        ...u,
        durum: durum as import('../types').UygunsuzlukStatus,
        // Migrate old records that had Kapatıldı → treat as having closing photo
        kapatmaFotoMevcut: durum === 'Kapandı' ? (u.kapatmaFotoMevcut ?? true) : (u.kapatmaFotoMevcut ?? false),
      };
    }),
    ekipmanlar: ensureArray<Ekipman>(parsed.ekipmanlar),
    gorevler: ensureArray<Gorev>(parsed.gorevler),
    tutanaklar: ensureArray<Tutanak>(parsed.tutanaklar),
    currentUser: {
      ...defaultUser,
      ...(parsed.currentUser && typeof parsed.currentUser === 'object' ? parsed.currentUser : {}),
    },
  };
}

// ──────── Strip file/binary data before saving to Supabase ────────
function stripFileData(data: AppData): AppData {
  return {
    ...data,
    evraklar: data.evraklar.map(e => { const { dosyaVeri: _d, ...r } = e; return r; }),
    egitimler: data.egitimler.map(e => { const { belgeDosyaVeri: _d, ...r } = e; return r; }),
    ekipmanlar: data.ekipmanlar.map(e => { const { dosyaVeri: _d, ...r } = e; return r; }),
    tutanaklar: data.tutanaklar.map(t => { const { dosyaVeri: _d, ...r } = t; return r; }),
  };
}

// ──────── LogFn type ────────
export type LogFn = (
  actionType: string,
  module: string,
  recordId: string,
  recordName?: string,
  description?: string,
) => void;

// ──────── Main hook ────────
export function useStore(organizationId: string | null, logFn?: LogFn) {
  const [data, setDataState] = useState<AppData>(defaultData);
  const [dataLoading, setDataLoading] = useState(true);

  const orgIdRef = useRef(organizationId);
  const lastSavedAt = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logFnRef = useRef(logFn);
  const dataRef = useRef(data);

  // Keep refs in sync
  useEffect(() => { orgIdRef.current = organizationId; }, [organizationId]);
  useEffect(() => { logFnRef.current = logFn; }, [logFn]);
  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Load from Supabase when org changes ──
  useEffect(() => {
    if (!organizationId) {
      setDataState(defaultData);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    // Fast path: load from localStorage cache immediately
    const cached = localStorage.getItem(getCacheKey(organizationId));
    if (cached) {
      try { setDataState(parseAppData(JSON.parse(cached))); } catch { /* ignore */ }
    }

    // Authoritative load from Supabase
    supabase
      .from('app_data')
      .select('data')
      .eq('organization_id', organizationId)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.data) {
          const loaded = parseAppData(row.data as Partial<AppData>);
          setDataState(loaded);
          try { localStorage.setItem(getCacheKey(organizationId), JSON.stringify(loaded)); } catch { /* full */ }
        }
        setDataLoading(false);
      });
  }, [organizationId]);

  // ── Realtime: sync changes from other users in the same org ──
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`app_data_org_${organizationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_data', filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          // Skip our own saves (within last 3 seconds)
          if (Date.now() - lastSavedAt.current < 3000) return;
          if (payload.new?.data) {
            const loaded = parseAppData(payload.new.data as Partial<AppData>);
            setDataState(loaded);
            try { localStorage.setItem(getCacheKey(organizationId), JSON.stringify(loaded)); } catch { /* full */ }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organizationId]);

  // ── Debounced save to Supabase ──
  const setData = useCallback((updater: (prev: AppData) => AppData) => {
    setDataState(prev => {
      const next = updater(prev);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const orgId = orgIdRef.current;
        if (!orgId) return;
        const slim = stripFileData(next);
        lastSavedAt.current = Date.now();
        await supabase
          .from('app_data')
          .upsert({ organization_id: orgId, data: slim as object, updated_at: new Date().toISOString() });
        try { localStorage.setItem(getCacheKey(orgId), JSON.stringify(slim)); } catch { /* full */ }
      }, 800);
      return next;
    });
  }, []);

  // ──────── FIRMA ────────
  const addFirma = useCallback((firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newFirma: Firma = { ...firma, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setData(prev => ({ ...prev, firmalar: [...prev.firmalar, newFirma] }));
    logFnRef.current?.('firma_created', 'Firmalar', newFirma.id, newFirma.ad, `${newFirma.ad} firması oluşturuldu.`);
    return newFirma;
  }, [setData]);

  const updateFirma = useCallback((id: string, updates: Partial<Firma>) => {
    setData(prev => ({
      ...prev,
      firmalar: prev.firmalar.map(f => f.id === id ? { ...f, ...updates, guncellemeTarihi: new Date().toISOString() } : f),
    }));
    logFnRef.current?.('firma_updated', 'Firmalar', id, updates.ad, `Firma bilgileri güncellendi.`);
  }, [setData]);

  const deleteFirma = useCallback((id: string) => {
    const now = new Date().toISOString();
    setData(prev => {
      const firma = prev.firmalar.find(f => f.id === id);
      const ilgiliPersonelIds = prev.personeller.filter(p => p.firmaId === id && !p.silinmis).map(p => p.id);
      const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: id };
      logFnRef.current?.('firma_deleted', 'Firmalar', id, firma?.ad, `${firma?.ad ?? id} firması silindi.`);
      return {
        ...prev,
        firmalar: prev.firmalar.map(f => f.id === id ? { ...f, silinmis: true, silinmeTarihi: now } : f),
        personeller: prev.personeller.map(p => ilgiliPersonelIds.includes(p.id) ? { ...p, ...cascadeFields } : p),
        evraklar: prev.evraklar.map(e => {
          if (e.silinmis) return e;
          const personelEvrak = e.personelId ? ilgiliPersonelIds.includes(e.personelId) : false;
          const dirFirmaEvrak = e.firmaId === id && !e.personelId;
          return (personelEvrak || dirFirmaEvrak) ? { ...e, ...cascadeFields } : e;
        }),
        egitimler: prev.egitimler.map(e => e.firmaId === id && !e.silinmis ? { ...e, ...cascadeFields } : e),
        muayeneler: prev.muayeneler.map(m => m.firmaId === id && !m.silinmis ? { ...m, ...cascadeFields } : m),
        uygunsuzluklar: prev.uygunsuzluklar.map(u => u.firmaId === id && !u.silinmis ? { ...u, ...cascadeFields } : u),
        ekipmanlar: prev.ekipmanlar.map(e => e.firmaId === id && !e.silinmis ? { ...e, ...cascadeFields } : e),
        gorevler: prev.gorevler.map(g => {
          if (g.silinmis) return g;
          const firmaGorevi = g.firmaId === id;
          const personelGorevi = g.personelId ? ilgiliPersonelIds.includes(g.personelId) : false;
          return (firmaGorevi || personelGorevi) ? { ...g, ...cascadeFields } : g;
        }),
      };
    });
  }, [setData]);

  const restoreFirma = useCallback((id: string) => {
    setData(prev => {
      const rf = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
      return {
        ...prev,
        firmalar: prev.firmalar.map(f => f.id === id ? { ...f, silinmis: false, silinmeTarihi: undefined } : f),
        personeller: prev.personeller.map(p => p.cascadeFirmaId === id && p.cascadeSilindi ? { ...p, ...rf } : p),
        evraklar: prev.evraklar.map(e => e.cascadeFirmaId === id && e.cascadeSilindi ? { ...e, ...rf } : e),
        egitimler: prev.egitimler.map(e => e.cascadeFirmaId === id && e.cascadeSilindi ? { ...e, ...rf } : e),
        muayeneler: prev.muayeneler.map(m => m.cascadeFirmaId === id && m.cascadeSilindi ? { ...m, ...rf } : m),
        uygunsuzluklar: prev.uygunsuzluklar.map(u => u.cascadeFirmaId === id && u.cascadeSilindi ? { ...u, ...rf } : u),
        ekipmanlar: prev.ekipmanlar.map(e => e.cascadeFirmaId === id && e.cascadeSilindi ? { ...e, ...rf } : e),
        gorevler: prev.gorevler.map(g => g.cascadeFirmaId === id && g.cascadeSilindi ? { ...g, ...rf } : g),
      };
    });
  }, [setData]);

  const permanentDeleteFirma = useCallback((id: string) => {
    const orgId = orgIdRef.current ?? '';
    removeFileData(orgId, 'firmalogo', id);
    setData(prev => {
      const ilgiliPersonelIds = prev.personeller.filter(p => p.firmaId === id).map(p => p.id);
      prev.ekipmanlar.filter(e => e.firmaId === id).forEach(e => removeFileData(orgId, 'ekipman', e.id));
      prev.evraklar
        .filter(e => e.firmaId === id || (e.personelId ? ilgiliPersonelIds.includes(e.personelId) : false))
        .forEach(e => removeFileData(orgId, 'evrak', e.id));
      prev.egitimler.filter(e => e.firmaId === id).forEach(e => removeFileData(orgId, 'egitim', e.id));
      return {
        ...prev,
        firmalar: prev.firmalar.filter(f => f.id !== id),
        personeller: prev.personeller.filter(p => !ilgiliPersonelIds.includes(p.id)),
        evraklar: prev.evraklar.filter(e => e.firmaId !== id && !(e.personelId ? ilgiliPersonelIds.includes(e.personelId) : false)),
        egitimler: prev.egitimler.filter(e => e.firmaId !== id),
        muayeneler: prev.muayeneler.filter(m => m.firmaId !== id),
        uygunsuzluklar: prev.uygunsuzluklar.filter(u => u.firmaId !== id),
        ekipmanlar: prev.ekipmanlar.filter(e => e.firmaId !== id),
        gorevler: prev.gorevler.filter(g => g.firmaId !== id && !(g.personelId ? ilgiliPersonelIds.includes(g.personelId) : false)),
      };
    });
  }, [setData]);

  // ──────── PERSONEL ────────
  const addPersonel = useCallback((personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newPersonel: Personel = { ...personel, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setData(prev => ({ ...prev, personeller: [...prev.personeller, newPersonel] }));
    logFnRef.current?.('personel_created', 'Personeller', newPersonel.id, newPersonel.adSoyad, `${newPersonel.adSoyad} personel olarak eklendi.`);
    return newPersonel;
  }, [setData]);

  const updatePersonel = useCallback((id: string, updates: Partial<Personel>) => {
    setData(prev => ({
      ...prev,
      personeller: prev.personeller.map(p => p.id === id ? { ...p, ...updates, guncellemeTarihi: new Date().toISOString() } : p),
    }));
    if (updates.adSoyad) {
      logFnRef.current?.('personel_updated', 'Personeller', id, updates.adSoyad, `Personel bilgileri güncellendi.`);
    }
  }, [setData]);

  const deletePersonel = useCallback((id: string) => {
    setData(prev => {
      const p = prev.personeller.find(x => x.id === id);
      logFnRef.current?.('personel_deleted', 'Personeller', id, p?.adSoyad, `${p?.adSoyad ?? id} personel silindi.`);
      return {
        ...prev,
        personeller: prev.personeller.map(x => x.id === id ? { ...x, silinmis: true, silinmeTarihi: new Date().toISOString() } : x),
      };
    });
  }, [setData]);

  const restorePersonel = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      personeller: prev.personeller.map(p => p.id === id ? { ...p, silinmis: false, silinmeTarihi: undefined } : p),
    }));
  }, [setData]);

  const permanentDeletePersonel = useCallback((id: string) => {
    setData(prev => ({ ...prev, personeller: prev.personeller.filter(p => p.id !== id) }));
  }, [setData]);

  // ──────── EVRAK ────────
  const addEvrak = useCallback((evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri, ...rest } = evrak;
    const kategori = evrak.kategori || getEvrakKategori(evrak.tur, evrak.ad);
    const newEvrak: Evrak = { ...rest, kategori, id, olusturmaTarihi: now };
    if (dosyaVeri) saveFileData(orgId, 'evrak', id, dosyaVeri);
    setData(prev => ({ ...prev, evraklar: [...prev.evraklar, newEvrak] }));
    logFnRef.current?.('evrak_created', 'Evraklar', id, newEvrak.ad, `${newEvrak.ad} evrakı eklendi.`);
    return { ...newEvrak, dosyaVeri };
  }, [setData]);

  const updateEvrak = useCallback((id: string, updates: Partial<Evrak>) => {
    const orgId = orgIdRef.current ?? '';
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(orgId, 'evrak', id, dosyaVeri);
    setData(prev => ({
      ...prev,
      evraklar: prev.evraklar.map(e => {
        if (e.id !== id) return e;
        const merged = { ...e, ...rest };
        if (rest.tur !== undefined || rest.ad !== undefined) {
          merged.kategori = getEvrakKategori(merged.tur, merged.ad);
        }
        return merged;
      }),
    }));
  }, [setData]);

  const deleteEvrak = useCallback((id: string) => {
    setData(prev => {
      const e = prev.evraklar.find(x => x.id === id);
      logFnRef.current?.('evrak_deleted', 'Evraklar', id, e?.ad, `${e?.ad ?? id} evrakı silindi.`);
      return {
        ...prev,
        evraklar: prev.evraklar.map(x => x.id === id ? { ...x, silinmis: true, silinmeTarihi: new Date().toISOString() } : x),
      };
    });
  }, [setData]);

  const restoreEvrak = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      evraklar: prev.evraklar.map(e => e.id === id ? { ...e, silinmis: false, silinmeTarihi: undefined } : e),
    }));
  }, [setData]);

  const permanentDeleteEvrak = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'evrak', id);
    setData(prev => ({ ...prev, evraklar: prev.evraklar.filter(e => e.id !== id) }));
  }, [setData]);

  const getEvrakFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'evrak', id), []);

  // ──────── EĞİTİM ────────
  const addEgitim = useCallback((egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const id = genId();
    const { belgeDosyaVeri, ...rest } = egitim;
    const newEgitim: Egitim = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    if (belgeDosyaVeri) saveFileData(orgId, 'egitim', id, belgeDosyaVeri);
    setData(prev => ({ ...prev, egitimler: [...prev.egitimler, newEgitim] }));
    logFnRef.current?.('egitim_created', 'Eğitimler', id, newEgitim.ad, `${newEgitim.ad} eğitimi oluşturuldu.`);
    return newEgitim;
  }, [setData]);

  const updateEgitim = useCallback((id: string, updates: Partial<Egitim>) => {
    const orgId = orgIdRef.current ?? '';
    const { belgeDosyaVeri, ...rest } = updates;
    if (belgeDosyaVeri) saveFileData(orgId, 'egitim', id, belgeDosyaVeri);
    setData(prev => ({
      ...prev,
      egitimler: prev.egitimler.map(e => e.id === id ? { ...e, ...rest } : e),
    }));
  }, [setData]);

  const deleteEgitim = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'egitim', id);
    setData(prev => ({ ...prev, egitimler: prev.egitimler.filter(e => e.id !== id) }));
  }, [setData]);

  const getEgitimFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'egitim', id), []);

  // ──────── MUAYENE ────────
  const addMuayene = useCallback((muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => {
    const newMuayene: Muayene = { ...muayene, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setData(prev => ({ ...prev, muayeneler: [...prev.muayeneler, newMuayene] }));
    return newMuayene;
  }, [setData]);

  const updateMuayene = useCallback((id: string, updates: Partial<Muayene>) => {
    setData(prev => ({
      ...prev,
      muayeneler: prev.muayeneler.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  }, [setData]);

  const deleteMuayene = useCallback((id: string) => {
    setData(prev => ({ ...prev, muayeneler: prev.muayeneler.filter(m => m.id !== id) }));
  }, [setData]);

  // ──────── UYGUNSUZLUK ────────
  const addUygunsuzluk = useCallback((u: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const now = new Date().toISOString();
    const acilisNo = generateDofNo(dataRef.current.uygunsuzluklar);
    const durum = u.kapatmaFotoMevcut ? 'Kapandı' as const : 'Açık' as const;
    const newU: Uygunsuzluk = { ...u, id, acilisNo, durum, olusturmaTarihi: now };
    setData(prev => ({ ...prev, uygunsuzluklar: [...prev.uygunsuzluklar, newU] }));
    logFnRef.current?.('uygunsuzluk_created', 'Uygunsuzluklar', id, newU.baslik, `${acilisNo} - ${newU.baslik} uygunsuzluk kaydı oluşturuldu.`);
    return newU;
  }, [setData]);

  const updateUygunsuzluk = useCallback((id: string, updates: Partial<Uygunsuzluk>) => {
    setData(prev => ({
      ...prev,
      uygunsuzluklar: prev.uygunsuzluklar.map(u => {
        if (u.id !== id) return u;
        const merged = { ...u, ...updates };
        // Auto-calculate durum from photo flags
        merged.durum = merged.kapatmaFotoMevcut ? 'Kapandı' : 'Açık';
        return merged;
      }),
    }));
    if (updates.kapatmaFotoMevcut) {
      logFnRef.current?.('uygunsuzluk_closed', 'Uygunsuzluklar', id, updates.baslik, 'Uygunsuzluk kapatıldı.');
    }
  }, [setData]);

  const deleteUygunsuzluk = useCallback((id: string) => {
    const orgId = orgIdRef.current ?? '';
    removeFileData(orgId, 'uyg_acilis', id);
    removeFileData(orgId, 'uyg_kapatma', id);
    setData(prev => ({ ...prev, uygunsuzluklar: prev.uygunsuzluklar.filter(u => u.id !== id) }));
  }, [setData]);

  const getUygunsuzlukPhoto = useCallback((id: string, type: 'acilis' | 'kapatma') =>
    getFileData(orgIdRef.current ?? '', `uyg_${type}`, id), []);

  const setUygunsuzlukPhoto = useCallback((id: string, type: 'acilis' | 'kapatma', veri: string) =>
    saveFileData(orgIdRef.current ?? '', `uyg_${type}`, id, veri), []);

  // ──────── EKİPMAN ────────
  const addEkipman = useCallback((e: Omit<Ekipman, 'id' | 'olusturmaTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const id = genId();
    const { dosyaVeri, ...rest } = e;
    const newE: Ekipman = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    if (dosyaVeri) saveFileData(orgId, 'ekipman', id, dosyaVeri);
    setData(prev => ({ ...prev, ekipmanlar: [...prev.ekipmanlar, newE] }));
    return newE;
  }, [setData]);

  const updateEkipman = useCallback((id: string, updates: Partial<Ekipman>) => {
    const orgId = orgIdRef.current ?? '';
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(orgId, 'ekipman', id, dosyaVeri);
    setData(prev => ({
      ...prev,
      ekipmanlar: prev.ekipmanlar.map(e => e.id === id ? { ...e, ...rest } : e),
    }));
  }, [setData]);

  const deleteEkipman = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'ekipman', id);
    setData(prev => ({ ...prev, ekipmanlar: prev.ekipmanlar.filter(e => e.id !== id) }));
  }, [setData]);

  const getEkipmanFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'ekipman', id), []);

  // ──────── GÖREV ────────
  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>) => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setData(prev => ({ ...prev, gorevler: [...prev.gorevler, newG] }));
    logFnRef.current?.('gorev_created', 'Görevler', newG.id, newG.baslik, `${newG.baslik} görevi oluşturuldu.`);
    return newG;
  }, [setData]);

  const updateGorev = useCallback((id: string, updates: Partial<Gorev>) => {
    setData(prev => ({
      ...prev,
      gorevler: prev.gorevler.map(g => g.id === id ? { ...g, ...updates } : g),
    }));
  }, [setData]);

  const deleteGorev = useCallback((id: string) => {
    setData(prev => ({ ...prev, gorevler: prev.gorevler.filter(g => g.id !== id) }));
  }, [setData]);

  // ──────── TUTANAK ────────
  const addTutanak = useCallback((t: Omit<Tutanak, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const orgId = orgIdRef.current ?? '';
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri, ...rest } = t;
    const newT: Tutanak = { ...rest, id, olusturmaTarihi: now, guncellemeTarihi: now };
    if (dosyaVeri) saveFileData(orgId, 'tutanak', id, dosyaVeri);
    setData(prev => ({ ...prev, tutanaklar: [...prev.tutanaklar, newT] }));
    logFnRef.current?.('tutanak_created', 'Tutanaklar', id, newT.baslik, `${newT.tutanakNo} - ${newT.baslik} tutanağı oluşturuldu.`);
    return { ...newT, dosyaVeri };
  }, [setData]);

  const updateTutanak = useCallback((id: string, updates: Partial<Tutanak>) => {
    const orgId = orgIdRef.current ?? '';
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(orgId, 'tutanak', id, dosyaVeri);
    setData(prev => ({
      ...prev,
      tutanaklar: prev.tutanaklar.map(t => t.id === id ? { ...t, ...rest, guncellemeTarihi: new Date().toISOString() } : t),
    }));
  }, [setData]);

  const deleteTutanak = useCallback((id: string) => {
    removeFileData(orgIdRef.current ?? '', 'tutanak', id);
    setData(prev => ({ ...prev, tutanaklar: prev.tutanaklar.filter(t => t.id !== id) }));
  }, [setData]);

  const getTutanakFile = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'tutanak', id), []);

  // ──────── LOGO ────────
  const getFirmaLogo = useCallback((id: string) => getFileData(orgIdRef.current ?? '', 'firmalogo', id), []);
  const setFirmaLogo = useCallback((id: string, logo: string) => saveFileData(orgIdRef.current ?? '', 'firmalogo', id, logo), []);
  const clearFirmaLogo = useCallback((id: string) => removeFileData(orgIdRef.current ?? '', 'firmalogo', id), []);

  // ──────── CURRENT USER ────────
  const updateCurrentUser = useCallback((updates: Partial<CurrentUser>) => {
    setData(prev => ({ ...prev, currentUser: { ...prev.currentUser, ...updates } }));
  }, [setData]);

  return {
    ...data,
    dataLoading,
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
