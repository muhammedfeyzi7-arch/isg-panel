import type { RecurringItem, Settings, Transaction } from "../data/schema";
import { resilience, safeToSpend, upcomingEvents } from "./cashflow";
import { addDays } from "./dates";
import { projectYear } from "./summary";
import { getRuleSet } from "./tax/rules";

/** Uygulamanın tüm ekranlarında kullanılan türetilmiş finansal durum (saf fonksiyon). */
export function computeOverview(
  transactions: readonly Transaction[],
  recurring: readonly RecurringItem[],
  settings: Settings,
  today: string,
) {
  const { rules, fallback } = getRuleSet(settings.taxYear);
  const projection = projectYear(transactions, settings, rules, today);
  const safe = safeToSpend(transactions, recurring, settings, rules, today, projection);
  const events90 = upcomingEvents(transactions, recurring, settings, rules, today, addDays(today, 90));
  const resil = resilience(projection, settings, safe.taxReserve);
  return { rules, ruleFallback: fallback, projection, safe, events90, resilience: resil };
}

export type Overview = ReturnType<typeof computeOverview>;
