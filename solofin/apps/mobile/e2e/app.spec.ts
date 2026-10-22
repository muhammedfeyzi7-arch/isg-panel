import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const TABS = [
  { label: "Ana Sayfa", heading: "Finansal merkez" },
  { label: "Gelir/Gider", heading: "Gelir / Gider" },
  { label: "Simülasyon", heading: "Vergi Simülatörü" },
  { label: "Belgeler", heading: "Belgeler" },
  { label: "Profil", heading: "Profil" },
];

async function fresh(page: Page, url = "/") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(page.getByLabel("Yükleniyor")).toHaveCount(0);
}

async function noOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

test("ana ekran ve 5 sekme açılır, hata ve yatay taşma yok", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fresh(page);
  await expect(page.getByText("Bugün güvenle kullanabileceğin tahmini tutar")).toBeVisible();
  await expect(page.getByTestId("safe-amount")).toContainText("₺");
  for (const t of TABS) {
    await page.getByRole("tab", { name: t.label }).or(page.getByRole("link", { name: t.label })).first().click();
    await expect(page.getByRole("heading", { name: t.heading }).first()).toBeVisible();
    expect(await noOverflow(page), `${t.label} yatay taşma`).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("gider ekleme, doğrulama ve düzenleme", async ({ page }) => {
  await fresh(page, "/islemler");
  await page.getByTestId("add-tx").click();
  await page.getByTestId("tx-save").click();
  await expect(page.getByText(/Geçerli ve sıfırdan büyük bir tutar/)).toBeVisible();

  await page.getByTestId("tx-amount").fill("7.777,50");
  await page.getByTestId("tx-description").fill("E2E mobil kurs");
  await page.getByLabel("Kategori: seçilmedi").click();
  await page.getByRole("radio", { name: "Eğitim" }).click();
  await page.getByTestId("tx-save").click();

  await expect(page.getByRole("heading", { name: "Gelir / Gider" })).toBeVisible();
  await page.getByLabel("İşlemlerde ara").fill("E2E mobil");
  await expect(page.getByText("E2E mobil kurs")).toBeVisible();
  await expect(page.getByText("−₺7.777,50")).toBeVisible();

  await page.getByText("E2E mobil kurs").click();
  await page.getByTestId("tx-description").fill("E2E mobil kurs (güncel)");
  await page.getByTestId("tx-save").click();
  await expect(page.getByText("E2E mobil kurs (güncel)")).toBeVisible();
});

test("senaryo karşılaştırma hesaplar ve kaydeder", async ({ page }) => {
  await fresh(page, "/simulasyon");
  await page.getByText("Fiyatımı %10 artırırsam").click();
  await expect(page.getByTestId("scenario-insight")).toContainText("artar");
  await expect(page.getByTestId("scenario-diff")).toContainText("+₺");
  await page.getByTestId("scenario-name").fill("E2E zam");
  await page.getByTestId("scenario-save").click();
  await expect(page.getByText("Kaydedildi")).toBeVisible();
});

test("fatura görüntüsü eklenir ve gider olarak kaydedilir", async ({ page }) => {
  await fresh(page, "/belgeler");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("pick-library").click();
  await (await chooser).setFiles(path.join(__dirname, "fatura.png"));
  await expect(page.getByLabel("Fatura görüntüsü")).toBeVisible();
  await page.getByTestId("doc-vendor").fill("Tekno Market");
  await page.getByTestId("doc-amount").fill("1.299");
  await page.getByLabel("Kategori: seçilmedi").click();
  await page.getByRole("radio", { name: "Ekipman" }).click();
  await page.getByTestId("doc-save").click();

  await expect(page.getByText("Tekno Market").first()).toBeVisible();
  await expect(page.getByText("Gider olarak eklendi")).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("solofin:db:demo:v1") ?? "");
  expect(stored).toContain("Tekno Market faturası");
});

test("ayarlarda bakiye güncellenince ana ekran tutarı değişir", async ({ page }) => {
  await fresh(page);
  const before = await page.getByTestId("safe-amount").innerText();
  await page.goto("/ayarlar");
  await page.getByTestId("set-cashBalance").fill("600.000");
  await page.getByTestId("settings-save").click();
  await expect(page.getByText("Ayarlar kaydedildi")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("safe-amount")).not.toHaveText(before);
});

test("kendi veri moduna geçiş demo verisini ayırır", async ({ page }) => {
  await fresh(page, "/profil");
  await page.getByRole("radio", { name: "Kendi verim" }).click();
  await page.goto("/islemler");
  await expect(page.getByText("Henüz işlem yok")).toBeVisible();
});
