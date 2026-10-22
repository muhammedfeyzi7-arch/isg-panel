import { defineConfig, devices } from "@playwright/test";

/**
 * Mobil uygulamanın web dışa aktarımı (react-native-web) üzerinde telefon görüntü alanında uçtan uca testler.
 * Önce: npm run export:web
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:8091", launchOptions: { args: ["--no-proxy-server"] } },
  webServer: { command: "node scripts/serve-dist.mjs dist 8091", url: "http://localhost:8091", reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 14"], browserName: "chromium" } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
});
