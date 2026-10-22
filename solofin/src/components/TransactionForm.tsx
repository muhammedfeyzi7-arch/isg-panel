"use client";

import { useId, useState } from "react";
import { Button, Field, Input, Segmented, Select } from "@/components/ui";
import {
  DEDUCTIBILITY,
  DEDUCTIBILITY_LABEL,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TX_STATUS,
  TX_STATUS_LABEL,
  transactionInputSchema,
  type Deductibility,
  type Transaction,
  type TransactionInput,
} from "@/lib/data/schema";
import { CURRENCIES, fromKurus, parseMoneyInput } from "@/lib/finance/money";

/** Kategoriye göre VARSAYILAN vergisel sınıflandırma — kesin hüküm değildir, kullanıcı değiştirebilir. */
export function defaultDeductibility(category: string): Deductibility {
  if (category === "Kişisel") return "non_deductible";
  if (category === "Eğitim" || category === "Diğer Gider") return "unknown";
  return "assumed_deductible";
}

interface Props {
  initial?: Transaction;
  today: string;
  onSubmit: (input: TransactionInput) => void;
  onCancel: () => void;
}

export function TransactionForm({ initial, today, onSubmit, onCancel }: Props) {
  const uid = useId();
  const [kind, setKind] = useState<TransactionInput["kind"]>(initial?.kind ?? "expense");
  const [date, setDate] = useState(initial?.date ?? today);
  const [amount, setAmount] = useState(initial ? fromKurus(initial.amount).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "");
  const [currency, setCurrency] = useState<TransactionInput["currency"]>(initial?.currency ?? "TRY");
  const [vatRate, setVatRate] = useState(String(initial?.vatRate ?? 0.2));
  const [category, setCategory] = useState(initial?.category ?? "");
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<TransactionInput["status"]>(initial?.status ?? "paid");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [documentRef, setDocumentRef] = useState(initial?.documentRef ?? "");
  const [withholdingRate, setWithholdingRate] = useState(String(initial?.withholdingRate ?? 0));
  const [deductibility, setDeductibility] = useState<Deductibility>(initial?.deductibility ?? "unknown");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseMoneyInput(amount);
    const errs: Record<string, string> = {};
    if (amt === null || amt <= 0) errs.amount = "Geçerli ve sıfırdan büyük bir tutar gir (ör. 12.500,00)";
    const candidate = {
      kind,
      date,
      dueDate: status !== "paid" && dueDate ? dueDate : undefined,
      amount: amt ?? 0,
      currency,
      vatRate: Number(vatRate),
      category,
      counterparty: counterparty.trim(),
      description: description.trim(),
      status,
      documentRef: documentRef.trim() || undefined,
      withholdingRate: kind === "income" ? Number(withholdingRate) : 0,
      deductibility: kind === "income" ? "unknown" : deductibility,
      recurringId: initial?.recurringId,
    };
    const parsed = transactionInputSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const iss of parsed.error.issues) {
        const k = String(iss.path[0]);
        if (!errs[k]) errs[k] = iss.message;
      }
    }
    if (!category) errs.category = "Kategori seç";
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) return;
    onSubmit(parsed.data);
  }

  const f = (name: string) => `${uid}-${name}`;
  const err = (name: string) => ({ "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? `${f(name)}-error` : undefined });

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label={initial ? "İşlemi düzenle" : "Yeni işlem"}>
      <Segmented
        label="İşlem türü"
        value={kind}
        onChange={(v) => {
          setKind(v);
          setCategory("");
          if (v === "income") setDeductibility("unknown");
        }}
        options={[
          { value: "expense", label: "Gider" },
          { value: "income", label: "Gelir" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tutar (KDV hariç)" htmlFor={f("amount")} error={errors.amount}>
          <Input id={f("amount")} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} {...err("amount")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="KDV" htmlFor={f("vat")}>
            <Select id={f("vat")} value={vatRate} onChange={(e) => setVatRate(e.target.value)}>
              <option value="0.2">%20</option>
              <option value="0.1">%10</option>
              <option value="0.01">%1</option>
              <option value="0">%0 / istisna</option>
            </Select>
          </Field>
          <Field label="Para birimi" htmlFor={f("cur")}>
            <Select id={f("cur")} value={currency} onChange={(e) => setCurrency(e.target.value as TransactionInput["currency"])}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="İşlem tarihi" htmlFor={f("date")} error={errors.date}>
          <Input id={f("date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} {...err("date")} />
        </Field>
        <Field label="Kategori" htmlFor={f("category")} error={errors.category}>
          <Select
            id={f("category")}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (kind === "expense" && !initial) setDeductibility(defaultDeductibility(e.target.value));
            }}
            {...err("category")}
          >
            <option value="">Seç…</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
            {category && !(categories as readonly string[]).includes(category) && <option>{category}</option>}
          </Select>
        </Field>
        <Field label={kind === "income" ? "Müşteri" : "Tedarikçi"} htmlFor={f("cp")} error={errors.counterparty}>
          <Input id={f("cp")} value={counterparty} maxLength={120} onChange={(e) => setCounterparty(e.target.value)} />
        </Field>
        <Field label="Açıklama" htmlFor={f("desc")} error={errors.description}>
          <Input id={f("desc")} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Ödeme durumu" htmlFor={f("status")}>
          <Select id={f("status")} value={status} onChange={(e) => setStatus(e.target.value as TransactionInput["status"])}>
            {TX_STATUS.map((s) => (
              <option key={s} value={s}>
                {TX_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        {status !== "paid" && (
          <Field label="Vade tarihi" htmlFor={f("due")} error={errors.dueDate}>
            <Input id={f("due")} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        )}
        <Field label="Belge referansı" htmlFor={f("doc")} hint="Fatura / SMM numarası">
          <Input id={f("doc")} value={documentRef} maxLength={120} onChange={(e) => setDocumentRef(e.target.value)} />
        </Field>
        {kind === "income" ? (
          <Field label="Kaynakta kesilen stopaj" htmlFor={f("wh")} hint="Kurumsal müşteriye kesilen serbest meslek makbuzunda genellikle %20">
            <Select id={f("wh")} value={withholdingRate} onChange={(e) => setWithholdingRate(e.target.value)}>
              <option value="0">Yok</option>
              <option value="0.2">%20</option>
              <option value="0.1">%10</option>
            </Select>
          </Field>
        ) : (
          <Field label="Vergisel sınıflandırma" htmlFor={f("ded")} hint="Kategori varsayılanıdır; kesin değildir. Mali müşavirinle doğrula.">
            <Select id={f("ded")} value={deductibility} onChange={(e) => setDeductibility(e.target.value as Deductibility)}>
              {DEDUCTIBILITY.map((d) => (
                <option key={d} value={d}>
                  {DEDUCTIBILITY_LABEL[d]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button type="submit">{initial ? "Kaydet" : "Ekle"}</Button>
      </div>
    </form>
  );
}
