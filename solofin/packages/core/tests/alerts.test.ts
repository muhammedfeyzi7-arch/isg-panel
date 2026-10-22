import { describe, expect, it } from "vitest";
import { buildAlerts } from "../src/finance/alerts";
import { resilience, safeToSpend, upcomingEvents } from "../src/finance/cashflow";
import { addDays } from "../src/finance/dates";
import { projectYear } from "../src/finance/summary";
import { TR_2026 } from "../src/finance/tax/rules";
import { demoRecurring, demoSettings, generateDemoTransactions } from "../src/data/demo";

const today = "2026-10-22";

function run(settingsPatch = {}) {
  const txs = generateDemoTransactions(today);
  const settings = { ...demoSettings(today), ...settingsPatch };
  const recurring = demoRecurring(today);
  const projection = projectYear(txs, settings, TR_2026, today);
  const safe = safeToSpend(txs, recurring, settings, TR_2026, today, projection);
  const events = upcomingEvents(txs, recurring, settings, TR_2026, today, addDays(today, 90));
  const res = resilience(projection, settings, safe.taxReserve);
  return buildAlerts({ txs, settings, rules: TR_2026, today, safe, projection, resilience: res, events });
}

describe("uyarılar", () => {
  it("gecikmiş tahsilatı bildirir ve önem sırasına dizer", () => {
    const alerts = run();
    expect(alerts.some((a) => a.id === "overdue")).toBe(true);
    for (let i = 1; i < alerts.length; i++) expect(alerts[i].severity).toBeLessThanOrEqual(alerts[i - 1].severity);
  });

  it("bakiye yükümlülükleri karşılamıyorsa kritik uyarı en üsttedir", () => {
    const alerts = run({ cashBalance: 1_000_00 });
    expect(alerts[0].id).toBe("shortfall");
    expect(alerts[0].severity).toBe(3);
  });
});
