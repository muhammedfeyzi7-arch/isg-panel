"use client";

import { useMemo } from "react";
import { addDays } from "../finance/dates";
import { resilience, safeToSpend, upcomingEvents } from "../finance/cashflow";
import { projectYear } from "../finance/summary";
import { getRuleSet } from "../finance/tax/rules";
import { useStore } from "./store";

/** Store verisinden türetilen tüm hesaplamalar (saf motor fonksiyonları üzerinden). */
export function useFinance() {
  const store = useStore();
  const { transactions, recurring, settings, today } = store;

  return useMemo(() => {
    const { rules, fallback } = getRuleSet(settings.taxYear);
    const projection = projectYear(transactions, settings, rules, today);
    const safe = safeToSpend(transactions, recurring, settings, rules, today, projection);
    const events90 = upcomingEvents(transactions, recurring, settings, rules, today, addDays(today, 90));
    const resil = resilience(projection, settings, safe.taxReserve);
    return { rules, ruleFallback: fallback, projection, safe, events90, resilience: resil };
  }, [transactions, recurring, settings, today]);
}
