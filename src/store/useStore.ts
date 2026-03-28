import { useState, useCallback } from 'react';
import type {
  AppData, Firma, Personel, Evrak, Egitim, Muayene, Uygunsuzluk, Ekipman, Gorev, Tutanak, CurrentUser,
} from '../types';
import { getEvrakKategori } from '../utils/evrakKategori';

function getStorageKey(userId: string): string {
  return `isg_data_${userId}`;
}

function getFileKey(userId: string, type: string, id: string): string {
  return `isg_file_${userId}_${type}_${id}`;
}

const defaultUser: CurrentUser = {
  id: 'u1',
  ad: '',
  email: '',
  rol: 'Kullanıcı',
};

const defaultData: AppData = {
  firmalar: [],
  personeller: [],
  evraklar: [],
  egitimler: [],
  muayeneler: [],
  uygunsuzluklar: [],
  ekipmanlar: [],
  gorevler: [],
  tutanaklar: [],
  currentUser: defaultUser,
};

function ensureArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  return [];
}

const KAN_MIGRASYONU: Record<string, string> = {
  'A Rh+': 'A+', 'A Rh-': 'A-',
  'B Rh+': 'B+', 'B Rh-': 'B-',
  'AB Rh+': 'AB+', 'AB Rh-': 'AB-',
  '0 Rh+': '0+', '0 Rh-': '0-',
};

function migrateKanGrubu(kanGrubu: string): string {
  if (!kanGrubu) return kanGrubu;
  return KAN_MIGRASYONU[kanGrubu] ?? kanGrubu;
}

function loadData(userId: string): AppData {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return { ...defaultData };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!parsed || typeof parsed !== 'object') return { ...defaultData };
    return {
      firmalar: ensureArray<Firma>(parsed.firmalar),
      personeller: ensureArray<Personel>(parsed.personeller).map(p => ({
        ...p,
        kanGrubu: migrateKanGrubu(p.kanGrubu ?? ''),
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
  } catch {
    return { ...defaultData };
  }
}

function saveData(userId: string, data: AppData): void {
  try {
    const slim = {
      ...data,
      evraklar: data.evraklar.map(e => { const { dosyaVeri: _dv, ...rest } = e; return rest; }),
      egitimler: data.egitimler.map(e => { const { belgeDosyaVeri: _bdv, ...rest } = e; return rest; }),
      ekipmanlar: data.ekipmanlar.map(e => { const { dosyaVeri: _dv, ...rest } = e; return rest; }),
      tutanaklar: data.tutanaklar.map(t => { const { dosyaVeri: _dv, ...rest } = t; return rest; }),
    };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(slim));
  } catch {
    try {
      const minimal = {
        ...data,
        evraklar: data.evraklar.map(e => { const { dosyaVeri: _dv, notlar: _n, ...rest } = e; return rest; }),
        egitimler: data.egitimler.map(e => { const { belgeDosyaVeri: _bdv, ...rest } = e; return rest; }),
        ekipmanlar: data.ekipmanlar.map(e => { const { dosyaVeri: _dv, ...rest } = e; return rest; }),
        tutanaklar: data.tutanaklar.map(t => { const { dosyaVeri: _dv, ...rest } = t; return rest; }),
      };
      localStorage.setItem(getStorageKey(userId), JSON.stringify(minimal));
    } catch { /* Storage full */ }
  }
}

function saveFileData(userId: string, type: string, id: string, veri: string): void {
  try { localStorage.setItem(getFileKey(userId, type, id), veri); } catch { /* Storage full */ }
}

function getFileData(userId: string, type: string, id: string): string | undefined {
  return localStorage.getItem(getFileKey(userId, type, id)) ?? undefined;
}

function removeFileData(userId: string, type: string, id: string): void {
  try { localStorage.removeItem(getFileKey(userId, type, id)); } catch { /* ignore */ }
}

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

export function useStore(userId: string) {
  const [data, setDataState] = useState<AppData>(() => loadData(userId));

  const setData = useCallback((updater: (prev: AppData) => AppData) => {
    setDataState(prev => {
      const next = updater(prev);
      saveData(userId, next);
      return next;
    });
  }, [userId]);

  const addFirma = useCallback((firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newFirma: Firma = { ...firma, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setData(prev => ({ ...prev, firmalar: [...prev.firmalar, newFirma] }));
    return newFirma;
  }, [setData]);

  const updateFirma = useCallback((id: string, updates: Partial<Firma>) => {
    setData(prev => ({
      ...prev,
      firmalar: prev.firmalar.map(f =>
        f.id === id ? { ...f, ...updates, guncellemeTarihi: new Date().toISOString() } : f,
      ),
    }));
  }, [setData]);

  const deleteFirma = useCallback((id: string) => {
    const now = new Date().toISOString();
    setData(prev => {
      const ilgiliPersonelIds = prev.personeller
        .filter(p => p.firmaId === id && !p.silinmis)
        .map(p => p.id);
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
      const restoreFields = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
      return {
        ...prev,
        firmalar: prev.firmalar.map(f => f.id === id ? { ...f, silinmis: false, silinmeTarihi: undefined } : f),
        personeller: prev.personeller.map(p => p.cascadeFirmaId === id && p.cascadeSilindi ? { ...p, ...restoreFields } : p),
        evraklar: prev.evraklar.map(e => e.cascadeFirmaId === id && e.cascadeSilindi ? { ...e, ...restoreFields } : e),
        egitimler: prev.egitimler.map(e => e.cascadeFirmaId === id && e.cascadeSilindi ? { ...e, ...restoreFields } : e),
        muayeneler: prev.muayeneler.map(m => m.cascadeFirmaId === id && m.cascadeSilindi ? { ...m, ...restoreFields } : m),
        uygunsuzluklar: prev.uygunsuzluklar.map(u => u.cascadeFirmaId === id && u.cascadeSilindi ? { ...u, ...restoreFields } : u),
        ekipmanlar: prev.ekipmanlar.map(e => e.cascadeFirmaId === id && e.cascadeSilindi ? { ...e, ...restoreFields } : e),
        gorevler: prev.gorevler.map(g => g.cascadeFirmaId === id && g.cascadeSilindi ? { ...g, ...restoreFields } : g),
      };
    });
  }, [setData]);

  const permanentDeleteFirma = useCallback((id: string) => {
    removeFileData(userId, 'firmalogo', id);
    setData(prev => {
      const ilgiliPersonelIds = prev.personeller.filter(p => p.firmaId === id).map(p => p.id);
      prev.ekipmanlar.filter(e => e.firmaId === id).forEach(e => removeFileData(userId, 'ekipman', e.id));
      prev.evraklar
        .filter(e => e.firmaId === id || (e.personelId ? ilgiliPersonelIds.includes(e.personelId) : false))
        .forEach(e => removeFileData(userId, 'evrak', e.id));
      prev.egitimler.filter(e => e.firmaId === id).forEach(e => removeFileData(userId, 'egitim', e.id));
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
  }, [setData, userId]);

  const addPersonel = useCallback((personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newPersonel: Personel = { ...personel, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setData(prev => ({ ...prev, personeller: [...prev.personeller, newPersonel] }));
    return newPersonel;
  }, [setData]);

  const updatePersonel = useCallback((id: string, updates: Partial<Personel>) => {
    setData(prev => ({
      ...prev,
      personeller: prev.personeller.map(p => p.id === id ? { ...p, ...updates, guncellemeTarihi: new Date().toISOString() } : p),
    }));
  }, [setData]);

  const deletePersonel = useCallback((id: string) => {
    const now = new Date().toISOString();
    setData(prev => ({
      ...prev,
      personeller: prev.personeller.map(p => p.id === id ? { ...p, silinmis: true, silinmeTarihi: now } : p),
    }));
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

  const addEvrak = useCallback((evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri, ...rest } = evrak;
    const kategori = evrak.kategori || getEvrakKategori(evrak.tur, evrak.ad);
    const newEvrak: Evrak = { ...rest, kategori, id, olusturmaTarihi: now };
    if (dosyaVeri) saveFileData(userId, 'evrak', id, dosyaVeri);
    setData(prev => ({ ...prev, evraklar: [...prev.evraklar, newEvrak] }));
    return { ...newEvrak, dosyaVeri };
  }, [setData, userId]);

  const updateEvrak = useCallback((id: string, updates: Partial<Evrak>) => {
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(userId, 'evrak', id, dosyaVeri);
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
  }, [setData, userId]);

  const deleteEvrak = useCallback((id: string) => {
    const now = new Date().toISOString();
    setData(prev => ({
      ...prev,
      evraklar: prev.evraklar.map(e => e.id === id ? { ...e, silinmis: true, silinmeTarihi: now } : e),
    }));
  }, [setData]);

  const restoreEvrak = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      evraklar: prev.evraklar.map(e => e.id === id ? { ...e, silinmis: false, silinmeTarihi: undefined } : e),
    }));
  }, [setData]);

  const permanentDeleteEvrak = useCallback((id: string) => {
    removeFileData(userId, 'evrak', id);
    setData(prev => ({ ...prev, evraklar: prev.evraklar.filter(e => e.id !== id) }));
  }, [setData, userId]);

  const getEvrakFile = useCallback((id: string) => getFileData(userId, 'evrak', id), [userId]);

  const addEgitim = useCallback((egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const { belgeDosyaVeri, ...rest } = egitim;
    const newEgitim: Egitim = { ...rest, id, olusturmaTarihi: now };
    if (belgeDosyaVeri) saveFileData(userId, 'egitim', id, belgeDosyaVeri);
    setData(prev => ({ ...prev, egitimler: [...prev.egitimler, newEgitim] }));
    return newEgitim;
  }, [setData, userId]);

  const updateEgitim = useCallback((id: string, updates: Partial<Egitim>) => {
    const { belgeDosyaVeri, ...rest } = updates;
    if (belgeDosyaVeri) saveFileData(userId, 'egitim', id, belgeDosyaVeri);
    setData(prev => ({
      ...prev,
      egitimler: prev.egitimler.map(e => e.id === id ? { ...e, ...rest } : e),
    }));
  }, [setData, userId]);

  const deleteEgitim = useCallback((id: string) => {
    removeFileData(userId, 'egitim', id);
    setData(prev => ({ ...prev, egitimler: prev.egitimler.filter(e => e.id !== id) }));
  }, [setData, userId]);

  const getEgitimFile = useCallback((id: string) => getFileData(userId, 'egitim', id), [userId]);

  const addMuayene = useCallback((muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => {
    const now = new Date().toISOString();
    const newMuayene: Muayene = { ...muayene, id: genId(), olusturmaTarihi: now };
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

  const addUygunsuzluk = useCallback((u: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>) => {
    const now = new Date().toISOString();
    const newU: Uygunsuzluk = { ...u, id: genId(), olusturmaTarihi: now };
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

  const addEkipman = useCallback((e: Omit<Ekipman, 'id' | 'olusturmaTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri, ...rest } = e;
    const newE: Ekipman = { ...rest, id, olusturmaTarihi: now };
    if (dosyaVeri) saveFileData(userId, 'ekipman', id, dosyaVeri);
    setData(prev => ({ ...prev, ekipmanlar: [...prev.ekipmanlar, newE] }));
    return newE;
  }, [setData, userId]);

  const updateEkipman = useCallback((id: string, updates: Partial<Ekipman>) => {
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(userId, 'ekipman', id, dosyaVeri);
    setData(prev => ({
      ...prev,
      ekipmanlar: prev.ekipmanlar.map(e => e.id === id ? { ...e, ...rest } : e),
    }));
  }, [setData, userId]);

  const deleteEkipman = useCallback((id: string) => {
    removeFileData(userId, 'ekipman', id);
    setData(prev => ({ ...prev, ekipmanlar: prev.ekipmanlar.filter(e => e.id !== id) }));
  }, [setData, userId]);

  const getEkipmanFile = useCallback((id: string) => getFileData(userId, 'ekipman', id), [userId]);

  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>) => {
    const now = new Date().toISOString();
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: now };
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

  const addTutanak = useCallback((t: Omit<Tutanak, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri, ...rest } = t;
    const newT: Tutanak = { ...rest, id, olusturmaTarihi: now, guncellemeTarihi: now };
    if (dosyaVeri) saveFileData(userId, 'tutanak', id, dosyaVeri);
    setData(prev => ({ ...prev, tutanaklar: [...prev.tutanaklar, newT] }));
    return { ...newT, dosyaVeri };
  }, [setData, userId]);

  const updateTutanak = useCallback((id: string, updates: Partial<Tutanak>) => {
    const { dosyaVeri, ...rest } = updates;
    if (dosyaVeri) saveFileData(userId, 'tutanak', id, dosyaVeri);
    setData(prev => ({
      ...prev,
      tutanaklar: prev.tutanaklar.map(t => t.id === id ? { ...t, ...rest, guncellemeTarihi: new Date().toISOString() } : t),
    }));
  }, [setData, userId]);

  const deleteTutanak = useCallback((id: string) => {
    removeFileData(userId, 'tutanak', id);
    setData(prev => ({ ...prev, tutanaklar: prev.tutanaklar.filter(t => t.id !== id) }));
  }, [setData, userId]);

  const getTutanakFile = useCallback((id: string) => getFileData(userId, 'tutanak', id), [userId]);

  const getFirmaLogo = useCallback((id: string) => getFileData(userId, 'firmalogo', id), [userId]);
  const setFirmaLogo = useCallback((id: string, logo: string) => saveFileData(userId, 'firmalogo', id, logo), [userId]);
  const clearFirmaLogo = useCallback((id: string) => removeFileData(userId, 'firmalogo', id), [userId]);

  const updateCurrentUser = useCallback((updates: Partial<CurrentUser>) => {
    setData(prev => ({ ...prev, currentUser: { ...prev.currentUser, ...updates } }));
  }, [setData]);

  return {
    ...data,
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
