import type { StateCreator } from 'zustand';
import type { Evrak } from '@/types';
import { genId } from '@/store/storeHelpers';
import { getEvrakKategori } from '@/utils/evrakKategori';

export interface EvrakSlice {
  evraklar: Evrak[];
  _setEvraklar: (u: Evrak[] | ((p: Evrak[]) => Evrak[])) => void;
  addEvrak: (evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => Evrak;
  updateEvrak: (id: string, updates: Partial<Evrak>) => void;
  deleteEvrak: (id: string) => Evrak | null;
  restoreEvrak: (id: string) => Evrak | null;
}

export function normalizeEvrak(e: Evrak): Evrak {
  return { ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? '') };
}

export const createEvrakSlice: StateCreator<EvrakSlice> = (set) => ({
  evraklar: [],

  _setEvraklar: (u) =>
    set((state) => ({
      evraklar: typeof u === 'function' ? u(state.evraklar) : u,
    })),

  addEvrak: (evrak) => {
    const { dosyaVeri: _ignored, ...rest } = evrak as Evrak & { dosyaVeri?: string };
    const newEvrak: Evrak = normalizeEvrak({
      ...rest,
      id: genId(),
      olusturmaTarihi: new Date().toISOString(),
    });
    set((state) => ({ evraklar: [newEvrak, ...state.evraklar] }));
    return newEvrak;
  },

  updateEvrak: (id, updates) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Evrak> & { dosyaVeri?: string };
    let result: Evrak | null = null;
    set((state) => ({
      evraklar: state.evraklar.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...rest };
        if (rest.tur !== undefined || rest.ad !== undefined) {
          merged.kategori = getEvrakKategori(merged.tur, merged.ad);
        }
        result = merged;
        return result;
      }),
    }));
    return result;
  },

  deleteEvrak: (id) => {
    let result: Evrak | null = null;
    set((state) => ({
      evraklar: state.evraklar.map((e) => {
        if (e.id !== id) return e;
        result = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
        return result;
      }),
    }));
    return result;
  },

  restoreEvrak: (id) => {
    let result: Evrak | null = null;
    set((state) => ({
      evraklar: state.evraklar.map((e) => {
        if (e.id !== id) return e;
        result = { ...e, silinmis: false as const, silinmeTarihi: undefined };
        return result;
      }),
    }));
    return result;
  },
});
