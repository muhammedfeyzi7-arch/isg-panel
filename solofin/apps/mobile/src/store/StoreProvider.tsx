import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS } from "@solofin/core/data/demo";
import { loadDatabase, seedDemoDatabase, seedLocalDatabase, STORAGE_KEYS, userIdFor, type DataMode } from "@solofin/core/data/db";
import { emptyDatabase, Repository, type LocalDatabase } from "@solofin/core/data/repository";
import type {
  DocumentInput,
  RecurringItem,
  RetirementInput,
  Scenario,
  ScenarioLevers,
  Settings,
  SolofinDocument,
  Transaction,
  TransactionInput,
} from "@solofin/core/data/schema";
import { todayISO } from "@solofin/core/finance/dates";

export type { DataMode };

interface StoreValue {
  ready: boolean;
  mode: DataMode;
  today: string;
  transactions: Transaction[];
  recurring: RecurringItem[];
  scenarios: Scenario[];
  documents: SolofinDocument[];
  settings: Settings;
  retirement: RetirementInput;
  setMode: (m: DataMode) => Promise<void>;
  addTransaction: (input: TransactionInput) => Transaction;
  updateTransaction: (id: string, input: TransactionInput) => Transaction;
  deleteTransaction: (id: string) => void;
  importTransactions: (inputs: TransactionInput[]) => number;
  upsertRecurring: (item: Omit<RecurringItem, "userId" | "id"> & { id?: string }) => void;
  deleteRecurring: (id: string) => void;
  saveScenario: (name: string, levers: ScenarioLevers, id?: string) => Scenario;
  deleteScenario: (id: string) => void;
  addDocument: (input: DocumentInput) => SolofinDocument;
  updateDocument: (id: string, patch: Partial<DocumentInput>) => void;
  deleteDocument: (id: string) => void;
  saveSettings: (s: Settings) => void;
  saveRetirement: (r: RetirementInput) => void;
  resetDemo: () => void;
  exportAll: () => ReturnType<Repository["exportAll"]>;
  deleteAllData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

async function readDb(mode: DataMode, today: string): Promise<LocalDatabase> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEYS.db(mode));
  } catch {
    raw = null;
  }
  return loadDatabase(raw, mode, today);
}

/**
 * Cihaz üzerinde AsyncStorage ile kalıcı store. Demo ve kullanıcı verisi ayrı anahtarlarda tutulur.
 * Tüm doğrulama ve kullanıcı izolasyonu @solofin/core Repository katmanındadır.
 */
function cloneDb(db: LocalDatabase): LocalDatabase {
  return JSON.parse(JSON.stringify(db)) as LocalDatabase;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<DataMode>("demo");
  const [today] = useState(() => todayISO());
  const [db, setDb] = useState<LocalDatabase>(() => emptyDatabase());
  // Olay işleyicilerinde en güncel veritabanı (aynı işleyicide art arda yapılan değişiklikler kaybolmasın)
  const latest = useRef<{ db: LocalDatabase; mode: DataMode }>({ db, mode });

  useEffect(() => {
    let alive = true;
    (async () => {
      let stored: string | null = null;
      try {
        stored = await AsyncStorage.getItem(STORAGE_KEYS.mode);
      } catch {
        stored = null;
      }
      const m: DataMode = stored === "local" ? "local" : "demo";
      const loaded = await readDb(m, today);
      if (!alive) return;
      latest.current = { db: loaded, mode: m };
      setDb(loaded);
      setModeState(m);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [today]);

  /** Değişikliği kopya üzerinde uygular, state'e ve cihaz depolamasına yazar. */
  const mutate = useCallback(<R,>(fn: (repo: Repository) => R): R => {
    const { db: current, mode: m } = latest.current;
    const next = cloneDb(current);
    const result = fn(new Repository(next, userIdFor(m), m === "demo" ? "demo" : "user"));
    latest.current = { db: next, mode: m };
    setDb(next);
    AsyncStorage.setItem(STORAGE_KEYS.db(m), JSON.stringify(next)).catch(() => {
      /* depolama hatası: oturum içinde bellekte devam edilir */
    });
    return result;
  }, []);

  const setMode = useCallback(
    async (m: DataMode) => {
      await AsyncStorage.setItem(STORAGE_KEYS.mode, m).catch(() => undefined);
      const loaded = await readDb(m, today);
      latest.current = { db: loaded, mode: m };
      setDb(loaded);
      setModeState(m);
    },
    [today],
  );

  const value = useMemo<StoreValue>(() => {
    const userId = userIdFor(mode);
    const view = new Repository(db, userId, mode === "demo" ? "demo" : "user");
    return {
      ready,
      mode,
      today,
      transactions: view.listTransactions(),
      recurring: view.listRecurring(),
      scenarios: view.listScenarios(),
      documents: view.listDocuments(),
      settings: view.getSettings(),
      retirement: view.getRetirement(),
      setMode,
      addTransaction: (input) => mutate((r) => r.createTransaction(input)),
      updateTransaction: (id, input) => mutate((r) => r.updateTransaction(id, input)),
      deleteTransaction: (id) => mutate((r) => r.deleteTransaction(id)),
      importTransactions: (inputs) =>
        mutate((r) => {
          for (const i of inputs) r.createTransaction(i, "import");
          return inputs.length;
        }),
      upsertRecurring: (item) => void mutate((r) => r.upsertRecurring(item)),
      deleteRecurring: (id) => mutate((r) => r.deleteRecurring(id)),
      saveScenario: (name, levers, id) => mutate((r) => r.saveScenario(name, levers, id)),
      deleteScenario: (id) => mutate((r) => r.deleteScenario(id)),
      addDocument: (input) => mutate((r) => r.createDocument(input)),
      updateDocument: (id, patch) => void mutate((r) => r.updateDocument(id, patch)),
      deleteDocument: (id) => mutate((r) => r.deleteDocument(id)),
      saveSettings: (s) => void mutate((r) => r.saveSettings(s)),
      saveRetirement: (rt) => void mutate((r) => r.saveRetirement(rt)),
      resetDemo: () => {
        AsyncStorage.removeItem(STORAGE_KEYS.db("demo")).catch(() => undefined);
        if (latest.current.mode === "demo") {
          const seeded = seedDemoDatabase(today);
          latest.current = { db: seeded, mode: "demo" };
          setDb(seeded);
        }
      },
      exportAll: () => view.exportAll(),
      deleteAllData: () =>
        mutate((r) => {
          r.deleteAllData();
          if (latest.current.mode === "local") r.saveSettings(seedLocalDatabase(today).settings[r.userId] ?? { ...DEFAULT_SETTINGS });
        }),
    };
  }, [db, ready, mode, today, setMode, mutate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore, StoreProvider içinde kullanılmalı");
  return ctx;
}
