import type { StateCreator } from 'zustand';
import type { Uygunsuzluk, UygunsuzlukStatus } from '@/types';
import { genId } from '@/store/storeHelpers';

export function normalizeUygunsuzluk(u: Uygunsuzluk): Uygunsuzluk {
  let durum = u.durum as string;
  if (durum === 'Kapatıldı') durum = 'Kapandı';
  if (durum === 'İncelemede') durum = 'Açık';
  return { ...u, durum: durum as UygunsuzlukStatus };
}

export interface UygunsuzlukSlice {
  uygunsuzluklar: Uygunsuzluk[];
  _setUygunsuzluklar: (u: Uygunsuzluk[] | ((p: Uygunsuzluk[]) => Uygunsuzluk[])) => void;
  addUygunsuzlukToState: (item: Uygunsuzluk) => void;
  updateUygunsuzluk: (id: string, updates: Partial<Uygunsuzluk>) => void;
  deleteUygunsuzluk: (id: string) => Uygunsuzluk | null;
  restoreUygunsuzluk: (id: string) => Uygunsuzluk | null;
}

export const createUygunsuzlukSlice: StateCreator<UygunsuzlukSlice> = (set) => ({
  uygunsuzluklar: [],

  _setUygunsuzluklar: (u) =>
    set((state) => ({
      uygunsuzluklar: typeof u === 'function' ? u(state.uygunsuzluklar) : u,
    })),

  addUygunsuzlukToState: (item) => {
    set((state) => ({ uygunsuzluklar: [item, ...state.uygunsuzluklar] }));
  },

  updateUygunsuzluk: (id, updates) => {
    set((state) => ({
      uygunsuzluklar: state.uygunsuzluklar.map((u) => {
        if (u.id !== id) return u;
        const merged = { ...u, ...updates };
        merged.durum = merged.kapatmaFotoMevcut ? 'Kapandı' : 'Açık';
        return merged;
      }),
    }));
  },

  deleteUygunsuzluk: (id) => {
    let result: Uygunsuzluk | null = null;
    set((state) => ({
      uygunsuzluklar: state.uygunsuzluklar.map((u) => {
        if (u.id !== id) return u;
        result = { ...u, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
        return result;
      }),
    }));
    return result;
  },

  restoreUygunsuzluk: (id) => {
    let result: Uygunsuzluk | null = null;
    set((state) => ({
      uygunsuzluklar: state.uygunsuzluklar.map((u) => {
        if (u.id !== id) return u;
        result = { ...u, silinmis: false as const, silinmeTarihi: undefined };
        return result;
      }),
    }));
    return result;
  },
});
