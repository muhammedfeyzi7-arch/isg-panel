import type { StateCreator } from 'zustand';
import type { IsIzni } from '@/types';

export interface IsIzniSlice {
  isIzinleri: IsIzni[];
  _setIsIzinleri: (u: IsIzni[] | ((p: IsIzni[]) => IsIzni[])) => void;
  addIsIzniToState: (item: IsIzni) => void;
  updateIsIzniState: (id: string, updates: Partial<IsIzni>) => IsIzni | null;
  deleteIsIzni: (id: string) => IsIzni | null;
  restoreIsIzni: (id: string) => IsIzni | null;
}

export const createIsIzniSlice: StateCreator<IsIzniSlice> = (set) => ({
  isIzinleri: [],

  _setIsIzinleri: (u) =>
    set((state) => ({
      isIzinleri: typeof u === 'function' ? u(state.isIzinleri) : u,
    })),

  addIsIzniToState: (item) => {
    set((state) => ({ isIzinleri: [item, ...state.isIzinleri] }));
  },

  updateIsIzniState: (id, updates) => {
    let result: IsIzni | null = null;
    set((state) => ({
      isIzinleri: state.isIzinleri.map((iz) => {
        if (iz.id !== id) return iz;
        result = { ...iz, ...updates, guncellemeTarihi: new Date().toISOString() };
        return result;
      }),
    }));
    return result;
  },

  deleteIsIzni: (id) => {
    let result: IsIzni | null = null;
    set((state) => ({
      isIzinleri: state.isIzinleri.map((iz) => {
        if (iz.id !== id) return iz;
        result = { ...iz, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
        return result;
      }),
    }));
    return result;
  },

  restoreIsIzni: (id) => {
    let result: IsIzni | null = null;
    set((state) => ({
      isIzinleri: state.isIzinleri.map((iz) => {
        if (iz.id !== id) return iz;
        result = { ...iz, silinmis: false as const, silinmeTarihi: undefined };
        return result;
      }),
    }));
    return result;
  },
});
