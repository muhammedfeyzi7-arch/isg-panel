import { DEFAULT_SETTINGS, DEMO_USER_ID, demoRecurring, demoSettings, generateDemoTransactions } from "./demo";
import { emptyDatabase, hydrateDatabase, type LocalDatabase } from "./repository";

export type DataMode = "demo" | "local";
export const LOCAL_USER_ID = "local-user";

export const STORAGE_KEYS = {
  mode: "solofin:mode",
  db: (mode: DataMode) => `solofin:db:${mode}:v1`,
  theme: "solofin:theme",
} as const;

export function userIdFor(mode: DataMode): string {
  return mode === "demo" ? DEMO_USER_ID : LOCAL_USER_ID;
}

/** Demo veritabanı: yalnızca demo kullanıcısı satırlarını içerir, gerçek veriden ayrı anahtarda tutulur. */
export function seedDemoDatabase(today: string): LocalDatabase {
  const db = emptyDatabase();
  db.transactions = generateDemoTransactions(today);
  db.recurring = demoRecurring(today);
  db.settings[DEMO_USER_ID] = demoSettings(today);
  return db;
}

export function seedLocalDatabase(today: string): LocalDatabase {
  const db = emptyDatabase();
  db.settings[LOCAL_USER_ID] = { ...DEFAULT_SETTINGS, taxYear: Number(today.slice(0, 4)) };
  return db;
}

/**
 * Depolamadan okunan ham JSON'u doğrulayarak veritabanına çevirir. Veri yoksa veya bozuksa
 * mod için başlangıç veritabanı döner. Depolama erişimi platforma özgüdür (localStorage / AsyncStorage).
 */
export function loadDatabase(raw: string | null, mode: DataMode, today: string): LocalDatabase {
  if (raw) {
    try {
      const db = hydrateDatabase(JSON.parse(raw));
      if (mode === "local" || db.transactions.length > 0) return db;
    } catch {
      /* bozuk veri: yeniden oluşturulur */
    }
  }
  return mode === "demo" ? seedDemoDatabase(today) : seedLocalDatabase(today);
}
