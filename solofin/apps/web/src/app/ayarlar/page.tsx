"use client";

import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, Button, Card, Dialog, Field, Input, Segmented, Select, Switch } from "@/components/ui";
import { settingsSchema, TAXPAYER_LABEL, TAXPAYER_TYPES, type Settings } from "@solofin/core/data/schema";
import { useStore, type DataMode } from "@/lib/data/store";
import { downloadText } from "@/lib/download";
import { exportTransactionsCsv } from "@solofin/core/finance/csv";
import { CURRENCIES, fromKurus, parseMoneyInput } from "@solofin/core/finance/money";
import { RULE_SETS } from "@solofin/core/finance/tax/rules";
import { aiStatus, authStatus } from "@/lib/integrations";

const moneyFields = [
  { key: "cashBalance", label: "Güncel banka bakiyesi", hint: "Tüm iş ve kişisel hesaplarının toplamı. Banka bağlantısı yok; elle güncellenir." },
  { key: "monthlyPersonalSpend", label: "Aylık kişisel yaşam gideri", hint: "Dayanıklılık ve senaryo hesapları için" },
  { key: "safetyBuffer", label: "Güvenlik payı", hint: "Kullanılabilir tutardan her zaman ayrılır" },
  { key: "provisionalTaxPaid", label: "Bu yıl ödenen geçici vergi", hint: "Vergi rezervinden mahsup edilir" },
] as const;

export default function SettingsPage() {
  const store = useStore();
  const [draft, setDraft] = useState<Settings>(store.settings);
  const [money, setMoney] = useState<Record<string, string>>(() =>
    Object.fromEntries(moneyFields.map((f) => [f.key, fromKurus(store.settings[f.key]).toLocaleString("tr-TR", { maximumFractionDigits: 2 })])),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loadedFor, setLoadedFor] = useState(store.mode);

  // Mod değişince taslağı yeniden yükle
  if (loadedFor !== store.mode) {
    setLoadedFor(store.mode);
    setDraft(store.settings);
    setMoney(Object.fromEntries(moneyFields.map((f) => [f.key, fromKurus(store.settings[f.key]).toLocaleString("tr-TR", { maximumFractionDigits: 2 })])));
  }

  function save() {
    const errs: string[] = [];
    const next: Settings = { ...draft };
    for (const f of moneyFields) {
      const v = parseMoneyInput(money[f.key] || "0");
      if (v === null || (f.key !== "cashBalance" && v < 0)) errs.push(`${f.label}: geçerli bir tutar gir`);
      else next[f.key] = v;
    }
    const parsed = settingsSchema.safeParse(next);
    if (!parsed.success) errs.push(...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    setErrors(errs);
    if (errs.length || !parsed.success) return;
    store.saveSettings(parsed.data);
    setDraft(parsed.data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const auth = authStatus();
  const ai = aiStatus();

  return (
    <>
      <PageHeader title="Ayarlar" description="Veri modu, finansal varsayımlar, vergi profili ve görünüm." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Veri modu</h2>
          <p className="mt-1 text-sm text-muted">Demo verisi ve kendi verin ayrı saklanır; birbirine karışmaz.</p>
          <Segmented
            className="mt-4"
            label="Veri modu"
            value={store.mode}
            onChange={(m: DataMode) => store.setMode(m)}
            options={[
              { value: "demo", label: "Demo verisi" },
              { value: "local", label: "Kendi verim" },
            ]}
          />
          <p className="mt-3 text-sm text-muted">
            {store.mode === "demo"
              ? "Kurgusal bir serbest çalışan profili. Yaptığın değişiklikler yalnızca demo alanında kalır."
              : "Verilerin yalnızca bu tarayıcının yerel depolamasında tutulur. Başka cihazla eşitlenmez."}
          </p>
          {store.mode === "demo" && (
            <Button variant="secondary" className="mt-3" onClick={store.resetDemo}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Demo verisini sıfırla
            </Button>
          )}
          <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted">Kimlik doğrulama</span>
              <Badge tone={auth.configured ? "primary" : "neutral"}>{auth.label}</Badge>
            </p>
            <p className="text-xs text-subtle">{auth.detail}</p>
            <p className="flex items-center justify-between gap-2 pt-2">
              <span className="text-muted">Yapay zekâ katmanı</span>
              <Badge tone={ai.configured ? "primary" : "neutral"}>{ai.label}</Badge>
            </p>
            <p className="text-xs text-subtle">{ai.detail}</p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Finansal durum</h2>
          <div className="mt-4 space-y-4">
            {moneyFields.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`set-${f.key}`} hint={f.hint}>
                <Input id={`set-${f.key}`} inputMode="decimal" className="tnum" value={money[f.key]} onChange={(e) => setMoney((m) => ({ ...m, [f.key]: e.target.value }))} />
              </Field>
            ))}
            <Field label="Acil durum fonu hedefi (ay)" htmlFor="set-em">
              <Input id="set-em" type="number" min={0} max={24} value={draft.emergencyMonths} onChange={(e) => setDraft({ ...draft, emergencyMonths: Number(e.target.value) })} />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Vergi profili</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Vergi ülkesi" htmlFor="set-country" hint="Şimdilik yalnızca Türkiye">
              <Select id="set-country" value="TR" disabled>
                <option value="TR">Türkiye</option>
              </Select>
            </Field>
            <Field label="Vergi yılı" htmlFor="set-year">
              <Select id="set-year" value={draft.taxYear} onChange={(e) => setDraft({ ...draft, taxYear: Number(e.target.value) })}>
                {Object.keys(RULE_SETS).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mükellefiyet türü" htmlFor="set-type" className="sm:col-span-2">
              <Select id="set-type" value={draft.taxpayerType} onChange={(e) => setDraft({ ...draft, taxpayerType: e.target.value as Settings["taxpayerType"] })}>
                {TAXPAYER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TAXPAYER_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4 space-y-4">
            <Switch
              label="Bağ-Kur primini matrahtan düş"
              description="Varsayımdır; mükellefin durumuna göre değişebilir."
              checked={draft.deductSocialSecurity}
              onChange={(v) => setDraft({ ...draft, deductSocialSecurity: v })}
            />
            <Switch
              label="Genç girişimci istisnası uygulanıyor"
              description="Koşulları (yaş, faaliyetin ilk 3 yılı vb.) sağladığını beyan edersin."
              checked={draft.youngEntrepreneur}
              onChange={(v) => setDraft({ ...draft, youngEntrepreneur: v })}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Görünüm ve bildirimler</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Tema" htmlFor="set-theme">
              <Select id="set-theme" value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value as Settings["theme"] })}>
                <option value="system">Sistem</option>
                <option value="light">Açık</option>
                <option value="dark">Koyu</option>
              </Select>
            </Field>
            <Field label="Dil" htmlFor="set-lang" hint="Diğer diller için altyapı hazır">
              <Select id="set-lang" value={draft.locale} disabled>
                <option value="tr">Türkçe</option>
              </Select>
            </Field>
            <Field label="Para birimi" htmlFor="set-cur">
              <Select id="set-cur" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as Settings["currency"] })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-5 space-y-4">
            <Switch label="Yaklaşan ödemeler" checked={draft.notifications.upcomingPayments} onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, upcomingPayments: v } })} />
            <Switch label="Vergi hatırlatmaları" checked={draft.notifications.taxReminders} onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, taxReminders: v } })} />
            <Switch label="Haftalık özet" checked={draft.notifications.weeklySummary} onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, weeklySummary: v } })} />
            <p className="text-xs text-subtle">Bildirim tercihleri kaydedilir; bildirim gönderimi (e-posta/push) henüz etkin değildir.</p>
          </div>
        </Card>
      </div>

      <div className="sticky bottom-20 z-20 mt-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-surface/95 p-3 backdrop-blur lg:bottom-4">
        {errors.length > 0 && (
          <ul role="alert" className="mr-auto text-xs text-negative">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {saved && (
          <p role="status" className="mr-auto text-sm text-positive">
            Ayarlar kaydedildi
          </p>
        )}
        <Button onClick={save}>Ayarları kaydet</Button>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Verilerim</h2>
        <p className="mt-1 text-sm text-muted">Tüm verini dışa aktarabilir veya kalıcı olarak silebilirsin.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadText(`solofin-yedek-${store.today}.json`, JSON.stringify(store.exportAll(), null, 2), "application/json")}>
            <Download className="h-4 w-4" aria-hidden /> Tüm veriyi indir (JSON)
          </Button>
          <Button variant="secondary" onClick={() => downloadText(`solofin-islemler-${store.today}.csv`, exportTransactionsCsv(store.transactions))}>
            <Download className="h-4 w-4" aria-hidden /> İşlemleri indir (CSV)
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> {store.mode === "demo" ? "Demo verisini temizle" : "Tüm verimi sil"}
          </Button>
        </div>
      </Card>

      <Dialog
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setConfirmText("");
        }}
        title="Verileri kalıcı olarak sil"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              disabled={confirmText.trim().toLocaleUpperCase("tr") !== "SİL"}
              onClick={() => {
                store.deleteAllData();
                setConfirmDelete(false);
                setConfirmText("");
              }}
            >
              Kalıcı olarak sil
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {store.mode === "demo" ? "Demo alanındaki" : "Bu tarayıcıdaki"} tüm işlemler, tekrarlayan kalemler, senaryolar ve ayarlar silinecek. Bu işlem geri alınamaz. Önce yedek almanı öneririz.
        </p>
        <Field label='Onaylamak için "SİL" yaz' htmlFor="confirm-del" className="mt-4">
          <Input id="confirm-del" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        </Field>
      </Dialog>
    </>
  );
}
