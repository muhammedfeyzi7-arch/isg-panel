"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { todayISO } from "@solofin/core/finance/dates";
import { DEFAULT_SETTINGS } from "@solofin/core/data/demo";
import { loadDatabase, seedDemoDatabase, STORAGE_KEYS, userIdFor, type DataMode } from "@solofin/core/data/db";
import { emptyDatabase, Repository, type LocalDatabase } from "@solofin/core/data/repository";
import type { RecurringItem, RetirementInput, Scenario, ScenarioLevers, Settings, Transaction, TransactionInput } from "@solofin/core/data/schema";

export type { DataMode };

const KEY_MODE = STORAGE_KEYS.mode;
const keyDb = STORAGE_KEYS.db;

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

function loadDb(mode: DataMode, today: string): LocalDatabase {
  return loadDatabase(safeGet(keyDb(mode)), mode, today);
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

  const userId = userIdFor(mode);
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
