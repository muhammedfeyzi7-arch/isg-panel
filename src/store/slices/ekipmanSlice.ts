import type { StateCreator } from 'zustand';
import type { Ekipman, EkipmanKontrolKaydi, EkipmanBelge } from '@/types';
import { genId } from '@/store/storeHelpers';

export interface EkipmanSlice {
  ekipmanlar: Ekipman[];
  _setEkipmanlar: (u: Ekipman[] | ((p: Ekipman[]) => Ekipman[])) => void;
  addEkipman: (e: Omit<Ekipman, 'id' | 'olusturmaTarihi'>) => Ekipman;
  updateEkipmanState: (id: string, updates: Partial<Ekipman>) => Ekipman | null;
  addEkipmanKontrolKaydiState: (ekipmanId: string, kayit: Omit<EkipmanKontrolKaydi, 'id'>) => Ekipman | null;
  addEkipmanBelgeState: (ekipmanId: string, belge: Omit<EkipmanBelge, 'id' | 'arsiv'>) => Ekipman | null;
  deleteEkipman: (id: string) => Ekipman | null;
  restoreEkipman: (id: string) => Ekipman | null;
}

export const createEkipmanSlice: StateCreator<EkipmanSlice> = (set) => ({
  ekipmanlar: [],

  _setEkipmanlar: (u) =>
    set((state) => ({
      ekipmanlar: typeof u === 'function' ? u(state.ekipmanlar) : u,
    })),

  addEkipman: (e) => {
    const { dosyaVeri: _ignored, ...rest } = e as Ekipman & { dosyaVeri?: string };
    const newE: Ekipman = { ...rest, id: genId(), olusturmaTarihi: new Date().toISOString() };
    set((state) => ({ ekipmanlar: [newE, ...state.ekipmanlar] }));
    return newE;
  },

  updateEkipmanState: (id, updates) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Ekipman> & { dosyaVeri?: string };
    let result: Ekipman | null = null;
    set((state) => ({
      ekipmanlar: state.ekipmanlar.map((e) => {
        if (e.id !== id) return e;
        result = { ...e, ...rest };
        return result;
      }),
    }));
    return result;
  },

  addEkipmanKontrolKaydiState: (ekipmanId, kayit) => {
    const yeniKayit: EkipmanKontrolKaydi = { ...kayit, id: genId() };
    let result: Ekipman | null = null;
    set((state) => ({
      ekipmanlar: state.ekipmanlar.map((e) => {
        if (e.id !== ekipmanId) return e;
        result = {
          ...e,
          durum: kayit.durum,
          kontrolGecmisi: [yeniKayit, ...(e.kontrolGecmisi ?? [])],
          sonKontrolTarihi: kayit.tarih.split('T')[0],
        };
        return result;
      }),
    }));
    return result;
  },

  addEkipmanBelgeState: (ekipmanId, belge) => {
    const yeniBelge: EkipmanBelge = { ...belge, id: genId(), arsiv: false };
    let result: Ekipman | null = null;
    set((state) => ({
      ekipmanlar: state.ekipmanlar.map((e) => {
        if (e.id !== ekipmanId) return e;
        const eskiBelgeler = (e.belgeler ?? []).map((b) => (b.arsiv ? b : { ...b, arsiv: true }));
        result = {
          ...e,
          belgeler: [yeniBelge, ...eskiBelgeler],
          belgeMevcut: true,
          dosyaAdi: yeniBelge.dosyaAdi,
          dosyaUrl: yeniBelge.dosyaUrl,
        };
        return result;
      }),
    }));
    return result;
  },

  deleteEkipman: (id) => {
    let result: Ekipman | null = null;
    set((state) => ({
      ekipmanlar: state.ekipmanlar.map((e) => {
        if (e.id !== id) return e;
        result = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
        return result;
      }),
    }));
    return result;
  },

  restoreEkipman: (id) => {
    let result: Ekipman | null = null;
    set((state) => ({
      ekipmanlar: state.ekipmanlar.map((e) => {
        if (e.id !== id) return e;
        result = { ...e, silinmis: false as const, silinmeTarihi: undefined };
        return result;
      }),
    }));
    return result;
  },
});
