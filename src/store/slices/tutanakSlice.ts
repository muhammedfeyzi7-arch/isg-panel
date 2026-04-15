import type { StateCreator } from 'zustand';
import type { Tutanak } from '@/types';
import { genId } from '@/store/storeHelpers';

export interface TutanakSlice {
  tutanaklar: Tutanak[];
  _setTutanaklar: (u: Tutanak[] | ((p: Tutanak[]) => Tutanak[])) => void;
  addTutanakToState: (item: Tutanak) => void;
  updateTutanak: (id: string, updates: Partial<Tutanak>) => void;
  deleteTutanak: (id: string) => Tutanak | null;
  restoreTutanak: (id: string) => Tutanak | null;
}

export const createTutanakSlice: StateCreator<TutanakSlice> = (set) => ({
  tutanaklar: [],

  _setTutanaklar: (u) =>
    set((state) => ({
      tutanaklar: typeof u === 'function' ? u(state.tutanaklar) : u,
    })),

  addTutanakToState: (item) => {
    set((state) => ({ tutanaklar: [item, ...state.tutanaklar] }));
  },

  updateTutanak: (id, updates) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Tutanak> & { dosyaVeri?: string };
    set((state) => ({
      tutanaklar: state.tutanaklar.map((t) =>
        t.id !== id ? t : { ...t, ...rest, guncellemeTarihi: new Date().toISOString() },
      ),
    }));
  },

  deleteTutanak: (id) => {
    let result: Tutanak | null = null;
    set((state) => ({
      tutanaklar: state.tutanaklar.map((t) => {
        if (t.id !== id) return t;
        result = { ...t, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
        return result;
      }),
    }));
    return result;
  },

  restoreTutanak: (id) => {
    let result: Tutanak | null = null;
    set((state) => ({
      tutanaklar: state.tutanaklar.map((t) => {
        if (t.id !== id) return t;
        result = { ...t, silinmis: false as const, silinmeTarihi: undefined };
        return result;
      }),
    }));
    return result;
  },
});

export { genId };
