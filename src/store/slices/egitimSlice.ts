import type { StateCreator } from 'zustand';
import type { Egitim } from '@/types';
import { genId } from '@/store/storeHelpers';

export interface EgitimSlice {
  egitimler: Egitim[];
  _setEgitimler: (u: Egitim[] | ((p: Egitim[]) => Egitim[])) => void;
  addEgitim: (egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => Egitim;
  updateEgitim: (id: string, updates: Partial<Egitim>) => void;
  deleteEgitim: (id: string) => Egitim | null;
  restoreEgitim: (id: string) => Egitim | null;
}

export const createEgitimSlice: StateCreator<EgitimSlice> = (set) => ({
  egitimler: [],

  _setEgitimler: (u) =>
    set((state) => ({
      egitimler: typeof u === 'function' ? u(state.egitimler) : u,
    })),

  addEgitim: (egitim) => {
    const { belgeDosyaVeri: _ignored, ...rest } = egitim as Egitim & { belgeDosyaVeri?: string };
    const newEgitim: Egitim = { ...rest, id: genId(), olusturmaTarihi: new Date().toISOString() };
    set((state) => ({ egitimler: [newEgitim, ...state.egitimler] }));
    return newEgitim;
  },

  updateEgitim: (id, updates) => {
    const { belgeDosyaVeri: _ignored, ...rest } = updates as Partial<Egitim> & { belgeDosyaVeri?: string };
    set((state) => ({
      egitimler: state.egitimler.map((e) => (e.id !== id ? e : { ...e, ...rest })),
    }));
  },

  deleteEgitim: (id) => {
    let result: Egitim | null = null;
    set((state) => ({
      egitimler: state.egitimler.map((e) => {
        if (e.id !== id) return e;
        result = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
        return result;
      }),
    }));
    return result;
  },

  restoreEgitim: (id) => {
    let result: Egitim | null = null;
    set((state) => ({
      egitimler: state.egitimler.map((e) => {
        if (e.id !== id) return e;
        result = { ...e, silinmis: false as const, silinmeTarihi: undefined };
        return result;
      }),
    }));
    return result;
  },
});
