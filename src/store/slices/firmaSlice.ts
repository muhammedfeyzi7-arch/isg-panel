import type { StateCreator } from 'zustand';
import type { Firma } from '@/types';
import { genId } from '@/store/storeHelpers';

export interface FirmaSlice {
  firmalar: Firma[];
  _setFirmalar: (u: Firma[] | ((p: Firma[]) => Firma[])) => void;
  addFirma: (firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => Firma;
  updateFirma: (id: string, updates: Partial<Firma>) => void;
  deleteFirma: (id: string, saveToDb: (table: string, item: Record<string, unknown>) => void) => void;
  restoreFirma: (id: string, saveToDb: (table: string, item: Record<string, unknown>, throwOnError?: boolean) => Promise<void>) => void;
}

export const createFirmaSlice: StateCreator<FirmaSlice> = (set) => ({
  firmalar: [],

  _setFirmalar: (u) =>
    set((state) => ({
      firmalar: typeof u === 'function' ? u(state.firmalar) : u,
    })),

  addFirma: (firma) => {
    const now = new Date().toISOString();
    const newFirma: Firma = { ...firma, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    set((state) => ({ firmalar: [newFirma, ...state.firmalar] }));
    return newFirma;
  },

  updateFirma: (id, updates) => {
    set((state) => ({
      firmalar: state.firmalar.map((f) =>
        f.id !== id ? f : { ...f, ...updates, guncellemeTarihi: new Date().toISOString() },
      ),
    }));
  },

  deleteFirma: (id, saveToDb) => {
    const now = new Date().toISOString();
    set((state) => {
      const updated = state.firmalar.map((f) =>
        f.id !== id ? f : { ...f, silinmis: true as const, silinmeTarihi: now },
      );
      const firm = updated.find((f) => f.id === id);
      if (firm) void saveToDb('firmalar', firm as unknown as Record<string, unknown>);
      return { firmalar: updated };
    });
  },

  restoreFirma: (id, saveToDb) => {
    set((state) => {
      const updated = state.firmalar.map((f) =>
        f.id !== id ? f : { ...f, silinmis: false as const, silinmeTarihi: undefined },
      );
      const firm = updated.find((f) => f.id === id);
      if (firm) void saveToDb('firmalar', firm as unknown as Record<string, unknown>, true);
      return { firmalar: updated };
    });
  },
});
