import { formatDate } from "@solofin/core/finance/dates";
import { formatMoney } from "@solofin/core/finance/money";
import type { Transaction } from "@solofin/core/data/schema";

export { formatMoney, formatDate };

export function signedTx(t: Pick<Transaction, "kind" | "amount" | "currency">): string {
  const cents = t.amount % 100 !== 0;
  return `${t.kind === "income" ? "+" : "−"}${formatMoney(t.amount, t.currency, { cents })}`;
}
