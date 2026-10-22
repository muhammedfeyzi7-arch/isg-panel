import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  { path: "/", heading: "Finansal merkez" },
  { path: "/islemler", heading: "Gelir / Gider" },
  { path: "/senaryolar", heading: "Senaryo karşılaştırma" },
  { path: "/vergi", heading: "Vergi simülatörü" },
  { path: "/nakit-akisi", heading: "Nakit akışı ve dayanıklılık" },
  { path: "/emeklilik", heading: "Emeklilik ve uzun vade" },
  { path: "/raporlar", heading: "Raporlar" },
  { path: "/ayarlar", heading: "Ayarlar" },
];

async function fresh(page: Page, path = "/") {
  await page.goto(path);
  await page.evaluate(() => localStorage.clear());
  await page.goto(path);
  await expect(page.locator("h1")).toBeVisible();
}

test("ana sayfa birincil değeri ve demo uyarısını gösterir", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fresh(page);
  await expect(page.getByRole("heading", { level: 1, name: "Finansal merkez" })).toBeVisible();
  await expect(page.getByText("Bugün güvenle kullanabileceğin tahmini tutar")).toBeVisible();
  await expect(page.getByTestId("safe-amount")).toContainText("₺");
  await expect(page.getByText(/demo verisinden/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("tüm sayfalar açılır ve yatay taşma yoktur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fresh(page);
  for (const p of PAGES) {
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${p.path} yatay taşma`).toBe(false);
  }
  expect(errors).toEqual([]);
});

test("gezinme menüsüyle sayfalar arasında geçilir", async ({ page, isMobile }) => {
  await fresh(page);
  if (isMobile) {
    await page.getByRole("navigation", { name: "Alt gezinme" }).getByRole("link", { name: "Vergi" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Vergi simülatörü" })).toBeVisible();
    await page.getByRole("button", { name: "Daha fazla" }).click();
    await page.getByRole("dialog", { name: "Menü" }).getByRole("link", { name: "Emeklilik" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Emeklilik ve uzun vade" })).toBeVisible();
  } else {
    const nav = page.getByRole("navigation", { name: "Ana gezinme" });
    await nav.getByRole("link", { name: "Nakit Akışı" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nakit akışı ve dayanıklılık" })).toBeVisible();
    await nav.getByRole("link", { name: "Raporlar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Raporlar" })).toBeVisible();
  }
});

test("gider ekleme, düzenleme ve silme", async ({ page }) => {
  await fresh(page, "/islemler");
  await page.getByRole("button", { name: "Ekle" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Yeni işlem" });
  await expect(dialog).toBeVisible();

  // Doğrulama: boş form gönderilemez
  await dialog.getByRole("button", { name: "Ekle" }).click();
  await expect(dialog.getByText(/Geçerli ve sıfırdan büyük bir tutar/)).toBeVisible();

  await dialog.getByLabel("Tutar (KDV hariç)").fill("7.777,50");
  await dialog.getByLabel("Kategori").selectOption("Eğitim");
  await dialog.getByLabel("Açıklama").fill("E2E test kursu");
  await dialog.getByRole("button", { name: "Ekle" }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel("İşlemlerde ara").fill("E2E test");
  const list = page.getByTestId("tx-list");
  await expect(list.locator("li")).toHaveCount(1);
  await expect(list).toContainText("7.777,5");

  await page.getByRole("button", { name: "E2E test kursu düzenle" }).click();
  const edit = page.getByRole("dialog", { name: "İşlemi düzenle" });
  await edit.getByLabel("Açıklama").fill("E2E test kursu (güncel)");
  await edit.getByRole("button", { name: "Kaydet" }).click();
  await expect(list).toContainText("E2E test kursu (güncel)");

  // Kalıcılık: sayfa yenilenince kayıt durur
  await page.reload();
  await page.getByLabel("İşlemlerde ara").fill("E2E test");
  await expect(page.getByTestId("tx-list")).toContainText("güncel");

  await page.getByRole("button", { name: "E2E test kursu (güncel) sil" }).click();
  await page.getByRole("dialog", { name: "İşlemi sil" }).getByRole("button", { name: "Sil" }).click();
  await expect(page.getByText("Filtreye uyan işlem yok")).toBeVisible();
});

test("CSV içe aktarmada geçersiz satırlar raporlanır", async ({ page }) => {
  await fresh(page, "/islemler");
  const csv = "tarih,tur,kategori,tutar\n2026-10-01,gider,Ekipman,100\n2026-10-01,transfer,Ekipman,100\n";
  await page.getByLabel("CSV dosyası seç").setInputFiles({ name: "test.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  const dialog = page.getByRole("dialog", { name: "CSV içe aktarma" });
  await expect(dialog).toContainText("1 geçerli, 1 hatalı satır");
  await expect(dialog).toContainText("Satır 3");
  await dialog.getByRole("button", { name: /1 geçerli satırı içe aktar/ }).click();
  await expect(page.getByRole("status")).toContainText("1 işlem içe aktarıldı");
});

test("senaryo hesaplanır, kaydedilir, yeniden açılır ve silinir", async ({ page }) => {
  await fresh(page, "/senaryolar");
  await page.getByRole("button", { name: "Fiyatımı %10 artırırsam" }).click();
  await expect(page.getByTestId("scenario-insight")).toContainText("net kazancın");
  await expect(page.getByTestId("scenario-insight")).toContainText("artar");
  await page.getByLabel("Senaryo adı").fill("E2E zam");
  await page.getByRole("button", { name: "Senaryoyu kaydet" }).click();
  const saved = page.getByTestId("saved-scenarios");
  await expect(saved).toContainText("E2E zam");

  await page.getByRole("button", { name: "Gelirim %30 düşerse" }).click();
  await saved.getByRole("button", { name: "Aç" }).click();
  await expect(page.getByLabel("Senaryo adı")).toHaveValue("E2E zam");

  await page.getByRole("button", { name: "E2E zam senaryosunu sil" }).click();
  await expect(page.getByText("Henüz kayıtlı senaryo yok.")).toBeVisible();
});

test("kendi veri moduna geçiş demo verisini ayırır", async ({ page }) => {
  await fresh(page, "/ayarlar");
  await page.getByRole("radio", { name: "Kendi verim" }).click();
  await page.goto("/islemler");
  await expect(page.getByText("Henüz işlem yok")).toBeVisible();
  await expect(page.getByText(/demo verisinden/)).toHaveCount(0);
  await page.goto("/ayarlar");
  await page.getByRole("radio", { name: "Demo verisi" }).click();
  await page.goto("/islemler");
  await expect(page.getByTestId("tx-list")).toBeVisible();
});

test("ayarlarda bakiye güncellenince kullanılabilir tutar değişir", async ({ page }) => {
  await fresh(page);
  const before = await page.getByTestId("safe-amount").innerText();
  await page.goto("/ayarlar");
  await page.getByLabel("Güncel banka bakiyesi").fill("600.000");
  await page.getByRole("button", { name: "Ayarları kaydet" }).click();
  await expect(page.getByText("Ayarlar kaydedildi")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("safe-amount")).not.toHaveText(before);
});
