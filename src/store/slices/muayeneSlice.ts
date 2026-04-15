import type { StateCreator } from 'zustand';
import type { Muayene } from '@/types';
import { genId } from '@/store/storeHelpers';

export interface MuayeneSlice {
  muayeneler: Muayene[];
  _setMuayeneler: (u: Muayene[] | ((p: Muayene[]) => Muayene[])) => void;
  addMuayene: (muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => Muayene;
  updateMuayene: (id: string, updates: Partial<Muayene>) => void;
  deleteMuayene: (id: string) => Muayene | null;
  restoreMuayene: (id: string) => Muayene | null;
}

export const createMuayeneSlice: StateCreator<MuayeneSlice> = (set) => ({
  muayeneler: [],

  _setMuayeneler: (u) =>
    set((state) => ({
      muayeneler: typeof u === 'function' ? u(state.muayeneler) : u,
    })),

  addMuayene: (muayene) => {
    const newMuayene: Muayene = { ...muayene, id: genId(), olusturmaTarihi: new Date().toISOString() };
    set((state) => ({ muayeneler: [newMuayene, ...state.muayeneler] }));
    return newMuayene;
  },

  updateMuayene: (id, updates) => {
    set((state) => ({
      muayeneler: state.muayeneler.map((m) => (m.id !== id ? m : { ...m, ...updates })),
    }));
  },

  deleteMuayene: (id) => {
    let result: Muayene | null = null;
    set((state) => ({
      muayeneler: state.muayeneler.map((m) => {
        if (m.id !== id) return m;
        result = { ...m, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
        return result;
      }),
    }));
    return result;
  },

  restoreMuayene: (id) => {
    let result: Muayene | null = null;
    set((state) => ({
      muayeneler: state.muayeneler.map((m) => {
        if (m.id !== id) return m;
        result = { ...m, silinmis: false as const, silinmeTarihi: undefined };
        return result;
      }),
    }));
    return result;
  },
});
