"use client";

import clsx from "clsx";
import {
  ArrowLeftRight,
  CalendarClock,
  FileBarChart2,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/data/store";

export const NAV = [
  { href: "/", label: "Ana Sayfa", icon: LayoutDashboard },
  { href: "/islemler", label: "Gelir / Gider", icon: ArrowLeftRight },
  { href: "/senaryolar", label: "Senaryolar", icon: FlaskConical },
  { href: "/vergi", label: "Vergi", icon: Landmark },
  { href: "/nakit-akisi", label: "Nakit Akışı", icon: CalendarClock },
  { href: "/emeklilik", label: "Emeklilik", icon: PiggyBank },
  { href: "/raporlar", label: "Raporlar", icon: FileBarChart2 },
  { href: "/ayarlar", label: "Ayarlar", icon: SettingsIcon },
] as const;

const MOBILE_PRIMARY = ["/", "/islemler", "/senaryolar", "/vergi"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="SOLOFIN ana sayfa">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">S</span>
      <span className="text-[15px] font-semibold tracking-[0.08em]">SOLOFIN</span>
    </Link>
  );
}

function ThemeApplier() {
  const { settings, ready } = useStore();
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      try {
        localStorage.setItem("solofin:theme", settings.theme);
      } catch {
        /* yok say */
      }
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme, ready]);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode, ready } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      <ThemeApplier />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        İçeriğe geç
      </a>

      {/* Masaüstü kenar çubuğu */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav aria-label="Ana gezinme" className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(pathname, href) ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon aria-hidden className="h-[18px] w-[18px]" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="m-3 rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted">
          {ready && mode === "demo" ? (
            <>
              <p className="font-medium text-fg">Demo modu</p>
              <p className="mt-0.5">Kurgusal verilerle çalışıyorsun. Kendi verine Ayarlar&apos;dan geçebilirsin.</p>
            </>
          ) : (
            <>
              <p className="font-medium text-fg">Yerel mod</p>
              <p className="mt-0.5">Veriler yalnızca bu tarayıcıda saklanır.</p>
            </>
          )}
        </div>
      </aside>

      {/* Mobil üst çubuk */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        {ready && mode === "demo" && (
          <Link href="/ayarlar" className="rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
            Demo verisi
          </Link>
        )}
      </header>

      <main id="main" className="px-4 pb-28 pt-5 sm:px-6 lg:ml-60 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-6xl">{ready ? children : <LoadingSkeleton />}</div>
      </main>

      {/* Mobil alt gezinme */}
      <nav aria-label="Alt gezinme" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.href)).map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={clsx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", isActive(pathname, href) ? "text-primary" : "text-muted")}
              >
                <Icon aria-hidden className="h-5 w-5" />
                {label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className={clsx(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                NAV.some((n) => !MOBILE_PRIMARY.includes(n.href) && isActive(pathname, n.href)) ? "text-primary" : "text-muted",
              )}
            >
              <Menu aria-hidden className="h-5 w-5" />
              Daha fazla
            </button>
          </li>
        </ul>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menü" id="mobile-menu">
          <button className="absolute inset-0 bg-black/50" aria-label="Menüyü kapat" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Menü</p>
              <button onClick={() => setMenuOpen(false)} className="rounded-md p-1 text-muted" aria-label="Kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href)).map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm font-medium">
                    <Icon aria-hidden className="h-5 w-5 text-muted" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function DemoNotice({ what = "Bu sayfadaki veriler" }: { what?: string }) {
  const { mode } = useStore();
  if (mode !== "demo") return null;
  return (
    <p className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
      {what} kurgusal <strong>demo verisinden</strong> üretilmiştir; gerçek bir kişiye ait değildir.
    </p>
  );
}
