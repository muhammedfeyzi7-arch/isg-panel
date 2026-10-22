import { Download, RefreshCw, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { settingsSchema, TAXPAYER_LABEL, TAXPAYER_TYPES, type Settings } from "@solofin/core/data/schema";
import { exportTransactionsCsv } from "@solofin/core/finance/csv";
import { CURRENCIES, fromKurus, parseMoneyInput } from "@solofin/core/finance/money";
import { RULE_SETS } from "@solofin/core/finance/tax/rules";
import { Badge, Button, Card, Field, Notice, Screen, SectionHeader, Segmented, SelectField, Sheet, T, ToggleRow } from "@/components/ui";
import { shareTextFile } from "@/lib/share";
import { useStore, type DataMode } from "@/store/StoreProvider";
import { space } from "@/theme";

const MONEY = [
  { key: "cashBalance", label: "Güncel banka bakiyesi", hint: "Tüm hesaplarının toplamı. Banka bağlantısı yok; elle güncellenir." },
  { key: "monthlyPersonalSpend", label: "Aylık kişisel yaşam gideri", hint: "Dayanıklılık ve senaryo hesapları için" },
  { key: "safetyBuffer", label: "Güvenlik payı", hint: "Kullanılabilir tutardan her zaman ayrılır" },
  { key: "provisionalTaxPaid", label: "Bu yıl ödenen geçici vergi", hint: "Vergi rezervinden mahsup edilir" },
] as const;

const fmt = (k: number) => fromKurus(k).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export default function SettingsScreen() {
  const store = useStore();
  const [draft, setDraft] = useState<Settings>(store.settings);
  const [money, setMoney] = useState<Record<string, string>>(() => Object.fromEntries(MONEY.map((f) => [f.key, fmt(store.settings[f.key])])));
  const [emergency, setEmergency] = useState(String(store.settings.emergencyMonths));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loadedFor, setLoadedFor] = useState(store.mode);

  if (loadedFor !== store.mode) {
    setLoadedFor(store.mode);
    setDraft(store.settings);
    setMoney(Object.fromEntries(MONEY.map((f) => [f.key, fmt(store.settings[f.key])])));
    setEmergency(String(store.settings.emergencyMonths));
  }

  function save() {
    const errs: string[] = [];
    const next: Settings = { ...draft, emergencyMonths: Number(emergency) };
    for (const f of MONEY) {
      const v = parseMoneyInput(money[f.key] || "0");
      if (v === null || (f.key !== "cashBalance" && v < 0)) errs.push(`${f.label}: geçerli bir tutar gir`);
      else next[f.key] = v;
    }
    const parsed = settingsSchema.safeParse(next);
    if (!parsed.success) errs.push(...parsed.error.issues.map((i) => (i.path[0] === "emergencyMonths" ? "Acil durum fonu hedefi 0–24 ay olmalı" : i.message)));
    setErrors(errs);
    if (errs.length || !parsed.success) return;
    store.saveSettings(parsed.data);
    setSaved(true);
  }

  const supabase = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL);

  return (
    <Screen testID="screen-settings">
      <SectionHeader title="Veri modu" subtitle="Demo verisi ve kendi verin ayrı saklanır" />
      <Card style={{ gap: space.md }}>
        <Segmented
          label="Veri modu"
          value={store.mode}
          onChange={(m: DataMode) => store.setMode(m)}
          options={[
            { value: "demo", label: "Demo verisi" },
            { value: "local", label: "Kendi verim" },
          ]}
        />
        <T v="small" color="muted">
          {store.mode === "demo" ? "Kurgusal bir serbest çalışan profili. Değişiklikler yalnızca demo alanında kalır." : "Verilerin yalnızca bu cihazda saklanır; başka cihazla eşitlenmez."}
        </T>
        {store.mode === "demo" ? <Button label="Demo verisini sıfırla" icon={RefreshCw} variant="secondary" small onPress={store.resetDemo} /> : null}
      </Card>

      <SectionHeader title="Finansal durum" />
      <Card style={{ gap: space.md }}>
        {MONEY.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} value={money[f.key]} keyboardType="decimal-pad" onChangeText={(t) => setMoney((m) => ({ ...m, [f.key]: t }))} testID={`set-${f.key}`} />
        ))}
        <Field label="Acil durum fonu hedefi (ay)" value={emergency} keyboardType="number-pad" onChangeText={setEmergency} />
      </Card>

      <SectionHeader title="Vergi profili" />
      <Card style={{ gap: space.md }}>
        <SelectField label="Vergi ülkesi" value="TR" options={[{ value: "TR", label: "Türkiye" }]} onChange={() => undefined} hint="Şimdilik yalnızca Türkiye" />
        <SelectField label="Vergi yılı" value={draft.taxYear} options={Object.keys(RULE_SETS).map((y) => ({ value: Number(y), label: y }))} onChange={(y) => setDraft({ ...draft, taxYear: y })} />
        <SelectField label="Mükellefiyet türü" value={draft.taxpayerType} options={TAXPAYER_TYPES.map((t) => ({ value: t, label: TAXPAYER_LABEL[t] }))} onChange={(t) => setDraft({ ...draft, taxpayerType: t })} />
        <ToggleRow label="Bağ-Kur primini matrahtan düş" description="Varsayımdır; mükellefin durumuna göre değişebilir." value={draft.deductSocialSecurity} onChange={(v) => setDraft({ ...draft, deductSocialSecurity: v })} />
        <ToggleRow label="Genç girişimci istisnası" description="Koşulları sağladığını beyan edersin." value={draft.youngEntrepreneur} onChange={(v) => setDraft({ ...draft, youngEntrepreneur: v })} />
      </Card>

      <SectionHeader title="Görünüm ve bildirimler" />
      <Card style={{ gap: space.md }}>
        <View style={{ gap: 6 }}>
          <T v="small" style={{ fontWeight: "600" }}>
            Tema
          </T>
          <Segmented
            label="Tema"
            value={draft.theme}
            onChange={(t) => setDraft({ ...draft, theme: t })}
            options={[
              { value: "system", label: "Sistem" },
              { value: "light", label: "Açık" },
              { value: "dark", label: "Koyu" },
            ]}
          />
        </View>
        <SelectField label="Dil" value="tr" options={[{ value: "tr", label: "Türkçe" }]} onChange={() => undefined} hint="Diğer diller için altyapı hazır" />
        <SelectField label="Para birimi" value={draft.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={(c) => setDraft({ ...draft, currency: c })} />
        <ToggleRow label="Yaklaşan ödemeler" value={draft.notifications.upcomingPayments} onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, upcomingPayments: v } })} />
        <ToggleRow label="Vergi hatırlatmaları" value={draft.notifications.taxReminders} onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, taxReminders: v } })} />
        <ToggleRow label="Haftalık özet" value={draft.notifications.weeklySummary} onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, weeklySummary: v } })} />
        <T v="caption" color="subtle">
          Tercihler kaydedilir; bildirim gönderimi henüz etkin değil.
        </T>
      </Card>

      {errors.length ? <Notice tone="negative">{errors.join("\n")}</Notice> : null}
      {saved ? <Notice tone="positive">Ayarlar kaydedildi</Notice> : null}
      <Button label="Ayarları kaydet" onPress={save} testID="settings-save" />

      <SectionHeader title="Hesap ve entegrasyonlar" />
      <Card style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T>Kimlik doğrulama</T>
          <Badge label={supabase ? "Supabase yapılandırıldı" : "Yerel mod"} tone={supabase ? "primary" : "neutral"} />
        </View>
        <T v="caption" color="subtle">
          {supabase ? "Ortam değişkenleri tanımlı; istemci adaptörü bu sürümde henüz bağlanmadı. Veriler cihazda kalır." : "Canlı backend yapılandırılmadı. Uygulama tek kullanıcılı yerel modda çalışır."}
        </T>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.sm }}>
          <T>Yapay zekâ</T>
          <Badge label="Kapalı" />
        </View>
        <T v="caption" color="subtle">
          Tüm hesaplamalar deterministik motorla yapılır; uygulama yapay zekâ olmadan tam çalışır.
        </T>
      </Card>

      <SectionHeader title="Verilerim" />
      <Card style={{ gap: space.sm }}>
        <Button label="Tüm veriyi dışa aktar (JSON)" icon={Download} variant="secondary" onPress={() => shareTextFile(`solofin-yedek-${store.today}.json`, JSON.stringify(store.exportAll(), null, 2), "application/json")} />
        <Button label="İşlemleri dışa aktar (CSV)" icon={Download} variant="secondary" onPress={() => shareTextFile(`solofin-islemler-${store.today}.csv`, exportTransactionsCsv(store.transactions))} />
        <Button label={store.mode === "demo" ? "Demo verisini temizle" : "Tüm verimi sil"} icon={Trash2} variant="danger" onPress={() => setConfirm(true)} />
      </Card>

      <Sheet
        visible={confirm}
        onClose={() => {
          setConfirm(false);
          setConfirmText("");
        }}
        title="Verileri kalıcı olarak sil"
        footer={
          <Button
            label="Kalıcı olarak sil"
            variant="danger"
            disabled={confirmText.trim().toLocaleUpperCase("tr") !== "SİL"}
            onPress={() => {
              store.deleteAllData();
              setConfirm(false);
              setConfirmText("");
            }}
          />
        }
      >
        <View style={{ gap: space.md }}>
          <T color="muted">İşlemler, tekrarlayan kalemler, senaryolar, belgeler ve ayarlar silinecek. Bu işlem geri alınamaz. Önce yedek almanı öneririz.</T>
          <Field label='Onaylamak için "SİL" yaz' value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} />
        </View>
      </Sheet>
    </Screen>
  );
}
