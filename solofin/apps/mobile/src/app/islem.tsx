import { router, Stack, useLocalSearchParams } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import {
  DEDUCTIBILITY,
  DEDUCTIBILITY_LABEL,
  defaultDeductibility,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TX_STATUS,
  TX_STATUS_LABEL,
  transactionInputSchema,
  type Deductibility,
  type TransactionInput,
} from "@solofin/core/data/schema";
import { addDays } from "@solofin/core/finance/dates";
import { CURRENCIES, fromKurus, parseMoneyInput } from "@solofin/core/finance/money";
import { Button, Card, Field, Notice, Screen, Segmented, SelectField, Sheet, T } from "@/components/ui";
import { useStore } from "@/store/StoreProvider";
import { space } from "@/theme";

export default function TransactionFormScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const store = useStore();
  const { today } = store;
  const initial = params.id ? store.transactions.find((t) => t.id === params.id) : undefined;

  const [kind, setKind] = useState<TransactionInput["kind"]>(initial?.kind ?? (params.kind === "income" ? "income" : "expense"));
  const [date, setDate] = useState(initial?.date ?? today);
  const [amount, setAmount] = useState(initial ? fromKurus(initial.amount).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "");
  const [currency, setCurrency] = useState<TransactionInput["currency"]>(initial?.currency ?? "TRY");
  const [vatRate, setVatRate] = useState(String(initial?.vatRate ?? 0.2));
  const [category, setCategory] = useState(initial?.category ?? "");
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<TransactionInput["status"]>(initial?.status ?? "paid");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [documentRef, setDocumentRef] = useState(initial?.documentRef ?? "");
  const [withholding, setWithholding] = useState(String(initial?.withholdingRate ?? 0));
  const [deductibility, setDeductibility] = useState<Deductibility>(initial?.deductibility ?? "unknown");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (params.id && !initial) {
    return (
      <Screen>
        <Notice tone="negative">Kayıt bulunamadı. Silinmiş veya başka bir veri modunda olabilir.</Notice>
        <Button label="Geri dön" onPress={() => router.back()} />
      </Screen>
    );
  }

  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function save() {
    const amt = parseMoneyInput(amount);
    const errs: Record<string, string> = {};
    if (amt === null || amt <= 0) errs.amount = "Geçerli ve sıfırdan büyük bir tutar gir (ör. 12.500,00)";
    if (!category) errs.category = "Kategori seç";
    const candidate = {
      kind,
      date: date.trim(),
      dueDate: status !== "paid" && dueDate.trim() ? dueDate.trim() : undefined,
      amount: amt ?? 0,
      currency,
      vatRate: Number(vatRate),
      category,
      counterparty: counterparty.trim(),
      description: description.trim(),
      status,
      documentRef: documentRef.trim() || undefined,
      withholdingRate: kind === "income" ? Number(withholding) : 0,
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
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) return;
    if (initial) store.updateTransaction(initial.id, parsed.data);
    else store.addTransaction(parsed.data);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: initial ? "İşlemi düzenle" : "Yeni işlem" }} />
      <Screen testID="tx-form">
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
        <Card style={{ gap: space.md }}>
          <Field label="Tutar (KDV hariç)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" error={errors.amount} testID="tx-amount" />
          <View style={{ gap: 6 }}>
            <T v="small" style={{ fontWeight: "600" }}>
              KDV oranı
            </T>
            <Segmented label="KDV oranı" value={vatRate} onChange={setVatRate} options={[{ value: "0.2", label: "%20" }, { value: "0.1", label: "%10" }, { value: "0.01", label: "%1" }, { value: "0", label: "%0" }]} />
          </View>
          <SelectField
            label="Kategori"
            value={category}
            error={errors.category}
            options={categories.map((c) => ({ value: c as string, label: c }))}
            onChange={(c) => {
              setCategory(c);
              if (kind === "expense" && !initial) setDeductibility(defaultDeductibility(c));
            }}
          />
          <View style={{ gap: 6 }}>
            <Field label="İşlem tarihi" value={date} onChangeText={setDate} placeholder="YYYY-AA-GG" error={errors.date} autoCapitalize="none" />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button label="Bugün" small variant="secondary" onPress={() => setDate(today)} />
              <Button label="Dün" small variant="secondary" onPress={() => setDate(addDays(today, -1))} />
            </View>
          </View>
        </Card>

        <Card style={{ gap: space.md }}>
          <Field label={kind === "income" ? "Müşteri" : "Tedarikçi"} value={counterparty} onChangeText={setCounterparty} maxLength={120} />
          <Field label="Açıklama" value={description} onChangeText={setDescription} maxLength={200} testID="tx-description" />
          <View style={{ gap: 6 }}>
            <T v="small" style={{ fontWeight: "600" }}>
              Ödeme durumu
            </T>
            <Segmented label="Ödeme durumu" value={status} onChange={setStatus} options={TX_STATUS.map((s) => ({ value: s, label: TX_STATUS_LABEL[s] }))} />
          </View>
          {status !== "paid" ? <Field label="Vade tarihi" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-AA-GG" error={errors.dueDate} autoCapitalize="none" /> : null}
          <Field label="Belge referansı" value={documentRef} onChangeText={setDocumentRef} maxLength={120} hint="Fatura / serbest meslek makbuzu numarası" />
          <SelectField label="Para birimi" value={currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={setCurrency} />
        </Card>

        <Card style={{ gap: space.md }}>
          {kind === "income" ? (
            <View style={{ gap: 6 }}>
              <T v="small" style={{ fontWeight: "600" }}>
                Kaynakta kesilen stopaj
              </T>
              <Segmented label="Stopaj" value={withholding} onChange={setWithholding} options={[{ value: "0", label: "Yok" }, { value: "0.2", label: "%20" }, { value: "0.1", label: "%10" }]} />
              <T v="caption" color="subtle">
                Kurumsal müşteriye kesilen serbest meslek makbuzunda genellikle %20.
              </T>
            </View>
          ) : (
            <SelectField
              label="Vergisel sınıflandırma"
              value={deductibility}
              options={DEDUCTIBILITY.map((d) => ({ value: d, label: DEDUCTIBILITY_LABEL[d] }))}
              onChange={setDeductibility}
              hint="Kategori varsayılanıdır; kesin değildir. Mali müşavirinle doğrula."
            />
          )}
        </Card>

        <Button label={initial ? "Kaydet" : "Ekle"} onPress={save} testID="tx-save" />
        {initial ? <Button label="İşlemi sil" icon={Trash2} variant="danger" onPress={() => setConfirmDelete(true)} /> : null}

        <Sheet
          visible={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="İşlemi sil"
          footer={
            <>
              <Button
                label="Kalıcı olarak sil"
                variant="danger"
                onPress={() => {
                  if (initial) store.deleteTransaction(initial.id);
                  setConfirmDelete(false);
                  router.back();
                }}
              />
              <Button label="Vazgeç" variant="secondary" onPress={() => setConfirmDelete(false)} />
            </>
          }
        >
          <T color="muted">Bu işlem kalıcı olarak silinecek. Bu geri alınamaz.</T>
        </Sheet>
      </Screen>
    </KeyboardAvoidingView>
  );
}
