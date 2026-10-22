import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Statik güvenlik kontrolü: canlı bir Supabase örneği olmadan, migration dosyalarındaki her tablonun
 * RLS'yi etkinleştirdiğini ve kullanıcı tablolarındaki politikaların auth.uid() ile sınırlandığını doğrular.
 * (Gerçek bir veritabanına karşı izolasyon testi canlı ortam gerektirir — bkz. docs/BUILD_STATUS.md.)
 */
const root = path.resolve(__dirname, "../../..");
const dir = path.join(root, "supabase/migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .join("\n");

const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
const REQUIRED = [
  "profiles",
  "income_transactions",
  "expense_transactions",
  "tax_profiles",
  "tax_rule_versions",
  "scenarios",
  "scenario_results",
  "financial_goals",
  "recurring_items",
  "documents",
  "app_settings",
];

describe("Supabase migration", () => {
  it("gerekli tüm tablolar tanımlı", () => {
    for (const t of REQUIRED) expect(tables).toContain(t);
  });

  it("her tabloda RLS etkin", () => {
    for (const t of tables) expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
  });

  it("kullanıcı tablolarının politikaları auth.uid() ile sınırlı ve hem okuma hem yazmayı kapsıyor", () => {
    for (const t of tables.filter((x) => x !== "tax_rule_versions")) {
      const m = sql.match(new RegExp(`create policy "[^"]+" on public\\.${t}\\s+for all using \\(auth\\.uid\\(\\) = (user_id|id)\\) with check \\(\\s*auth\\.uid\\(\\) = (user_id|id)`));
      expect(m, `${t} için sahiplik politikası`).not.toBeNull();
    }
  });

  it("vergi kuralları istemciden yazılamaz (yalnızca select politikası)", () => {
    const policies = [...sql.matchAll(/create policy "[^"]+" on public\.tax_rule_versions\s+for (\w+)/g)].map((m) => m[1]);
    expect(policies).toEqual(["select"]);
  });

  it("tutarlar kuruş tamsayısı olarak saklanır", () => {
    expect(sql).not.toMatch(/amount (numeric|real|double|float)/);
  });
});

describe("istemci paketinde gizli anahtar yok", () => {
  it("istemci kaynak kodunda service-role / gizli anahtar referansı yok", () => {
    const SKIP = new Set(["node_modules", ".next", ".expo", "dist", "ios", "android"]);
    const walk = (d: string): string[] => {
      try {
        return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
          SKIP.has(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx|js|json)$/.test(e.name) ? [path.join(d, e.name)] : [],
        );
      } catch {
        return [];
      }
    };
    const files = [...walk(path.join(root, "packages/core/src")), ...walk(path.join(root, "apps/web/src")), ...walk(path.join(root, "apps/mobile/src")), ...walk(path.join(root, "apps/mobile/app"))];
    expect(files.length).toBeGreaterThan(10);
    const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(src).not.toMatch(/SERVICE_ROLE/i);
    expect(src).not.toMatch(/sk-ant-|sk_live_|eyJhbGciOi/);
  });
});
