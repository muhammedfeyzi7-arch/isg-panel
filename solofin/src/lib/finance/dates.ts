/** Saat dilimi sorunlarını önlemek için tüm tarihler "YYYY-AA-GG" dizgesi olarak işlenir (UTC). */

export function parseISO(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: string, n: number): string {
  const dt = parseISO(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}

export function addMonths(d: string, n: number): string {
  const dt = parseISO(d);
  const day = dt.getUTCDate();
  dt.setUTCDate(1);
  dt.setUTCMonth(dt.getUTCMonth() + n);
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(day, last));
  return toISO(dt);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000);
}

export function monthKey(d: string): string {
  return d.slice(0, 7);
}

export function yearOf(d: string): number {
  return Number(d.slice(0, 4));
}

export function monthOf(d: string): number {
  return Number(d.slice(5, 7));
}

export function startOfMonth(d: string): string {
  return `${d.slice(0, 7)}-01`;
}

export function endOfMonth(d: string): string {
  const dt = parseISO(startOfMonth(d));
  return toISO(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)));
}

export function daysInMonth(d: string): number {
  return Number(endOfMonth(d).slice(8, 10));
}

const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function monthLabel(key: string, long = false): string {
  const m = Number(key.slice(5, 7)) - 1;
  return (long ? MONTHS_LONG : MONTHS_SHORT)[m];
}

export function formatDate(d: string, opts: { year?: boolean } = { year: true }): string {
  const [y, m, day] = d.split("-");
  return `${Number(day)} ${MONTHS_SHORT[Number(m) - 1]}${opts.year ? ` ${y}` : ""}`;
}

/** [from, to] aralığındaki ay anahtarları (YYYY-AA) */
export function monthRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cur = `${fromKey}-01`;
  while (monthKey(cur) <= toKey) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}
