import {
  documentInputSchema,
  documentSchema,
  recurringItemSchema,
  retirementInputSchema,
  scenarioLeversSchema,
  settingsSchema,
  transactionInputSchema,
  transactionSchema,
  type DocumentInput,
  type RecurringItem,
  type SolofinDocument,
  type RetirementInput,
  type Scenario,
  type ScenarioLevers,
  type Settings,
  type Transaction,
  type TransactionInput,
} from "./schema";
import { DEFAULT_SETTINGS } from "./demo";

/**
 * Yerel veritabanı: tablolar tüm kullanıcıların satırlarını içerir (Supabase tablolarına benzer).
 * Erişim YALNIZCA kullanıcıya bağlı `Repository` üzerinden yapılır; bu katman RLS'nin istemci
 * tarafındaki karşılığıdır ve kullanıcı izolasyonu testleri bu sınıfı hedefler.
 */
export interface LocalDatabase {
  version: 1;
  transactions: Transaction[];
  recurring: RecurringItem[];
  scenarios: Scenario[];
  settings: Record<string, Settings>;
  retirement: Record<string, RetirementInput>;
  documents: SolofinDocument[];
}

export function emptyDatabase(): LocalDatabase {
  return { version: 1, transactions: [], recurring: [], scenarios: [], settings: {}, retirement: {}, documents: [] };
}

export class AccessDeniedError extends Error {
  constructor(message = "Bu kayda erişim yetkiniz yok") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Kayıt bulunamadı") {
    super(message);
    this.name = "NotFoundError";
  }
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`;
}

export const DEFAULT_RETIREMENT: RetirementInput = {
  currentAge: 32,
  targetAge: 60,
  currentSavings: 25_000_000,
  monthlyContribution: 1_000_000,
  inflation: 0.25,
  targetMonthlyBudget: 6_000_000,
  withdrawalRate: 0.04,
};

export class Repository {
  constructor(
    private readonly db: LocalDatabase,
    readonly userId: string,
    private readonly source: Transaction["source"] = "user",
  ) {
    if (!userId) throw new AccessDeniedError("Oturum açılmamış");
  }

  private own<T extends { userId: string }>(rows: T[]): T[] {
    return rows.filter((r) => r.userId === this.userId);
  }

  private findOwned<T extends { id: string; userId: string }>(rows: T[], id: string): T {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new NotFoundError();
    if (row.userId !== this.userId) throw new AccessDeniedError();
    return row;
  }

  // ---- İşlemler ----
  listTransactions(): Transaction[] {
    return this.own(this.db.transactions).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }

  getTransaction(id: string): Transaction {
    return this.findOwned(this.db.transactions, id);
  }

  createTransaction(input: TransactionInput, source: Transaction["source"] = this.source): Transaction {
    const data = transactionInputSchema.parse(input);
    const now = new Date().toISOString();
    const tx = transactionSchema.parse({ ...data, id: newId("tx"), userId: this.userId, source, createdAt: now, updatedAt: now });
    this.db.transactions.push(tx);
    return tx;
  }

  updateTransaction(id: string, input: TransactionInput): Transaction {
    const existing = this.findOwned(this.db.transactions, id);
    const data = transactionInputSchema.parse(input);
    const updated = transactionSchema.parse({ ...existing, ...data, id: existing.id, userId: existing.userId, updatedAt: new Date().toISOString() });
    this.db.transactions[this.db.transactions.indexOf(existing)] = updated;
    return updated;
  }

  deleteTransaction(id: string): void {
    const existing = this.findOwned(this.db.transactions, id);
    this.db.transactions.splice(this.db.transactions.indexOf(existing), 1);
  }

  // ---- Tekrarlayan kalemler ----
  listRecurring(): RecurringItem[] {
    return this.own(this.db.recurring);
  }

  upsertRecurring(item: Omit<RecurringItem, "userId" | "id"> & { id?: string }): RecurringItem {
    if (item.id) {
      const existing = this.findOwned(this.db.recurring, item.id);
      const updated = recurringItemSchema.parse({ ...existing, ...item, userId: this.userId });
      this.db.recurring[this.db.recurring.indexOf(existing)] = updated;
      return updated;
    }
    const created = recurringItemSchema.parse({ ...item, id: newId("rec"), userId: this.userId });
    this.db.recurring.push(created);
    return created;
  }

  deleteRecurring(id: string): void {
    const existing = this.findOwned(this.db.recurring, id);
    this.db.recurring.splice(this.db.recurring.indexOf(existing), 1);
  }

  // ---- Senaryolar ----
  listScenarios(): Scenario[] {
    return this.own(this.db.scenarios).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveScenario(name: string, levers: ScenarioLevers, id?: string): Scenario {
    const parsed = scenarioLeversSchema.parse(levers);
    const trimmed = name.trim().slice(0, 80) || "Adsız senaryo";
    if (id) {
      const existing = this.findOwned(this.db.scenarios, id);
      const updated = { ...existing, name: trimmed, levers: parsed };
      this.db.scenarios[this.db.scenarios.indexOf(existing)] = updated;
      return updated;
    }
    const sc: Scenario = { id: newId("sc"), userId: this.userId, name: trimmed, createdAt: new Date().toISOString(), levers: parsed };
    this.db.scenarios.push(sc);
    return sc;
  }

  deleteScenario(id: string): void {
    const existing = this.findOwned(this.db.scenarios, id);
    this.db.scenarios.splice(this.db.scenarios.indexOf(existing), 1);
  }

  // ---- Belgeler ----
  listDocuments(): SolofinDocument[] {
    return this.own(this.db.documents).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }

  createDocument(input: DocumentInput): SolofinDocument {
    const data = documentInputSchema.parse(input);
    const doc = documentSchema.parse({ ...data, id: newId("doc"), userId: this.userId, createdAt: new Date().toISOString() });
    this.db.documents.push(doc);
    return doc;
  }

  updateDocument(id: string, patch: Partial<DocumentInput>): SolofinDocument {
    const existing = this.findOwned(this.db.documents, id);
    const updated = documentSchema.parse({ ...existing, ...patch, id: existing.id, userId: existing.userId });
    this.db.documents[this.db.documents.indexOf(existing)] = updated;
    return updated;
  }

  deleteDocument(id: string): void {
    const existing = this.findOwned(this.db.documents, id);
    this.db.documents.splice(this.db.documents.indexOf(existing), 1);
  }

  // ---- Ayarlar ----
  getSettings(): Settings {
    return this.db.settings[this.userId] ?? DEFAULT_SETTINGS;
  }

  saveSettings(settings: Settings): Settings {
    const parsed = settingsSchema.parse(settings);
    this.db.settings[this.userId] = parsed;
    return parsed;
  }

  getRetirement(): RetirementInput {
    return this.db.retirement[this.userId] ?? DEFAULT_RETIREMENT;
  }

  saveRetirement(input: RetirementInput): RetirementInput {
    const parsed = retirementInputSchema.parse(input);
    this.db.retirement[this.userId] = parsed;
    return parsed;
  }

  /** Kullanıcının tüm verisini dışa aktarır (KVKK veri taşınabilirliği için) */
  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      userId: this.userId,
      transactions: this.listTransactions(),
      recurring: this.listRecurring(),
      scenarios: this.listScenarios(),
      settings: this.getSettings(),
      retirement: this.getRetirement(),
      documents: this.listDocuments(),
    };
  }

  /** Hesap silme akışı: kullanıcıya ait tüm satırları kaldırır */
  deleteAllData(): void {
    const keep = <T extends { userId: string }>(rows: T[]) => rows.filter((r) => r.userId !== this.userId);
    this.db.transactions = keep(this.db.transactions);
    this.db.recurring = keep(this.db.recurring);
    this.db.scenarios = keep(this.db.scenarios);
    this.db.documents = keep(this.db.documents);
    delete this.db.settings[this.userId];
    delete this.db.retirement[this.userId];
  }
}

/** localStorage'dan okunan ham veriyi doğrular; bozuk satırları atar. */
export function hydrateDatabase(raw: unknown): LocalDatabase {
  const db = emptyDatabase();
  if (!raw || typeof raw !== "object") return db;
  const r = raw as Partial<LocalDatabase>;
  if (Array.isArray(r.transactions)) db.transactions = r.transactions.filter((t) => transactionSchema.safeParse(t).success);
  if (Array.isArray(r.recurring)) db.recurring = r.recurring.filter((t) => recurringItemSchema.safeParse(t).success);
  if (Array.isArray(r.scenarios)) db.scenarios = r.scenarios.filter((s) => scenarioLeversSchema.safeParse(s?.levers).success && typeof s.userId === "string");
  if (Array.isArray(r.documents)) db.documents = r.documents.filter((d) => documentSchema.safeParse(d).success);
  if (r.settings && typeof r.settings === "object") {
    for (const [k, v] of Object.entries(r.settings)) {
      const p = settingsSchema.safeParse(v);
      if (p.success) db.settings[k] = p.data;
    }
  }
  if (r.retirement && typeof r.retirement === "object") {
    for (const [k, v] of Object.entries(r.retirement)) {
      const p = retirementInputSchema.safeParse(v);
      if (p.success) db.retirement[k] = p.data;
    }
  }
  return db;
}
