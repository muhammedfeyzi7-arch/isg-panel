"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { todayISO } from "../finance/dates";
import { DEMO_USER_ID, demoRecurring, demoSettings, generateDemoTransactions, DEFAULT_SETTINGS } from "./demo";
import { emptyDatabase, hydrateDatabase, Repository, type LocalDatabase } from "./repository";
import type { RecurringItem, RetirementInput, Scenario, ScenarioLevers, Settings, Transaction, TransactionInput } from "./schema";

export type DataMode = "demo" | "local";
export const LOCAL_USER_ID = "local-user";

const KEY_MODE = "solofin:mode";
const keyDb = (mode: DataMode) => `solofin:db:${mode}:v1`;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* depolama kullanılamıyor (gizli mod vb.) — oturum içi bellekte devam edilir */
  }
}
function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* yok say */
  }
}

/** Demo veritabanı: yalnızca demo kullanıcısı satırlarını içerir, gerçek veriden ayrı anahtarda tutulur. */
export function seedDemoDatabase(today: string): LocalDatabase {
  const db = emptyDatabase();
  db.transactions = generateDemoTransactions(today);
  db.recurring = demoRecurring(today);
  db.settings[DEMO_USER_ID] = demoSettings(today);
  return db;
}

function loadDb(mode: DataMode, today: string): LocalDatabase {
  const raw = safeGet(keyDb(mode));
  if (raw) {
    try {
      const db = hydrateDatabase(JSON.parse(raw));
      if (mode === "local" || db.transactions.length > 0) return db;
    } catch {
      /* bozuk veri: aşağıda yeniden oluşturulur */
    }
  }
  if (mode === "demo") return seedDemoDatabase(today);
  const db = emptyDatabase();
  db.settings[LOCAL_USER_ID] = { ...DEFAULT_SETTINGS, taxYear: Number(today.slice(0, 4)) };
  return db;
}

interface StoreValue {
  ready: boolean;
  mode: DataMode;
  today: string;
  userId: string;
  transactions: Transaction[];
  recurring: RecurringItem[];
  scenarios: Scenario[];
  settings: Settings;
  retirement: RetirementInput;
  setMode: (m: DataMode) => void;
  addTransaction: (input: TransactionInput) => Transaction;
  updateTransaction: (id: string, input: TransactionInput) => Transaction;
  deleteTransaction: (id: string) => void;
  importTransactions: (inputs: TransactionInput[]) => number;
  upsertRecurring: (item: Omit<RecurringItem, "userId" | "id"> & { id?: string }) => void;
  deleteRecurring: (id: string) => void;
  saveScenario: (name: string, levers: ScenarioLevers, id?: string) => Scenario;
  deleteScenario: (id: string) => void;
  saveSettings: (s: Settings) => void;
  saveRetirement: (r: RetirementInput) => void;
  resetDemo: () => void;
  exportAll: () => ReturnType<Repository["exportAll"]>;
  deleteAllData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<DataMode>("demo");
  const [today, setToday] = useState("2026-01-01");
  const dbRef = useRef<LocalDatabase>(emptyDatabase());
  const [version, setVersion] = useState(0);

  // İstemci tarafında yükle (SSR ile tarih/depolama uyuşmazlığını önler)
  useEffect(() => {
    const t = todayISO();
    const storedMode = safeGet(KEY_MODE) === "local" ? "local" : "demo";
    dbRef.current = loadDb(storedMode, t);
    setToday(t);
    setModeState(storedMode);
    setReady(true);
    setVersion((v) => v + 1);
  }, []);

  const userId = mode === "demo" ? DEMO_USER_ID : LOCAL_USER_ID;
  const repo = useMemo(() => new Repository(dbRef.current, userId, mode === "demo" ? "demo" : "user"), [userId, mode, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback(() => {
    safeSet(keyDb(mode), JSON.stringify(dbRef.current));
    setVersion((v) => v + 1);
  }, [mode]);

  const setMode = useCallback(
    (m: DataMode) => {
      safeSet(KEY_MODE, m);
      dbRef.current = loadDb(m, today);
      setModeState(m);
      setVersion((v) => v + 1);
    },
    [today],
  );

  const value = useMemo<StoreValue>(() => {
    const settings = repo.getSettings();
    return {
      ready,
      mode,
      today,
      userId,
      transactions: repo.listTransactions(),
      recurring: repo.listRecurring(),
      scenarios: repo.listScenarios(),
      settings,
      retirement: repo.getRetirement(),
      setMode,
      addTransaction: (input) => {
        const tx = repo.createTransaction(input);
        commit();
        return tx;
      },
      updateTransaction: (id, input) => {
        const tx = repo.updateTransaction(id, input);
        commit();
        return tx;
      },
      deleteTransaction: (id) => {
        repo.deleteTransaction(id);
        commit();
      },
      importTransactions: (inputs) => {
        for (const i of inputs) repo.createTransaction(i, "import");
        commit();
        return inputs.length;
      },
      upsertRecurring: (item) => {
        repo.upsertRecurring(item);
        commit();
      },
      deleteRecurring: (id) => {
        repo.deleteRecurring(id);
        commit();
      },
      saveScenario: (name, levers, id) => {
        const sc = repo.saveScenario(name, levers, id);
        commit();
        return sc;
      },
      deleteScenario: (id) => {
        repo.deleteScenario(id);
        commit();
      },
      saveSettings: (s) => {
        repo.saveSettings(s);
        commit();
      },
      saveRetirement: (r) => {
        repo.saveRetirement(r);
        commit();
      },
      resetDemo: () => {
        safeRemove(keyDb("demo"));
        if (mode === "demo") {
          dbRef.current = seedDemoDatabase(today);
          setVersion((v) => v + 1);
        }
      },
      exportAll: () => repo.exportAll(),
      deleteAllData: () => {
        repo.deleteAllData();
        if (mode === "local") repo.saveSettings({ ...DEFAULT_SETTINGS, taxYear: Number(today.slice(0, 4)) });
        commit();
      },
    };
  }, [repo, ready, mode, today, userId, setMode, commit]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore, StoreProvider içinde kullanılmalı");
  return ctx;
}
