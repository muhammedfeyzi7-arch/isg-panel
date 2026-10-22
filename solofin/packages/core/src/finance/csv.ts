import { DEDUCTIBILITY, TX_STATUS, transactionInputSchema, type Transaction, type TransactionInput } from "../data/schema";
import { fromKurus, parseMoneyInput } from "./money";

export const CSV_COLUMNS = [
  "tarih",
  "tur",
  "kategori",
  "tutar",
  "kdv_orani",
  "para_birimi",
  "karsi_taraf",
  "aciklama",
  "durum",
  "vade",
  "belge_ref",
  "stopaj_orani",
  "vergisel_durum",
] as const;

const REQUIRED = ["tarih", "tur", "kategori", "tutar"] as const;

/** RFC 4180 uyumlu basit CSV ayrıştırıcı (tırnaklı alanlar, kaçışlı tırnaklar, ; veya , ayırıcı). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export interface CsvImportResult {
  rows: TransactionInput[];
  errors: { line: number; message: string }[];
}

function parseRate(v: string | undefined, fallback: number): number | null {
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number(v.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n > 1 ? n / 100 : n;
}

const KIND_MAP: Record<string, "income" | "expense"> = { gelir: "income", income: "income", gider: "expense", expense: "expense" };
const STATUS_MAP: Record<string, (typeof TX_STATUS)[number]> = {
  odendi: "paid", ödendi: "paid", paid: "paid", tahsil: "paid",
  bekliyor: "pending", pending: "pending",
  gecikmis: "overdue", gecikmiş: "overdue", overdue: "overdue",
};

export function importTransactionsCsv(text: string): CsvImportResult {
  const table = parseCsv(text);
  const errors: CsvImportResult["errors"] = [];
  const rows: TransactionInput[] = [];
  if (table.length === 0) return { rows, errors: [{ line: 1, message: "Dosya boş" }] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length) return { rows, errors: [{ line: 1, message: `Eksik zorunlu sütun(lar): ${missing.join(", ")}` }] };
  const idx = (name: string) => header.indexOf(name);
  const get = (r: string[], name: string) => (idx(name) >= 0 ? (r[idx(name)] ?? "").trim() : undefined);

  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const kind = KIND_MAP[(get(r, "tur") ?? "").toLowerCase()];
    if (!kind) return void errors.push({ line, message: "tur 'gelir' veya 'gider' olmalı" });
    const amount = parseMoneyInput(get(r, "tutar") ?? "");
    if (amount === null || amount <= 0) return void errors.push({ line, message: "tutar pozitif bir sayı olmalı" });
    const vatRate = parseRate(get(r, "kdv_orani"), 0.2);
    if (vatRate === null || vatRate > 1) return void errors.push({ line, message: "kdv_orani geçersiz" });
    const withholdingRate = parseRate(get(r, "stopaj_orani"), 0);
    if (withholdingRate === null || withholdingRate > 1) return void errors.push({ line, message: "stopaj_orani geçersiz" });
    const statusRaw = (get(r, "durum") ?? "").toLowerCase();
    const status = statusRaw ? STATUS_MAP[statusRaw] : "paid";
    if (!status) return void errors.push({ line, message: "durum 'ödendi', 'bekliyor' veya 'gecikmiş' olmalı" });
    const dedRaw = get(r, "vergisel_durum") || "unknown";
    const deductibility = (DEDUCTIBILITY as readonly string[]).includes(dedRaw) ? (dedRaw as TransactionInput["deductibility"]) : null;
    if (!deductibility) return void errors.push({ line, message: "vergisel_durum geçersiz" });

    const candidate = {
      kind,
      date: get(r, "tarih") ?? "",
      dueDate: get(r, "vade") || undefined,
      amount,
      currency: (get(r, "para_birimi") || "TRY").toUpperCase(),
      vatRate,
      category: get(r, "kategori") ?? "",
      counterparty: get(r, "karsi_taraf") ?? "",
      description: get(r, "aciklama") ?? "",
      status,
      documentRef: get(r, "belge_ref") || undefined,
      withholdingRate: kind === "income" ? withholdingRate : 0,
      deductibility: kind === "income" ? "unknown" : deductibility,
    };
    const parsed = transactionInputSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({ line, message: parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ") });
      return;
    }
    rows.push(parsed.data);
  });
  return { rows, errors };
}

function esc(v: string | number | undefined): string {
  const s = v === undefined ? "" : String(v);
  // CSV enjeksiyonuna karşı formül karakterleriyle başlayan değerleri etkisizleştir
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const STATUS_OUT: Record<Transaction["status"], string> = { paid: "ödendi", pending: "bekliyor", overdue: "gecikmiş" };

export function exportTransactionsCsv(txs: readonly Transaction[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const t of txs) {
    lines.push(
      [
        t.date,
        t.kind === "income" ? "gelir" : "gider",
        t.category,
        fromKurus(t.amount).toFixed(2),
        t.vatRate,
        t.currency,
        t.counterparty,
        t.description,
        STATUS_OUT[t.status],
        t.dueDate,
        t.documentRef,
        t.withholdingRate,
        t.deductibility,
      ]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function toCsv(rows: readonly (readonly (string | number | undefined)[])[]): string {
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}
