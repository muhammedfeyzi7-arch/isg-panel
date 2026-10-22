import { router } from "expo-router";
import { Download, FileUp, Plus, Search, SlidersHorizontal } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEDUCTIBILITY, DEDUCTIBILITY_LABEL, TX_STATUS, TX_STATUS_LABEL, type TransactionInput } from "@solofin/core/data/schema";
import { exportTransactionsCsv, importTransactionsCsv } from "@solofin/core/finance/csv";
import { addMonths, formatDate } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";
import { Badge, Button, Card, EmptyState, ListItem, Segmented, Sheet, T } from "@/components/ui";
import { signedTx } from "@/lib/format";
import { categoryIcon } from "@/lib/icons";
import { pickTextFile, shareTextFile } from "@/lib/share";
import { useStore } from "@/store/StoreProvider";
import { radius, space, type, useTheme } from "@/theme";

type Kind = "all" | "income" | "expense";
type Period = "month" | "3m" | "year" | "all";
type Sort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "Bu ay" },
  { value: "3m", label: "Son 3 ay" },
  { value: "year", label: "Bu yıl" },
  { value: "all", label: "Tümü" },
];

export default function TransactionsScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { transactions, today, mode } = store;

  const [kind, setKind] = useState<Kind>("expense");
  const [period, setPeriod] = useState<Period>("month");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [deductibility, setDeductibility] = useState("");
  const [sort, setSort] = useState<Sort>("date-desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importState, setImportState] = useState<{ name: string; rows: TransactionInput[]; errors: { line: number; message: string }[] } | null>(null);
  const [limit, setLimit] = useState(40);

  const from = period === "month" ? `${today.slice(0, 7)}-01` : period === "3m" ? addMonths(`${today.slice(0, 7)}-01`, -2) : period === "year" ? `${today.slice(0, 4)}-01-01` : "0000-01-01";
  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort((a, b) => a.localeCompare(b, "tr")), [transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const rows = transactions.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (t.date < from) return false;
      if (category && t.category !== category) return false;
      if (status && t.status !== status) return false;
      if (deductibility && (t.kind !== "expense" || t.deductibility !== deductibility)) return false;
      if (q && !`${t.description} ${t.counterparty} ${t.category} ${t.documentRef ?? ""}`.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
    const [key, dir] = sort.split("-") as ["date" | "amount", "asc" | "desc"];
    const mul = dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => mul * (key === "date" ? a.date.localeCompare(b.date) : a.amount - b.amount));
  }, [transactions, kind, from, query, category, status, deductibility, sort]);

  const total = filtered.reduce((s, t) => s + (t.kind === "income" ? t.amount : -t.amount), 0);
  const activeFilters = [category, status, deductibility].filter(Boolean).length;

  async function onImport() {
    try {
      const file = await pickTextFile();
      if (!file) return;
      const res = importTransactionsCsv(file.text);
      setImportState({ name: file.name, rows: res.rows, errors: res.errors });
    } catch (e) {
      Alert.alert("İçe aktarılamadı", e instanceof Error ? e.message : "Dosya okunamadı");
    }
  }

  async function onExport() {
    try {
      await shareTextFile(`solofin-islemler-${today}.csv`, exportTransactionsCsv(filtered));
    } catch (e) {
      Alert.alert("Dışa aktarılamadı", e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  }

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T v="title" accessibilityRole="header">
          Gelir / Gider
        </T>
        <Button label="Ekle" icon={Plus} small onPress={() => router.push({ pathname: "/islem", params: { kind: kind === "income" ? "income" : "expense" } })} testID="add-tx" />
      </View>
      <Segmented
        label="İşlem türü"
        value={kind}
        onChange={(v) => {
          setKind(v);
          setLimit(40);
        }}
        options={[
          { value: "income", label: "Gelirler" },
          { value: "expense", label: "Giderler" },
          { value: "all", label: "Tümü" },
        ]}
      />
      <Card style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T v="small" color="muted">
            {PERIODS.find((x) => x.value === period)?.label} · {filtered.length} kayıt
          </T>
          {mode === "demo" ? <Badge label="Demo" tone="warning" /> : null}
        </View>
        <T v="value" tnum color={kind === "income" ? "positive" : "text"}>
          {kind === "all" ? formatMoney(total, "TRY", { signed: true }) : formatMoney(Math.abs(total))}
        </T>
        <Segmented label="Dönem" value={period} onChange={setPeriod} options={PERIODS} />
      </Card>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: space.md, backgroundColor: p.surface, minHeight: 44 }}>
          <Search size={16} color={p.subtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Açıklama, müşteri, belge no…"
            placeholderTextColor={p.subtle}
            accessibilityLabel="İşlemlerde ara"
            style={[type.body, { flex: 1, color: p.text, paddingVertical: 8 }]}
          />
        </View>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Filtre ve sıralama${activeFilters ? `, ${activeFilters} filtre etkin` : ""}`}
          style={{ width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: activeFilters ? p.primary : p.border, backgroundColor: activeFilters ? p.primarySoft : p.surface, alignItems: "center", justifyContent: "center" }}
        >
          <SlidersHorizontal size={18} color={activeFilters ? p.primary : p.muted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button label="CSV içe aktar" icon={FileUp} variant="secondary" small onPress={onImport} style={{ flex: 1 }} />
        <Button label="CSV dışa aktar" icon={Download} variant="secondary" small onPress={onExport} style={{ flex: 1 }} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <FlatList
        testID="tx-list"
        data={filtered.slice(0, limit)}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.lg + insets.top, paddingBottom: space.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: t, index }) => (
          <View style={{ backgroundColor: p.surface, paddingHorizontal: space.md, borderTopLeftRadius: index === 0 ? radius.lg : 0, borderTopRightRadius: index === 0 ? radius.lg : 0, borderBottomLeftRadius: index === Math.min(limit, filtered.length) - 1 ? radius.lg : 0, borderBottomRightRadius: index === Math.min(limit, filtered.length) - 1 ? radius.lg : 0 }}>
            <ListItem
              icon={categoryIcon(t.category)}
              iconTone={t.kind === "income" ? "positive" : "primary"}
              title={t.description || t.category}
              subtitle={`${t.category}${t.counterparty ? ` · ${t.counterparty}` : ""}`}
              right={signedTx(t)}
              rightSub={
                t.status !== "paid" ? (
                  <Badge label={TX_STATUS_LABEL[t.status]} tone={t.status === "overdue" ? "negative" : "warning"} />
                ) : (
                  formatDate(t.date)
                )
              }
              onPress={() => router.push({ pathname: "/islem", params: { id: t.id } })}
              accessibilityLabel={`${t.description || t.category}, ${signedTx(t)}, ${formatDate(t.date)}. Düzenlemek için dokun`}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: p.border, marginLeft: 68 }} />}
        ListEmptyComponent={
          <Card>
            <EmptyState
              title={transactions.length === 0 ? "Henüz işlem yok" : "Bu filtreye uyan işlem yok"}
              description={transactions.length === 0 ? "İlk gelir veya giderini ekle ya da CSV ile içe aktar." : "Dönemi veya filtreleri değiştir."}
            />
          </Card>
        }
        ListFooterComponent={
          filtered.length > limit ? (
            <Button label={`Daha fazla göster (${filtered.length - limit})`} variant="secondary" onPress={() => setLimit((l) => l + 40)} style={{ marginTop: space.md }} />
          ) : undefined
        }
      />

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtre ve sıralama"
        footer={
          <Button
            label="Filtreleri temizle"
            variant="secondary"
            onPress={() => {
              setCategory("");
              setStatus("");
              setDeductibility("");
              setSort("date-desc");
            }}
          />
        }
      >
        <FilterGroup title="Sıralama" value={sort} onChange={(v) => setSort(v as Sort)} options={[{ value: "date-desc", label: "En yeni" }, { value: "date-asc", label: "En eski" }, { value: "amount-desc", label: "Tutar (yüksek)" }, { value: "amount-asc", label: "Tutar (düşük)" }]} />
        <FilterGroup title="Durum" value={status} onChange={setStatus} options={[{ value: "", label: "Tümü" }, ...TX_STATUS.map((s) => ({ value: s, label: TX_STATUS_LABEL[s] }))]} />
        <FilterGroup title="Vergisel durum" value={deductibility} onChange={setDeductibility} options={[{ value: "", label: "Tümü" }, ...DEDUCTIBILITY.map((d) => ({ value: d, label: DEDUCTIBILITY_LABEL[d] }))]} />
        <FilterGroup title="Kategori" value={category} onChange={setCategory} options={[{ value: "", label: "Tümü" }, ...categories.map((c) => ({ value: c, label: c }))]} />
      </Sheet>

      <Sheet
        visible={!!importState}
        onClose={() => setImportState(null)}
        title="CSV içe aktarma"
        footer={
          <Button
            label={`${importState?.rows.length ?? 0} geçerli satırı içe aktar`}
            disabled={!importState?.rows.length}
            onPress={() => {
              if (!importState) return;
              const n = store.importTransactions(importState.rows);
              setImportState(null);
              Alert.alert("Tamamlandı", `${n} işlem içe aktarıldı`);
            }}
          />
        }
      >
        {importState ? (
          <View style={{ gap: space.sm }}>
            <T>
              {importState.name}: {importState.rows.length} geçerli, {importState.errors.length} hatalı satır
            </T>
            {importState.errors.slice(0, 30).map((e, i) => (
              <T key={i} v="small" color="negative">
                {e.line > 0 ? `Satır ${e.line}: ` : ""}
                {e.message}
              </T>
            ))}
            <T v="caption" color="subtle">
              Zorunlu sütunlar: tarih (YYYY-AA-GG), tur (gelir/gider), kategori, tutar. Hatalı satırlar içe aktarılmaz.
            </T>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function FilterGroup({ title, value, options, onChange }: { title: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const p = useTheme();
  return (
    <View style={{ gap: space.sm, marginBottom: space.md }}>
      <T v="small" color="muted" style={{ fontWeight: "600" }}>
        {title}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value || "all"}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={{ paddingHorizontal: space.md, minHeight: 36, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: active ? p.primary : p.border, backgroundColor: active ? p.primarySoft : p.surface }}
            >
              <T v="small" color={active ? "primary" : "text"}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
