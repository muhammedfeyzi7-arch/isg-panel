import { create } from 'zustand';
import { createFirmaSlice, type FirmaSlice } from './slices/firmaSlice';
import { createPersonelSlice, type PersonelSlice } from './slices/personelSlice';
import { createEvrakSlice, type EvrakSlice } from './slices/evrakSlice';
import { createEgitimSlice, type EgitimSlice } from './slices/egitimSlice';
import { createMuayeneSlice, type MuayeneSlice } from './slices/muayeneSlice';
import { createUygunsuzlukSlice, type UygunsuzlukSlice } from './slices/uygunsuzlukSlice';
import { createEkipmanSlice, type EkipmanSlice } from './slices/ekipmanSlice';
import { createTutanakSlice, type TutanakSlice } from './slices/tutanakSlice';
import { createIsIzniSlice, type IsIzniSlice } from './slices/isIzniSlice';

export type MainStore =
  FirmaSlice &
  PersonelSlice &
  EvrakSlice &
  EgitimSlice &
  MuayeneSlice &
  UygunsuzlukSlice &
  EkipmanSlice &
  TutanakSlice &
  IsIzniSlice;

/**
 * Ana Zustand store — tüm tablo slice'larını birleştirir.
 *
 * Kullanım:
 *   const firmalar = useMainStore(s => s.firmalar);
 *   const { addFirma } = useMainStore();
 *
 * NOT: Bu store sadece IN-MEMORY state'i yönetir.
 * DB yazma (saveToDb) ve realtime subscription işlemleri
 * hâlâ AppContext içindeki useStore hook'u tarafından yönetilir.
 * Migration aşamalı yapılmaktadır; mevcut AppContext/useStore kırılmadan çalışmaya devam eder.
 */
export const useMainStore = create<MainStore>()((...args) => ({
  ...createFirmaSlice(...args),
  ...createPersonelSlice(...args),
  ...createEvrakSlice(...args),
  ...createEgitimSlice(...args),
  ...createMuayeneSlice(...args),
  ...createUygunsuzlukSlice(...args),
  ...createEkipmanSlice(...args),
  ...createTutanakSlice(...args),
  ...createIsIzniSlice(...args),
}));

// ── Selector helpers (memoization için) ────────────────────────────────────
// Bileşenler bu selector'ları kullanarak gereksiz re-render'ı önler.
// Örnek: const firmalar = useMainStore(selectFirmalar);
export const selectFirmalar = (s: MainStore) => s.firmalar;
export const selectPersoneller = (s: MainStore) => s.personeller;
export const selectEvraklar = (s: MainStore) => s.evraklar;
export const selectEgitimler = (s: MainStore) => s.egitimler;
export const selectMuayeneler = (s: MainStore) => s.muayeneler;
export const selectUygunsuzluklar = (s: MainStore) => s.uygunsuzluklar;
export const selectEkipmanlar = (s: MainStore) => s.ekipmanlar;
export const selectTutanaklar = (s: MainStore) => s.tutanaklar;
export const selectIsIzinleri = (s: MainStore) => s.isIzinleri;

// ── Store reset (org değişimi veya logout için) ────────────────────────────
export function resetMainStore(): void {
  useMainStore.setState({
    firmalar: [],
    personeller: [],
    evraklar: [],
    egitimler: [],
    muayeneler: [],
    uygunsuzluklar: [],
    ekipmanlar: [],
    tutanaklar: [],
    isIzinleri: [],
  });
}
