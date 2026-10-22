"use client";

import { useMemo } from "react";
import { computeOverview } from "@solofin/core/finance/overview";
import { useStore } from "./store";

/** Store verisinden türetilen tüm hesaplamalar (ortak motor üzerinden). */
export function useFinance() {
  const { transactions, recurring, settings, today } = useStore();
  return useMemo(() => computeOverview(transactions, recurring, settings, today), [transactions, recurring, settings, today]);
}
