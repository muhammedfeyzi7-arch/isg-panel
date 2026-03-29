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
    uygunsuzluklar: ensureArray<Uygunsuzluk>(parsed.uygunsuzluklar),
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

// ──────── Main hook ────────
export function useStore(organizationId: string | null) {
  const [data, setDataState] = useState<AppData>(defaultData);
  const [dataLoading, setDataLoading] = useState(true);

  const orgIdRef = useRef(organizationId);
  const lastSavedAt = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Log callback — injected by AppContext after org/user are known
  type LogCb = (actionType: string, opts?: { module?: string; recordId?: string; recordName?: string; description?: string }) => void;
  const logCallbackRef = useRef<LogCb | null>(null);
  const setLogCallback = useCallback((fn: LogCb | null) => {
    logCallbackRef.current = fn;
  }, []);

  // Keep ref in sync
  useEffect(() => { orgIdRef.current = organizationId; }, [organizationId]);

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
    logCallbackRef.current?.('firma_created', { module: 'Firmalar', recordId: newFirma.id, recordName: firma.ad });
    return newFirma;
  }, [setData]);

  const updateFirma = useCallback((id: string, updates: Partial<Firma>) => {
    setData(prev => ({
      ...prev,
      firmalar: prev.firmalar.map(f => f.id === id ? { ...f, ...updates, guncellemeTarihi: new Date().toISOString() } : f),
    }));
    if (updates.ad !== undefined || updates.durum !== undefined) {
      logCallbackRef.current?.('firma_updated', { module: 'Firmalar', recordId: id, recordName: updates.ad });
    }
  }, [setData]);

  const deleteFirma = useCallback((id: string) => {
    const now = new Date().toISOString();
    setData(prev => {
      const firma = prev.firmalar.find(f => f.id === id);
      logCallbackRef.current?.('firma_deleted', { module: 'Firmalar', recordId: id, recordName: firma?.ad });
      const ilgiliPersonelIds = prev.personeller.filter(p => p.firmaId === id && !p.silinmis).map(p => p.id);
      const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: id };
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
    logCallbackRef.current?.('personel_created', { module: 'Personeller', recordId: newPersonel.id, recordName: personel.adSoyad });
    return newPersonel;
  }, [setData]);

  const updatePersonel = useCallback((id: string, updates: Partial<Personel>) => {
    setData(prev => ({
      ...prev,
      personeller: prev.personeller.map(p => p.id === id ? { ...p, ...updates, guncellemeTarihi: new Date().toISOString() } : p),
    }));
    if (updates.adSoyad !== undefined || updates.durum !== undefined) {
      logCallbackRef.current?.('personel_updated', { module: 'Personeller', recordId: id, recordName: updates.adSoyad });
    }
  }, [setData]);

  const deletePersonel = useCallback((id: string) => {
    setData(prev => {
      const p = prev.personeller.find(x => x.id === id);
      logCallbackRef.current?.('personel_deleted', { module: 'Personeller', recordId: id, recordName: p?.adSoyad });
      return {
        ...prev,
        personeller: prev.personeller.map(p => p.id === id ? { ...p, silinmis: true, silinmeTarihi: new Date().toISOString() } : p),
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
    logCallbackRef.current?.('document_added', { module: 'Evraklar', recordId: id, recordName: evrak.ad });
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
      logCallbackRef.current?.('document_deleted', { module: 'Evraklar', recordId: id, recordName: e?.ad });
      return {
        ...prev,
        evraklar: prev.evraklar.map(e => e.id === id ? { ...e, silinmis: true, silinmeTarihi: new Date().toISOString() } : e),
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
    const newU: Uygunsuzluk = { ...u, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setData(prev => ({ ...prev, uygunsuzluklar: [...prev.uygunsuzluklar, newU] }));
    return newU;
  }, [setData]);

  const updateUygunsuzluk = useCallback((id: string, updates: Partial<Uygunsuzluk>) => {
    setData(prev => ({
      ...prev,
      uygunsuzluklar: prev.uygunsuzluklar.map(u => u.id === id ? { ...u, ...updates } : u),
    }));
  }, [setData]);

  const deleteUygunsuzluk = useCallback((id: string) => {
    setData(prev => ({ ...prev, uygunsuzluklar: prev.uygunsuzluklar.filter(u => u.id !== id) }));
  }, [setData]);

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
    logCallbackRef.current?.('tutanak_created', { module: 'Tutanaklar', recordId: id, recordName: t.baslik });
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
    if (updates.baslik !== undefined || updates.durum !== undefined) {
      logCallbackRef.current?.('tutanak_updated', { module: 'Tutanaklar', recordId: id, recordName: updates.baslik });
    }
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
    setLogCallback,
    addFirma, updateFirma, deleteFirma, restoreFirma, permanentDeleteFirma,
    addPersonel, updatePersonel, deletePersonel, restorePersonel, permanentDeletePersonel,
    addEvrak, updateEvrak, deleteEvrak, restoreEvrak, permanentDeleteEvrak, getEvrakFile,
    addEgitim, updateEgitim, deleteEgitim, getEgitimFile,
    addMuayene, updateMuayene, deleteMuayene,
    addUygunsuzluk, updateUygunsuzluk, deleteUygunsuzluk,
    addEkipman, updateEkipman, deleteEkipman, getEkipmanFile,
    addGorev, updateGorev, deleteGorev,
    addTutanak, updateTutanak, deleteTutanak, getTutanakFile,
    getFirmaLogo, setFirmaLogo, clearFirmaLogo,
    updateCurrentUser,
  };
}

export type StoreType = ReturnType<typeof useStore>;
