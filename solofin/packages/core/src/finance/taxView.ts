import type { Settings, Transaction } from "../data/schema";
import { buildTaxBasis, countsForTax, monthlySeries, projectYear } from "./summary";
import { computeProgressiveTax, computeVat, estimateProvisionalTax } from "./tax/engine";
import type { TaxRuleSet } from "./tax/rules";

/** Vergi ekranının ihtiyaç duyduğu tüm türetilmiş değerler (web ve mobil ortak). */
export function taxView(transactions: readonly Transaction[], settings: Settings, rules: TaxRuleSet, today: string, includeAssumed: boolean) {
  const projection = projectYear(transactions, settings, rules, today, { includeAssumed });
  const yearStart = `${settings.taxYear}-01-01`;

  const ytdBasis = buildTaxBasis(transactions, settings, rules, yearStart, today);
  const monthBasis = buildTaxBasis(transactions, settings, rules, `${today.slice(0, 7)}-01`, today);
  const vat = { ytd: computeVat(ytdBasis.salesForVat, ytdBasis.purchasesForVat), month: computeVat(monthBasis.salesForVat, monthBasis.purchasesForVat) };

  let paid = 0;
  const provisional = rules.provisionalTax.quarters.map((q) => {
    const end = `${settings.taxYear}-${String(q.endMonth).padStart(2, "0")}-31`;
    const due = `${settings.taxYear}-${String(q.dueMonth).padStart(2, "0")}-${String(q.dueDay).padStart(2, "0")}`;
    const b = buildTaxBasis(transactions, settings, rules, yearStart, end);
    const profit = Math.max(
      0,
      b.grossIncome - b.confirmedDeductible - (includeAssumed ? b.assumedDeductible : 0) - b.depreciation - (settings.deductSocialSecurity ? b.socialSecurity : 0),
    );
    const est = Math.max(0, estimateProvisionalTax(profit, paid, rules) - b.withholdingCredits);
    paid += est;
    return { label: q.label, due, profit, est, past: due < today, complete: end.slice(0, 7) < today.slice(0, 7) };
  });

  // Kümülatif gelir ve yaklaşık kümülatif gelir vergisi (Bağ-Kur ve amortisman hariç gösterge)
  const counted = transactions.filter((t) => countsForTax(t, settings));
  const actual = monthlySeries(counted, projection.months.map((m) => m.month));
  let inc = 0;
  let net = 0;
  const cumulative = projection.months.map((m, i) => {
    const src = m.projected ? m : actual[i];
    inc += src.income;
    net += src.income - src.expense;
    return { month: m.month, projected: m.projected, income: inc, tax: computeProgressiveTax(Math.max(0, net), rules.incomeTax.brackets).tax };
  });

  return { projection, vat, provisional, cumulative };
}
