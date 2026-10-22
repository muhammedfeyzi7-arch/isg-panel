import { Plus, Repeat } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, RECURRENCE, type RecurringItem } from "@solofin/core/data/schema";
import { dailyBalance, monthlyCashProjection, upcomingEvents } from "@solofin/core/finance/cashflow";
import { addDays, formatDate, monthLabel } from "@solofin/core/finance/dates";
import { formatMoney, fromKurus, parseMoneyInput } from "@solofin/core/finance/money";
import { LineChart } from "@/components/charts";
import { Badge, Bullet, Button, Card, Disclosure, Field, ListItem, Row, Screen, SectionHeader, Segmented, SelectField, Sheet, T, ToggleRow } from "@/components/ui";
import { useStore } from "@/store/StoreProvider";
import { useOverview } from "@/store/useOverview";
import { font, gradients, space, type, useTheme } from "@/theme";
import { AnimatedNumber, Appear, GradientCard, ProgressRing, Sparkline } from "@/components/visuals";

const RECURRENCE_LABEL: Record<(typeof RECURRENCE)[number], string> = { none: "Tek sefer", monthly: "Aylık", quarterly: "3 aylık", yearly: "Yıllık" };

function Stat({ label, value, foot, color }: { label: string; value: string; foot?: string; color?: string }) {
  return (
    <Card style={{ flex: 1, padding: space.md, gap: 2 }}>
      <T v="caption" color="muted" numberOfLines={1}>
        {label}
      </T>
      <T v="bodyStrong" tnum style={{ fontSize: 17, color }} numberOfLines={1}>
        {value}
      </T>
      {foot ? (
        <T v="caption" color="subtle" numberOfLines={1}>
          {foot}
        </T>
      ) : null}
    </Card>
  );
}

export default function CashflowScreen() {
  const p = useTheme();
  const store = useStore();
  const { transactions, recurring, settings, today } = store;
  const { rules, projection, safe, resilience } = useOverview();
  const [delay, setDelay] = useState<"0" | "15" | "30" | "60">("0");
  const [editing, setEditing] = useState<RecurringItem | "new" | null>(null);

  const events = useMemo(() => upcomingEvents(transactions, recurring, settings, rules, today, addDays(today, 90), { collectionDelayDays: Number(delay) }), [transactions, recurring, settings, rules, today, delay]);
  const daily = useMemo(() => dailyBalance(settings.cashBalance, events, today, 90), [settings.cashBalance, events, today]);
  const minPoint = daily.reduce((a, b) => (b.balance < a.balance ? b : a), daily[0]);
  const monthly = useMemo(() => monthlyCashProjection(projection, events, settings, today), [projection, events, settings, today]);

  return (
    <Screen testID="screen-cashflow">
      <Appear index={0}>
        <GradientCard colors={gradients.hero}>
          <Text style={[type.caption, { color: "rgba(255,255,255,0.8)", letterSpacing: 0.6 }]}>90 GÜNDE EN DÜŞÜK BAKİYE</Text>
          <AnimatedNumber value={minPoint.balance} format={(v) => formatMoney(v)} style={[type.hero, { color: "#FFF", marginTop: 4 }]} />
          <Text style={[type.small, { color: "rgba(255,255,255,0.8)" }]}>{formatDate(minPoint.date)} civarında · bugün {formatMoney(settings.cashBalance)}</Text>
          <View style={{ marginTop: space.md, alignItems: "flex-end" }}>
            <Sparkline values={daily.map((d) => d.balance)} width={250} height={56} />
          </View>
        </GradientCard>
      </Appear>
      <Appear index={1} style={{ flexDirection: "row", gap: space.sm }}>
        <Card style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <ProgressRing value={Math.min(1, resilience.emergencyCoverage)} size={80} stroke={9} color={resilience.emergencyCoverage < 1 ? p.warning : p.positive} accessibilityLabel={`Acil durum fonu hedefin yüzde ${Math.round(resilience.emergencyCoverage * 100)}`}>
            <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: p.text }}>%{Math.min(999, Math.round(resilience.emergencyCoverage * 100))}</Text>
          </ProgressRing>
          <T v="caption" color="muted" style={{ textAlign: "center" }}>
            Acil durum fonu ({settings.emergencyMonths} ay hedef)
          </T>
        </Card>
        <View style={{ flex: 1, gap: space.sm }}>
          <Stat label="Vergi rezervi" value={formatMoney(safe.taxReserve.total)} />
          <Stat label="Gelirsiz dayanma" value={resilience.rows.at(-1)?.months == null ? "süresiz" : `${resilience.rows.at(-1)!.months!.toLocaleString("tr-TR")} ay`} />
        </View>
      </Appear>

      <SectionHeader title="90 günlük bakiye" subtitle="Tahsilat gecikmesini değiştirerek etkisini gör" />
      <Card style={{ gap: space.md }}>
        <Segmented
          label="Tahsilat gecikmesi"
          value={delay}
          onChange={setDelay}
          options={[
            { value: "0", label: "Zamanında" },
            { value: "15", label: "+15 g" },
            { value: "30", label: "+30 g" },
            { value: "60", label: "+60 g" },
          ]}
        />
        <LineChart area accessibilityLabel="90 günlük beklenen bakiye" labels={daily.map((d) => formatDate(d.date, { year: false }))} series={[{ name: "Beklenen bakiye" }]} values={[daily.map((d) => d.balance)]} height={190} maxXLabels={4} />
        <T v="caption" color="subtle">
          Bekleyen kayıtlar, tekrarlayan kalemler, KDV ve geçici vergi tahminleri dahil. Gecikmiş alacakların 14 gün içinde tahsil edileceği varsayıldı; değişken proje gelirleri dahil değil.
        </T>
      </Card>

      <SectionHeader title="Finansal dayanma süresi" subtitle="Vergi rezervi hariç nakdinle" />
      <Card>
        {resilience.rows.map((r) => (
          <Row
            key={r.drop}
            label={r.drop === 0 ? "Gelir düşmezse" : r.drop === 1 ? "Gelir tamamen kesilirse" : `Gelir %${Math.round(r.drop * 100)} düşerse`}
            hint={r.monthlyGap > 0 ? `Aylık açık ${formatMoney(r.monthlyGap)}` : `Aylık fazla ${formatMoney(-r.monthlyGap)}`}
            value={r.months === null ? "süresiz" : `${r.months.toLocaleString("tr-TR")} ay`}
            tone={r.months !== null && r.months < 3 ? "negative" : r.months !== null && r.months < 6 ? "warning" : undefined}
          />
        ))}
        <Disclosure>
          <Bullet>Kullanılabilir nakit: {formatMoney(resilience.available)}</Bullet>
          <Bullet>Aylık çıkış (iş gideri + kişisel): {formatMoney(resilience.monthlyOutflow)}</Bullet>
          <Bullet>Aylık net giriş (vergi sonrası ortalama): {formatMoney(resilience.monthlyInflow)}</Bullet>
          {resilience.assumptions.map((a) => (
            <Bullet key={a}>{a}</Bullet>
          ))}
        </Disclosure>
      </Card>

      <SectionHeader title="Yıl sonuna kadar" subtitle="Ay sonu tahmini bakiye" />
      <Card>
        {monthly.map((m) => (
          <Row key={m.month} label={monthLabel(m.month, true)} hint={`Giriş ${formatMoney(m.inflow)} · çıkış ${formatMoney(m.outflow)}`} value={formatMoney(m.balance)} tone={m.balance < 0 ? "negative" : undefined} />
        ))}
      </Card>

      <SectionHeader title="Beklenen hareketler" subtitle="90 gün" />
      <Card style={{ paddingVertical: space.xs }}>
        {events.length === 0 ? (
          <T v="small" color="muted" style={{ paddingVertical: space.md }}>
            Beklenen hareket yok.
          </T>
        ) : (
          events.slice(0, 25).map((e, i) => (
            <ListItem
              key={`${e.date}-${i}`}
              title={e.label}
              subtitle={`${formatDate(e.date)} · ${e.source === "pending" ? "bekleyen kayıt" : e.source === "recurring" ? "tekrarlayan" : "tahmin"}`}
              right={`${e.amount > 0 ? "+" : "−"}${formatMoney(Math.abs(e.amount))}`}
            />
          ))
        )}
      </Card>

      <SectionHeader title="Tekrarlayan kalemler" action={<Button label="Ekle" icon={Plus} small onPress={() => setEditing("new")} />} />
      <Card style={{ paddingVertical: space.xs }}>
        {recurring.length === 0 ? (
          <T v="small" color="muted" style={{ paddingVertical: space.md }}>
            Kira, abonelik veya sabit müşteri ödemesi ekleyebilirsin.
          </T>
        ) : (
          recurring.map((r) => (
            <ListItem
              key={r.id}
              icon={Repeat}
              iconTone={r.kind === "income" ? "positive" : "neutral"}
              title={r.label}
              subtitle={`${RECURRENCE_LABEL[r.recurrence]} · ayın ${r.dayOfMonth}. günü${r.active ? "" : " · pasif"}`}
              right={`${r.kind === "income" ? "+" : "−"}${formatMoney(r.amount)}`}
              onPress={() => setEditing(r)}
            />
          ))
        )}
      </Card>

      <RecurringSheet
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        item={editing}
        today={today}
        onClose={() => setEditing(null)}
        onSave={(i) => {
          store.upsertRecurring(i);
          setEditing(null);
        }}
        onDelete={(id) => {
          store.deleteRecurring(id);
          setEditing(null);
        }}
      />
    </Screen>
  );
}

function RecurringSheet({
  item,
  today,
  onClose,
  onSave,
  onDelete,
}: {
  item: RecurringItem | "new" | null;
  today: string;
  onClose: () => void;
  onSave: (i: Omit<RecurringItem, "userId" | "id"> & { id?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const initial = item && item !== "new" ? item : undefined;
  const [kind, setKind] = useState<RecurringItem["kind"]>(initial?.kind ?? "expense");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [amount, setAmount] = useState(initial ? String(fromKurus(initial.amount)) : "");
  const [recurrence, setRecurrence] = useState<RecurringItem["recurrence"]>(initial?.recurrence ?? "monthly");
  const [day, setDay] = useState(String(initial?.dayOfMonth ?? 1));
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const cats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function save() {
    const amt = parseMoneyInput(amount);
    const d = Number(day);
    if (!label.trim()) return setError("Ad gerekli");
    if (!category) return setError("Kategori seç");
    if (amt === null || amt <= 0) return setError("Geçerli bir tutar gir");
    if (!Number.isInteger(d) || d < 1 || d > 28) return setError("Gün 1–28 arasında olmalı");
    onSave({ id: initial?.id, kind, label: label.trim(), category, amount: amt, recurrence, dayOfMonth: d, startDate: initial?.startDate ?? today, endDate: initial?.endDate, active });
  }

  return (
    <Sheet
      visible={item !== null}
      onClose={onClose}
      title={initial ? "Tekrarlayan kalemi düzenle" : "Tekrarlayan kalem ekle"}
      footer={
        <>
          <Button label="Kaydet" onPress={save} />
          {initial ? <Button label="Sil" variant="danger" onPress={() => onDelete(initial.id)} /> : null}
        </>
      }
    >
      <View style={{ gap: space.md }}>
        <Segmented
          label="Tür"
          value={kind}
          onChange={(v) => {
            setKind(v);
            setCategory("");
          }}
          options={[
            { value: "expense", label: "Gider" },
            { value: "income", label: "Gelir" },
          ]}
        />
        <Field label="Ad" value={label} onChangeText={setLabel} maxLength={80} />
        <Field label="Tutar (KDV hariç)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <SelectField label="Kategori" value={category} options={cats.map((c) => ({ value: c as string, label: c }))} onChange={setCategory} />
        <Segmented label="Sıklık" value={recurrence} onChange={setRecurrence} options={RECURRENCE.filter((r) => r !== "none").map((r) => ({ value: r, label: RECURRENCE_LABEL[r] }))} />
        <Field label="Ayın günü (1–28)" value={day} onChangeText={setDay} keyboardType="number-pad" />
        <ToggleRow label="Aktif" value={active} onChange={setActive} />
        {error ? <Badge label={error} tone="negative" /> : null}
      </View>
    </Sheet>
  );
}
