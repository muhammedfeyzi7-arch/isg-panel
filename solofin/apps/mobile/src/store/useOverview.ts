import { useMemo } from "react";
import { computeOverview } from "@solofin/core/finance/overview";
import { useStore } from "./StoreProvider";

/** Tüm ekranların kullandığı türetilmiş finansal durum (ortak deterministik motor). */
export function useOverview() {
  const { transactions, recurring, settings, today } = useStore();
  return useMemo(() => computeOverview(transactions, recurring, settings, today), [transactions, recurring, settings, today]);
}
