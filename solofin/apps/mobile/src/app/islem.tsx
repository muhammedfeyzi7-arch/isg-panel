import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronDown, ChevronUp, Delete, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { Button, Card, Field, Notice, Segmented, SelectField, Sheet, T } from "@/components/ui";
import { IconTile, PressableScale, tap } from "@/components/visuals";
import { categoryIcon, categoryTile } from "@/lib/icons";
import { useStore } from "@/store/StoreProvider";
import { font, radius, space, type, useTheme } from "@/theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"] as const;

/** Tuş takımı girişini "12.500,75" biçimine uygular (en fazla 2 kuruş hanesi). */
function applyKey(current: string, key: string): string {
  const raw = current.replace(/\./g, "");
  if (key === "⌫") return formatTyped(raw.slice(0, -1));
  if (key === ",") return raw.includes(",") ? current : formatTyped((raw || "0") + ",");
  const [, dec] = raw.split(",");
  if (dec !== undefined && dec.length >= 2) return current;
  if (raw === "0" && key === "0") return current;
  const next = raw === "0" ? key : raw + key;
  if (next.replace(",", "").length > 11) return current;
  return formatTyped(next);
}

function formatTyped(raw: string): string {
  if (!raw) return "";
  const [int, dec] = raw.split(",");
  const grouped = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec !== undefined ? `${grouped},${dec}` : grouped;
}

export default function TransactionFormScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
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
  const [more, setMore] = useState(!!initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (params.id && !initial) {
    return (
      <View style={{ flex: 1, padding: space.lg, gap: space.md, backgroundColor: p.bg }}>
        <Notice tone="negative">Kayıt bulunamadı. Silinmiş veya başka bir veri modunda olabilir.</Notice>
        <Button label="Geri dön" onPress={() => router.back()} />
      </View>
    );
  }

  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const accent = kind === "income" ? p.positive : p.text;

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
      if (errs.date || errs.dueDate) setMore(true);
    }
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) {
      tap("medium");
      return;
    }
    tap("success");
    if (initial) store.updateTransaction(initial.id, parsed.data);
    else store.addTransaction(parsed.data);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: initial ? "İşlemi düzenle" : kind === "income" ? "Yeni gelir" : "Yeni gider" }} />
      <ScrollView testID="tx-form" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
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

        {/* Büyük tutar göstergesi */}
        <View style={{ alignItems: "center", gap: 4, paddingVertical: space.sm }}>
          <T v="caption" color="subtle">
            TUTAR (KDV HARİÇ)
          </T>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Text style={[type.display, { color: amount ? accent : p.subtle, fontSize: 44 }]}>{kind === "income" ? "+₺" : "₺"}</Text>
            <TextInput
              testID="tx-amount"
              accessibilityLabel="Tutar (KDV hariç)"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={p.subtle}
              keyboardType="decimal-pad"
              showSoftInputOnFocus={false}
              style={[type.display, { fontSize: 44, color: accent, minWidth: 40, textAlign: "center", padding: 0 }]}
            />
          </View>
          {errors.amount ? (
            <T v="caption" color="negative">
              {errors.amount}
            </T>
          ) : null}
        </View>

        {/* Uygulama içi tuş takımı */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }} accessibilityLabel="Tutar tuş takımı">
          {KEYS.map((k) => (
            <PressableScale
              key={k}
              haptic="select"
              scaleTo={0.92}
              accessibilityLabel={k === "⌫" ? "Sil" : k === "," ? "Virgül" : k}
              onPress={() => setAmount((a) => applyKey(a, k))}
              style={{ width: "31.5%", flexGrow: 1, height: 54, borderRadius: radius.lg, backgroundColor: p.surface, alignItems: "center", justifyContent: "center", borderWidth: p.dark ? 1 : 0, borderColor: p.border }}
            >
              {k === "⌫" ? <Delete size={22} color={p.text} /> : <Text style={{ fontFamily: font.bold, fontSize: 22, color: p.text }}>{k}</Text>}
            </PressableScale>
          ))}
        </View>

        {/* Kategori ızgarası */}
        <View style={{ gap: space.sm }}>
          <T v="h2">Kategori</T>
          {errors.category ? (
            <T v="caption" color="negative">
              {errors.category}
            </T>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Kategori">
            {categories.map((c) => {
              const active = c === category;
              return (
                <PressableScale
                  key={c}
                  accessibilityRole="radio"
                  accessibilityLabel={`Kategori ${c}`}
                  haptic="select"
                  onPress={() => {
                    setCategory(c);
                    if (kind === "expense" && !initial) setDeductibility(defaultDeductibility(c));
                  }}
                  style={{
                    width: "31.5%",
                    flexGrow: 1,
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: space.md,
                    paddingHorizontal: 4,
                    borderRadius: radius.lg,
                    backgroundColor: active ? p.primarySoft : p.surface,
                    borderWidth: 2,
                    borderColor: active ? p.primary : "transparent",
                  }}
                >
                  <IconTile icon={categoryIcon(c)} color={categoryTile(c)} size={40} />
                  <Text numberOfLines={2} style={{ fontFamily: active ? font.bold : font.semibold, fontSize: 11.5, color: active ? p.primary : p.text, textAlign: "center" }}>
                    {c}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <Card style={{ gap: space.md }}>
          <Field label="Açıklama" value={description} onChangeText={setDescription} maxLength={200} testID="tx-description" placeholder="ör. Logo tasarımı" />
          <Field label={kind === "income" ? "Müşteri" : "Tedarikçi"} value={counterparty} onChangeText={setCounterparty} maxLength={120} />
          <View style={{ gap: 6 }}>
            <T v="small" style={{ fontWeight: "600" }}>
              Tarih
            </T>
            <Segmented
              label="Tarih"
              value={date === today ? "today" : date === addDays(today, -1) ? "yesterday" : "other"}
              onChange={(v) => {
                if (v === "today") setDate(today);
                else if (v === "yesterday") setDate(addDays(today, -1));
                else setMore(true);
              }}
              options={[
                { value: "today", label: "Bugün" },
                { value: "yesterday", label: "Dün" },
                { value: "other", label: date !== today && date !== addDays(today, -1) ? date : "Başka" },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <T v="small" style={{ fontWeight: "600" }}>
              Ödeme durumu
            </T>
            <Segmented label="Ödeme durumu" value={status} onChange={setStatus} options={TX_STATUS.map((s) => ({ value: s, label: TX_STATUS_LABEL[s] }))} />
          </View>
          <View style={{ gap: 6 }}>
            <T v="small" style={{ fontWeight: "600" }}>
              KDV oranı
            </T>
            <Segmented label="KDV oranı" value={vatRate} onChange={setVatRate} options={[{ value: "0.2", label: "%20" }, { value: "0.1", label: "%10" }, { value: "0.01", label: "%1" }, { value: "0", label: "%0" }]} />
          </View>
        </Card>

        <PressableScale onPress={() => setMore((m) => !m)} haptic="select" accessibilityLabel={more ? "Ek ayrıntıları gizle" : "Ek ayrıntıları göster"} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 }}>
          <T v="small" color="primary" style={{ fontWeight: "700" }}>
            {more ? "Daha az ayrıntı" : "Daha fazla ayrıntı (vergi, belge, vade)"}
          </T>
          {more ? <ChevronUp size={16} color={p.primary} /> : <ChevronDown size={16} color={p.primary} />}
        </PressableScale>

        {more ? (
          <Card style={{ gap: space.md }}>
            <Field label="İşlem tarihi" value={date} onChangeText={setDate} placeholder="YYYY-AA-GG" error={errors.date} autoCapitalize="none" />
            {status !== "paid" ? <Field label="Vade tarihi" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-AA-GG" error={errors.dueDate} autoCapitalize="none" /> : null}
            <Field label="Belge referansı" value={documentRef} onChangeText={setDocumentRef} maxLength={120} hint="Fatura / serbest meslek makbuzu numarası" />
            <SelectField label="Para birimi" value={currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={setCurrency} />
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
        ) : null}

        {initial ? <Button label="İşlemi sil" icon={Trash2} variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
      </ScrollView>

      {/* Sabit kaydet çubuğu */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: Math.max(insets.bottom, space.lg), backgroundColor: p.bg }}>
        <Button label={initial ? "Değişiklikleri kaydet" : kind === "income" ? "Geliri kaydet" : "Gideri kaydet"} onPress={save} testID="tx-save" />
      </View>

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
    </KeyboardAvoidingView>
  );
}
