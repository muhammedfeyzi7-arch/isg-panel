"use client";

import clsx from "clsx";
import { ArrowDownUp, Download, FileUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { DemoNotice, PageHeader } from "@/components/layout/AppShell";
import { TransactionForm } from "@/components/TransactionForm";
import { Badge, Button, Card, Dialog, EmptyState, Input, Segmented, Select } from "@/components/ui";
import { DEDUCTIBILITY, DEDUCTIBILITY_LABEL, TX_STATUS, TX_STATUS_LABEL, type Transaction, type TransactionInput } from "@solofin/core/data/schema";
import { useStore } from "@/lib/data/store";
import { downloadText } from "@/lib/download";
import { CSV_COLUMNS, exportTransactionsCsv, importTransactionsCsv, type CsvImportResult } from "@solofin/core/finance/csv";
import { formatDate } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner />
    </Suspense>
  );
}

function TransactionsInner() {
  const params = useSearchParams();
  const store = useStore();
  const { transactions, today } = store;

  const [kind, setKind] = useState<"all" | "income" | "expense">("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState(params.get("durum") ?? "");
  const [deductibility, setDeductibility] = useState(params.get("vergisel") ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [limit, setLimit] = useState(40);

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [importResult, setImportResult] = useState<(CsvImportResult & { fileName: string }) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort((a, b) => a.localeCompare(b, "tr")), [transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const rows = transactions.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (category && t.category !== category) return false;
      if (status && t.status !== status) return false;
      if (deductibility && (t.kind !== "expense" || t.deductibility !== deductibility)) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (q && !`${t.description} ${t.counterparty} ${t.category} ${t.documentRef ?? ""}`.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
    const [key, dir] = sort.split("-") as ["date" | "amount", "asc" | "desc"];
    const mul = dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => mul * (key === "date" ? a.date.localeCompare(b.date) : a.amount - b.amount));
  }, [transactions, kind, query, category, status, deductibility, from, to, sort]);

  const sums = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of filtered) {
      if (t.kind === "income") inc += t.amount;
      else exp += t.amount;
    }
    return { inc, exp };
  }, [filtered]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      setImportResult({ rows: [], errors: [{ line: 0, message: "Dosya 2 MB sınırını aşıyor" }], fileName: file.name });
      return;
    }
    const text = await file.text();
    setImportResult({ ...importTransactionsCsv(text), fileName: file.name });
  }

  const hasFilters = kind !== "all" || query || category || status || deductibility || from || to;

  return (
    <>
      <PageHeader
        title="Gelir / Gider"
        description="Tüm tutarlar KDV hariç gösterilir."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} aria-label="CSV dosyası seç" tabIndex={-1} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-4 w-4" aria-hidden /> İçe aktar
            </Button>
            <Button variant="secondary" onClick={() => downloadText(`solofin-islemler-${today}.csv`, exportTransactionsCsv(filtered))}>
              <Download className="h-4 w-4" aria-hidden /> CSV
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Ekle
            </Button>
          </>
        }
      />
      <DemoNotice what="Listelenen işlemler" />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Segmented
            label="İşlem türü filtresi"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Tümü" },
              { value: "income", label: "Gelirler" },
              { value: "expense", label: "Giderler" },
            ]}
          />
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input aria-label="İşlemlerde ara" placeholder="Açıklama, müşteri, belge no…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownUp aria-hidden className="h-4 w-4 text-subtle" />
            <Select aria-label="Sıralama" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-44">
              <option value="date-desc">En yeni</option>
              <option value="date-asc">En eski</option>
              <option value="amount-desc">Tutar (yüksek)</option>
              <option value="amount-asc">Tutar (düşük)</option>
            </Select>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Select aria-label="Kategori filtresi" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select aria-label="Durum filtresi" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tüm durumlar</option>
            {TX_STATUS.map((s) => (
              <option key={s} value={s}>
                {TX_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select aria-label="Vergisel durum filtresi" value={deductibility} onChange={(e) => setDeductibility(e.target.value)}>
            <option value="">Vergisel durum: tümü</option>
            {DEDUCTIBILITY.map((d) => (
              <option key={d} value={d}>
                {DEDUCTIBILITY_LABEL[d]}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label="Başlangıç tarihi" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="Bitiş tarihi" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted" aria-live="polite">
            {filtered.length} kayıt · Gelir <span className="tnum font-medium text-positive">{formatMoney(sums.inc)}</span> · Gider{" "}
            <span className="tnum font-medium text-fg">{formatMoney(sums.exp)}</span>
          </p>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setKind("all");
                setQuery("");
                setCategory("");
                setStatus("");
                setDeductibility("");
                setFrom("");
                setTo("");
              }}
            >
              Filtreleri temizle
            </Button>
          )}
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title={transactions.length === 0 ? "Henüz işlem yok" : "Filtreye uyan işlem yok"}
            description={transactions.length === 0 ? "İlk gelir veya giderini ekle ya da CSV ile içe aktar." : undefined}
            action={transactions.length === 0 ? <Button onClick={() => setCreating(true)}>İşlem ekle</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-border" data-testid="tx-list">
            {filtered.slice(0, limit).map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className={clsx("hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold sm:grid", t.kind === "income" ? "bg-positive/10 text-positive" : "bg-surface-2 text-muted")}>
                  {t.category.slice(0, 2).toLocaleUpperCase("tr")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.description || t.category}</p>
                  <p className="truncate text-xs text-subtle">
                    {[t.counterparty, t.category, formatDate(t.date), t.documentRef].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.status !== "paid" && <Badge tone={t.status === "overdue" ? "negative" : "warning"}>{TX_STATUS_LABEL[t.status]}</Badge>}
                    {t.kind === "expense" && t.deductibility !== "assumed_deductible" && (
                      <Badge tone={t.deductibility === "confirmed_deductible" ? "positive" : "neutral"}>{DEDUCTIBILITY_LABEL[t.deductibility]}</Badge>
                    )}
                    {t.withholdingRate > 0 && <Badge>Stopaj %{Math.round(t.withholdingRate * 100)}</Badge>}
                    {t.recurringId && <Badge tone="primary">Tekrarlayan</Badge>}
                  </div>
                </div>
                <p className={clsx("tnum shrink-0 text-sm font-semibold", t.kind === "income" ? "text-positive" : "text-fg")}>
                  {t.kind === "income" ? "+" : "−"}
                  {formatMoney(t.amount, t.currency, { cents: t.amount % 100 !== 0 })}
                </p>
                <div className="flex shrink-0">
                  <button className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label={`${t.description || t.category} düzenle`} onClick={() => setEditing(t)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="rounded-md p-2 text-muted hover:bg-negative/10 hover:text-negative" aria-label={`${t.description || t.category} sil`} onClick={() => setDeleting(t)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {filtered.length > limit && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted">
            <span>
              {limit} / {filtered.length} kayıt gösteriliyor
            </span>
            <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + 40)}>
              Daha fazla göster
            </Button>
          </div>
        )}
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Yeni işlem" wide>
        <TransactionForm
          today={today}
          onCancel={() => setCreating(false)}
          onSubmit={(input: TransactionInput) => {
            store.addTransaction(input);
            setCreating(false);
            flash("İşlem eklendi");
          }}
        />
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="İşlemi düzenle" wide>
        {editing && (
          <TransactionForm
            key={editing.id}
            initial={editing}
            today={today}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => {
              store.updateTransaction(editing.id, input);
              setEditing(null);
              flash("İşlem güncellendi");
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="İşlemi sil"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) store.deleteTransaction(deleting.id);
                setDeleting(null);
                flash("İşlem silindi");
              }}
            >
              Sil
            </Button>
          </>
        }
      >
        {deleting && (
          <p className="text-sm text-muted">
            <strong className="text-fg">{deleting.description || deleting.category}</strong> ({formatMoney(deleting.amount)}, {formatDate(deleting.date)}) kalıcı olarak silinecek.
          </p>
        )}
      </Dialog>

      <Dialog
        open={!!importResult}
        onClose={() => setImportResult(null)}
        title="CSV içe aktarma"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportResult(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={!importResult?.rows.length}
              onClick={() => {
                if (!importResult) return;
                const n = store.importTransactions(importResult.rows);
                setImportResult(null);
                flash(`${n} işlem içe aktarıldı`);
              }}
            >
              {importResult?.rows.length ?? 0} geçerli satırı içe aktar
            </Button>
          </>
        }
      >
        {importResult && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              <strong className="text-fg">{importResult.fileName}</strong>: {importResult.rows.length} geçerli, {importResult.errors.length} hatalı satır.
            </p>
            {importResult.errors.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
                {importResult.errors.map((e, i) => (
                  <li key={i}>
                    {e.line > 0 ? `Satır ${e.line}: ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-subtle">
              Beklenen sütunlar: {CSV_COLUMNS.join(", ")}. Zorunlu: tarih (YYYY-AA-GG), tur (gelir/gider), kategori, tutar. Hatalı satırlar içe aktarılmaz.
            </p>
          </div>
        )}
      </Dialog>

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-fg px-4 py-2 text-sm text-bg shadow-pop lg:bottom-8">
          {toast}
        </div>
      )}
    </>
  );
}
