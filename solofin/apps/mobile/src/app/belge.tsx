import { router, Stack, useLocalSearchParams } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, View } from "react-native";
import { defaultDeductibility, EXPENSE_CATEGORIES, isoDate } from "@solofin/core/data/schema";
import { fromKurus, parseMoneyInput } from "@solofin/core/finance/money";
import { Button, Card, Field, Notice, Screen, SelectField, Sheet, T, ToggleRow } from "@/components/ui";
import { deleteStoredFile, persistImage } from "@/lib/share";
import { useStore } from "@/store/StoreProvider";
import { radius, space, useTheme } from "@/theme";

const toText = (k: number) => (k ? fromKurus(k).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "");

export default function DocumentScreen() {
  const p = useTheme();
  const params = useLocalSearchParams<{ id?: string; uri?: string; name?: string }>();
  const store = useStore();
  const existing = params.id ? store.documents.find((d) => d.id === params.id) : undefined;
  const uri = existing?.uri ?? params.uri ?? "";

  const [date, setDate] = useState(existing?.date ?? store.today);
  const [vendor, setVendor] = useState(existing?.vendor ?? "");
  const [documentNo, setDocumentNo] = useState(existing?.documentNo ?? "");
  const [amount, setAmount] = useState(toText(existing?.amount ?? 0));
  const [vat, setVat] = useState(toText(existing?.vatAmount ?? 0));
  const [category, setCategory] = useState(existing?.category ?? "");
  const [asExpense, setAsExpense] = useState(existing ? false : true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const linked = existing?.transactionId ? store.transactions.find((t) => t.id === existing.transactionId) : undefined;

  if (!uri) {
    return (
      <Screen>
        <Notice tone="negative">Belge bulunamadı.</Notice>
        <Button label="Geri dön" onPress={() => router.back()} />
      </Screen>
    );
  }

  async function save() {
    const errs: Record<string, string> = {};
    const amt = parseMoneyInput(amount || "0");
    const vatK = parseMoneyInput(vat || "0");
    if (!isoDate.safeParse(date.trim()).success) errs.date = "Tarih YYYY-AA-GG biçiminde olmalı";
    if (amt === null || amt < 0) errs.amount = "Geçerli bir tutar gir";
    if (vatK === null || vatK < 0) errs.vat = "Geçerli bir KDV tutarı gir";
    if (asExpense && (!amt || amt <= 0)) errs.amount = "Gider eklemek için tutar sıfırdan büyük olmalı";
    if (asExpense && !category) errs.category = "Gider için kategori seç";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const fields = { date: date.trim(), vendor: vendor.trim(), documentNo: documentNo.trim(), amount: amt ?? 0, vatAmount: vatK ?? 0, category };
      let transactionId = existing?.transactionId;
      if (asExpense && !linked) {
        const vatRate = amt ? Math.round(((vatK ?? 0) / amt) * 100) / 100 : 0;
        const tx = store.addTransaction({
          kind: "expense",
          date: fields.date,
          amount: fields.amount,
          currency: "TRY",
          vatRate: [0, 0.01, 0.1, 0.2].reduce((best, r) => (Math.abs(r - vatRate) < Math.abs(best - vatRate) ? r : best), 0.2),
          category,
          counterparty: fields.vendor,
          description: fields.vendor ? `${fields.vendor} faturası` : "Fatura",
          status: "paid",
          documentRef: fields.documentNo || undefined,
          withholdingRate: 0,
          deductibility: defaultDeductibility(category),
        });
        transactionId = tx.id;
      }
      if (existing) {
        store.updateDocument(existing.id, { ...fields, transactionId });
      } else {
        const fileName = (params.name ?? "fatura.jpg").replace(/[^\w.\-]/g, "_");
        const stored = await persistImage(uri, `${Date.now()}-${fileName}`);
        store.addDocument({ ...fields, uri: stored, fileName, extraction: "manual", transactionId });
      }
      router.back();
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : "Kaydedilemedi" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: existing ? "Belge" : "Fatura Tara" }} />
      <Screen testID="screen-doc">
        <View style={{ borderRadius: radius.lg, overflow: "hidden", backgroundColor: p.surface2, borderWidth: 1, borderColor: p.border }}>
          <Image source={{ uri }} style={{ width: "100%", height: 260 }} resizeMode="contain" accessibilityLabel="Fatura görüntüsü" />
        </View>
        <Notice tone="primary">Otomatik okuma (OCR) henüz etkin değil. Görüntüye bakarak alanları doldur ve kontrol et.</Notice>

        <Card style={{ gap: space.md }}>
          <T v="h2">Fatura bilgileri</T>
          <Field label="Tarih" value={date} onChangeText={setDate} placeholder="YYYY-AA-GG" error={errors.date} autoCapitalize="none" />
          <Field label="Satıcı" value={vendor} onChangeText={setVendor} maxLength={120} testID="doc-vendor" />
          <Field label="Fatura no" value={documentNo} onChangeText={setDocumentNo} maxLength={60} />
          <Field label="Tutar (KDV hariç)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={errors.amount} testID="doc-amount" />
          <Field label="KDV tutarı" value={vat} onChangeText={setVat} keyboardType="decimal-pad" error={errors.vat} />
          <SelectField label="Kategori" value={category} options={EXPENSE_CATEGORIES.map((c) => ({ value: c as string, label: c }))} onChange={setCategory} error={errors.category} />
        </Card>

        <Card>
          {linked ? (
            <T v="small" color="muted">
              Bu belge bir gider kaydına bağlı: {linked.description || linked.category}.
            </T>
          ) : (
            <ToggleRow label="Gider olarak ekle" description="Tutar ve kategoriyle bir gider kaydı oluşturur" value={asExpense} onChange={setAsExpense} testID="doc-as-expense" />
          )}
        </Card>

        {errors.form ? <Notice tone="negative">{errors.form}</Notice> : null}
        <Button label={busy ? "Kaydediliyor…" : "Kaydet"} onPress={save} disabled={busy} testID="doc-save" />
        {existing ? <Button label="Belgeyi sil" icon={Trash2} variant="danger" onPress={() => setConfirmDelete(true)} /> : null}

        <Sheet
          visible={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Belgeyi sil"
          footer={
            <>
              <Button
                label="Belgeyi sil"
                variant="danger"
                onPress={() => {
                  if (existing) {
                    store.deleteDocument(existing.id);
                    deleteStoredFile(existing.uri);
                  }
                  setConfirmDelete(false);
                  router.back();
                }}
              />
              <Button label="Vazgeç" variant="secondary" onPress={() => setConfirmDelete(false)} />
            </>
          }
        >
          <T color="muted">Belge ve görüntüsü silinecek. Bağlı gider kaydı varsa korunur; istersen Gelir/Gider ekranından ayrıca silebilirsin.</T>
        </Sheet>
      </Screen>
    </KeyboardAvoidingView>
  );
}
