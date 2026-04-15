import type { StateCreator } from 'zustand';
import type { Personel } from '@/types';
import { genId } from '@/store/storeHelpers';

const KAN_MAP: Record<string, string> = {
  'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-',
  'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-',
};

export function normalizePersonel(p: Personel): Personel {
  return { ...p, kanGrubu: KAN_MAP[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? '') };
}

export interface PersonelSlice {
  personeller: Personel[];
  _setPersoneller: (u: Personel[] | ((p: Personel[]) => Personel[])) => void;
  addPersonel: (personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => Personel;
  updatePersonel: (id: string, updates: Partial<Personel>) => void;
  deletePersonel: (id: string) => Personel | null;
  restorePersonel: (id: string) => Personel | null;
}

export const createPersonelSlice: StateCreator<PersonelSlice> = (set, get) => ({
  personeller: [],

  _setPersoneller: (u) =>
    set((state) => ({
      personeller: typeof u === 'function' ? u(state.personeller) : u,
    })),

  addPersonel: (personel) => {
    const now = new Date().toISOString();
    const newPersonel: Personel = normalizePersonel({
      ...personel,
      id: genId(),
      olusturmaTarihi: now,
      guncellemeTarihi: now,
    } as Personel);
    set((state) => ({ personeller: [newPersonel, ...state.personeller] }));
    return newPersonel;
  },

  updatePersonel: (id, updates) => {
    set((state) => ({
      personeller: state.personeller.map((p) =>
        p.id !== id ? p : normalizePersonel({ ...p, ...updates, guncellemeTarihi: new Date().toISOString() }),
      ),
    }));
  },

  deletePersonel: (id) => {
    let result: Personel | null = null;
    set((state) => {
      const personeller = state.personeller.map((p) => {
        if (p.id !== id) return p;
        result = { ...p, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
        return result;
      });
      return { personeller };
    });
    // re-read after set
    if (!result) result = get().personeller.find((p) => p.id === id) ?? null;
    return result;
  },

  restorePersonel: (id) => {
    let result: Personel | null = null;
    set((state) => {
      const personeller = state.personeller.map((p) => {
        if (p.id !== id) return p;
        result = { ...p, silinmis: false as const, silinmeTarihi: undefined };
        return result;
      });
      return { personeller };
    });
    return result;
  },
});
