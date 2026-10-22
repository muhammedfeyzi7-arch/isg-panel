"use client";

import clsx from "clsx";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DemoNotice, PageHeader } from "@/components/layout/AppShell";
import { MoneyBarChart, MoneyLineChart } from "@/components/charts/Charts";
import { Badge, Button, Card, CardHeader, Dialog, Explain, Field, Input, Row, Segmented, Select } from "@/components/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, RECURRENCE, type RecurringItem } from "@/lib/data/schema";
import { useStore } from "@/lib/data/store";
import { useFinance } from "@/lib/data/useFinance";
import { dailyBalance, monthlyCashProjection, upcomingEvents } from "@/lib/finance/cashflow";
import { addDays, formatDate, monthLabel } from "@/lib/finance/dates";
import { formatMoney, fromKurus, parseMoneyInput } from "@/lib/finance/money";

const RECURRENCE_LABEL: Record<(typeof RECURRENCE)[number], string> = { none: "Tek sefer", monthly: "Aylık", quarterly: "3 aylık", yearly: "Yıllık" };

export default function CashflowPage() {
  const store = useStore();
  const { transactions, recurring, settings, today } = store;
  const { rules, projection, safe, resilience } = useFinance();
  const [delay, setDelay] = useState<"0" | "15" | "30" | "60">("0");
  const [editing, setEditing] = useState<RecurringItem | "new" | null>(null);

  const events = useMemo(
    () => upcomingEvents(transactions, recurring, settings, rules, today, addDays(today, 90), { collectionDelayDays: Number(delay) }),
    [transactions, recurring, settings, rules, today, delay],
  );
  const daily = useMemo(() => dailyBalance(settings.cashBalance, events, today, 90), [settings.cashBalance, events, today]);
  const minPoint = daily.reduce((a, b) => (b.balance < a.balance ? b : a), daily[0]);
  const monthly = useMemo(() => monthlyCashProjection(projection, events, settings, today), [projection, events, settings, today]);

  return (
    <>
      <PageHeader title="Nakit akışı ve dayanıklılık" description="Önümüzdeki 90 gün ve yıl sonuna kadar beklenen nakit durumu." />
      <DemoNotice />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Banka bakiyesi" value={formatMoney(settings.cashBalance)} />
        <Stat label="Vergi rezervi" value={formatMoney(safe.taxReserve.total)} />
        <Stat label="90 günde en düşük bakiye" value={formatMoney(minPoint.balance)} foot={formatDate(minPoint.date)} tone={minPoint.balance < safe.taxReserve.total ? "negative" : undefined} />
        <Stat
          label="Acil durum fonu"
          value={`%${Math.min(999, Math.round(resilience.emergencyCoverage * 100))}`}
          foot={`Hedef ${settings.emergencyMonths} ay · ${formatMoney(resilience.emergencyTarget)}`}
          tone={resilience.emergencyCoverage < 1 ? "warning" : "positive"}
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="90 günlük bakiye"
          subtitle="Bekleyen tahsilat/ödemeler, tekrarlayan kalemler, KDV ve geçici vergi tahminleri"
          action={
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
          }
        />
        <div className="px-2 pb-4 pt-3 sm:px-4">
          <MoneyLineChart
            area
            ariaLabel="90 günlük beklenen bakiye"
            data={daily.map((d) => ({ date: d.date, balance: d.balance }))}
            xKey="date"
            xFormatter={(d) => formatDate(d, { year: false })}
            series={[{ key: "balance", name: "Beklenen bakiye" }]}
            height={260}
          />
          <p className="px-2 text-xs text-subtle">
            Gecikmiş alacakların bugünden 14 gün sonra tahsil edileceği varsayıldı{delay !== "0" && `; tüm tahsilatlara ek ${delay} gün gecikme uygulandı`}. Değişken proje gelirleri bu grafiğe dahil değildir.
          </p>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Finansal dayanma süresi</h2>
          <p className="mt-0.5 text-sm text-muted">Gelirin düşerse, vergi rezervi hariç nakdinle kaç ay idare edebilirsin?</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="pb-2 font-medium">Gelir düşüşü</th>
                <th scope="col" className="pb-2 text-right font-medium">Aylık açık</th>
                <th scope="col" className="pb-2 text-right font-medium">Dayanma süresi</th>
              </tr>
            </thead>
            <tbody className="tnum divide-y divide-border">
              {resilience.rows.map((r) => (
                <tr key={r.drop}>
                  <th scope="row" className="py-2.5 text-left font-normal">
                    {r.drop === 0 ? "Düşüş yok" : r.drop === 1 ? "Gelir tamamen kesilirse" : `%${Math.round(r.drop * 100)} düşüş`}
                  </th>
                  <td className="py-2.5 text-right">{r.monthlyGap > 0 ? formatMoney(r.monthlyGap) : <span className="text-positive">fazla {formatMoney(-r.monthlyGap)}</span>}</td>
                  <td className={clsx("py-2.5 text-right font-semibold", r.months !== null && r.months < 6 && "text-warning", r.months !== null && r.months < 3 && "text-negative")}>
                    {r.months === null ? "süresiz" : `${r.months.toLocaleString("tr-TR")} ay`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3">
            <Row label="Kullanılabilir nakit (bakiye − vergi rezervi)" value={formatMoney(resilience.available)} />
            <Row label="Aylık çıkış (iş gideri + kişisel)" value={formatMoney(resilience.monthlyOutflow)} />
            <Row label="Aylık net giriş (vergi sonrası ortalama)" value={formatMoney(resilience.monthlyInflow)} />
          </div>
          <Explain className="mt-3">
            {resilience.assumptions.map((a) => (
              <p key={a}>• {a}</p>
            ))}
          </Explain>
        </Card>

        <Card>
          <CardHeader title="Yıl sonuna kadar aylık projeksiyon" subtitle="Ortalama gelir/gider ve bilinen kalemlerin büyüğü" />
          <div className="px-2 pb-2 pt-3 sm:px-4">
            <MoneyBarChart
              ariaLabel="Yıl sonuna kadar aylık giriş ve çıkışlar"
              data={monthly.map((m) => ({ month: m.month, inflow: m.inflow, outflow: m.outflow }))}
              xKey="month"
              xFormatter={(m) => monthLabel(m)}
              series={[
                { key: "inflow", name: "Giriş" },
                { key: "outflow", name: "Çıkış" },
              ]}
              height={200}
            />
          </div>
          <div className="px-5 pb-5">
            {monthly.map((m) => (
              <Row key={m.month} label={`${monthLabel(m.month, true)} sonu tahmini bakiye`} value={formatMoney(m.balance)} tone={m.balance < 0 ? "negative" : undefined} />
            ))}
            <p className="mt-2 text-xs text-subtle">Vergi ödemeleri ve kişisel harcamalar dahildir. Yıllık gelir vergisi beyanı (Mart) yıl sonrasına düşer.</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Beklenen hareketler" subtitle="90 gün" />
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto px-5 pb-3">
            {events.length === 0 && <li className="py-6 text-center text-sm text-muted">Beklenen hareket yok.</li>}
            {events.map((e, i) => (
              <li key={`${e.date}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.label}</p>
                  <p className="text-xs text-subtle">
                    {formatDate(e.date)} · {e.source === "pending" ? "bekleyen kayıt" : e.source === "recurring" ? "tekrarlayan" : "tahmin"}
                  </p>
                </div>
                <span className={clsx("tnum shrink-0 text-sm font-semibold", e.amount > 0 ? "text-positive" : "text-fg")}>
                  {e.amount > 0 ? "+" : "−"}
                  {formatMoney(Math.abs(e.amount))}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Tekrarlayan kalemler"
            subtitle="Kira, abonelik, sabit müşteri ödemeleri"
            action={
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" aria-hidden /> Ekle
              </Button>
            }
          />
          <ul className="divide-y divide-border px-5 pb-3">
            {recurring.length === 0 && <li className="py-6 text-center text-sm text-muted">Tekrarlayan kalem yok.</li>}
            {recurring.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.label} {!r.active && <Badge>Pasif</Badge>}
                  </p>
                  <p className="text-xs text-subtle">
                    {RECURRENCE_LABEL[r.recurrence]} · ayın {r.dayOfMonth}. günü · {r.category}
                  </p>
                </div>
                <span className={clsx("tnum shrink-0 text-sm font-semibold", r.kind === "income" ? "text-positive" : "text-fg")}>
                  {r.kind === "income" ? "+" : "−"}
                  {formatMoney(r.amount)}
                </span>
                <div className="flex shrink-0">
                  <button className="rounded-md p-2 text-muted hover:bg-surface-2" aria-label={`${r.label} düzenle`} onClick={() => setEditing(r)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="rounded-md p-2 text-muted hover:bg-negative/10 hover:text-negative" aria-label={`${r.label} sil`} onClick={() => store.deleteRecurring(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Tekrarlayan kalem ekle" : "Tekrarlayan kalemi düzenle"}>
        {editing !== null && (
          <RecurringForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            today={today}
            onCancel={() => setEditing(null)}
            onSave={(item) => {
              store.upsertRecurring(item);
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </>
  );
}

function Stat({ label, value, foot, tone }: { label: string; value: string; foot?: string; tone?: "positive" | "negative" | "warning" }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p className={clsx("tnum mt-1.5 text-lg font-semibold tracking-tight sm:text-2xl", tone === "positive" && "text-positive", tone === "negative" && "text-negative", tone === "warning" && "text-warning")}>{value}</p>
      {foot && <p className="mt-1 text-xs text-subtle">{foot}</p>}
    </Card>
  );
}

function RecurringForm({ initial, today, onSave, onCancel }: { initial?: RecurringItem; today: string; onSave: (i: Omit<RecurringItem, "userId" | "id"> & { id?: string }) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<RecurringItem["kind"]>(initial?.kind ?? "expense");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [amount, setAmount] = useState(initial ? String(fromKurus(initial.amount)) : "");
  const [recurrence, setRecurrence] = useState<RecurringItem["recurrence"]>(initial?.recurrence ?? "monthly");
  const [day, setDay] = useState(String(initial?.dayOfMonth ?? 1));
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const cats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const amt = parseMoneyInput(amount);
        const d = Number(day);
        if (!label.trim()) return setError("Ad gerekli");
        if (!category) return setError("Kategori seç");
        if (amt === null || amt <= 0) return setError("Geçerli bir tutar gir");
        if (!Number.isInteger(d) || d < 1 || d > 28) return setError("Gün 1–28 arasında olmalı");
        onSave({ id: initial?.id, kind, label: label.trim(), category, amount: amt, recurrence, dayOfMonth: d, startDate: initial?.startDate ?? today, endDate: initial?.endDate, active });
      }}
    >
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
      <Field label="Ad" htmlFor="rec-label">
        <Input id="rec-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tutar (KDV hariç)" htmlFor="rec-amount">
          <Input id="rec-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Kategori" htmlFor="rec-cat">
          <Select id="rec-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Seç…</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sıklık" htmlFor="rec-freq">
          <Select id="rec-freq" value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurringItem["recurrence"])}>
            {RECURRENCE.filter((r) => r !== "none").map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ayın günü" htmlFor="rec-day">
          <Input id="rec-day" type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--primary))]" /> Aktif
      </label>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button type="submit">Kaydet</Button>
      </div>
    </form>
  );
}
