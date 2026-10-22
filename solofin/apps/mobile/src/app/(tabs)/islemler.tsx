import { router } from "expo-router";
import { Download, FileUp, Plus, Search, SlidersHorizontal } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEDUCTIBILITY, DEDUCTIBILITY_LABEL, TX_STATUS, TX_STATUS_LABEL, type Transaction, type TransactionInput } from "@solofin/core/data/schema";
import { exportTransactionsCsv, importTransactionsCsv } from "@solofin/core/finance/csv";
import { addDays, addMonths, formatDate } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";
import { TxRow } from "@/components/TxRow";
import { Badge, Button, Card, EmptyState, Segmented, Sheet, T } from "@/components/ui";
import { GradientCard, MeterBar } from "@/components/visuals";
import { pickTextFile, shareTextFile } from "@/lib/share";
import { useStore } from "@/store/StoreProvider";
import { gradients, radius, space, type, useTheme } from "@/theme";

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

  const inSum = filtered.reduce((s, t) => s + (t.kind === "income" ? t.amount : 0), 0);
  const outSum = filtered.reduce((s, t) => s + (t.kind === "expense" ? t.amount : 0), 0);
  const total = inSum - outSum;

  // Tarihe göre gruplanmış satırlar (yalnızca tarih sıralamasında)
  type Item = { kind: "header"; key: string; label: string; sum: number } | { kind: "tx"; key: string; t: Transaction; first: boolean; last: boolean };
  const items: Item[] = useMemo(() => {
    const rows = filtered.slice(0, limit);
    if (!sort.startsWith("date")) return rows.map((t, i) => ({ kind: "tx" as const, key: t.id, t, first: i === 0, last: i === rows.length - 1 }));
    const out: Item[] = [];
    let i = 0;
    while (i < rows.length) {
      const d = rows[i].date;
      const group = [] as Transaction[];
      while (i < rows.length && rows[i].date === d) group.push(rows[i++]);
      const label = d === today ? "Bugün" : d === addDays(today, -1) ? "Dün" : formatDate(d, { year: d.slice(0, 4) !== today.slice(0, 4) });
      out.push({ kind: "header", key: `h-${d}`, label, sum: group.reduce((s, t) => s + (t.kind === "income" ? t.amount : -t.amount), 0) });
      group.forEach((t, j) => out.push({ kind: "tx", key: t.id, t, first: j === 0, last: j === group.length - 1 }));
    }
    return out;
  }, [filtered, limit, sort, today]);
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
      <GradientCard colors={kind === "income" ? gradients.positive : gradients.hero}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[type.caption, { color: "rgba(255,255,255,0.8)", letterSpacing: 0.6 }]}>
            {PERIODS.find((x) => x.value === period)?.label.toLocaleUpperCase("tr")} · {filtered.length} KAYIT
          </Text>
          {mode === "demo" ? <Badge label="Demo" tone="warning" /> : null}
        </View>
        <Text style={[type.hero, { color: "#FFFFFF", marginTop: 4, fontVariant: ["tabular-nums"] }]}>
          {kind === "all" ? formatMoney(total, "TRY", { signed: true }) : formatMoney(kind === "income" ? inSum : outSum)}
        </Text>
        {kind === "all" ? (
          <View style={{ gap: 8, marginTop: space.sm }}>
            <MeterBar value={inSum + outSum > 0 ? inSum / (inSum + outSum) : 0} color="#34D399" track="rgba(255,255,255,0.18)" />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[type.caption, { color: "#FFFFFF" }]}>Giriş {formatMoney(inSum)}</Text>
              <Text style={[type.caption, { color: "#FFFFFF" }]}>Çıkış {formatMoney(outSum)}</Text>
            </View>
          </View>
        ) : null}
      </GradientCard>
      <Segmented label="Dönem" value={period} onChange={setPeriod} options={PERIODS} />
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
        data={items}
        keyExtractor={(it) => it.key}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.lg + insets.top, paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          item.kind === "header" ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: space.lg, paddingBottom: space.sm, paddingHorizontal: 4 }}>
              <T v="small" color="muted" style={{ fontWeight: "700" }}>
                {item.label}
              </T>
              <T v="small" color={item.sum >= 0 ? "positive" : "muted"} tnum style={{ fontWeight: "700" }}>
                {formatMoney(item.sum, "TRY", { signed: true })}
              </T>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: p.surface,
                paddingHorizontal: space.md,
                borderTopLeftRadius: item.first ? radius.xl : 0,
                borderTopRightRadius: item.first ? radius.xl : 0,
                borderBottomLeftRadius: item.last ? radius.xl : 0,
                borderBottomRightRadius: item.last ? radius.xl : 0,
                borderBottomWidth: item.last ? 0 : 1,
                borderBottomColor: p.border,
              }}
            >
              <TxRow t={item.t} showDate={!sort.startsWith("date")} />
            </View>
          )
        }
        ListEmptyComponent={
          <Card>
            <EmptyState
              title={transactions.length === 0 ? "Henüz işlem yok" : "Bu filtreye uyan işlem yok"}
              description={transactions.length === 0 ? "Ortadaki + butonuyla ilk gelir veya giderini ekle ya da CSV ile içe aktar." : "Dönemi veya filtreleri değiştir."}
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
