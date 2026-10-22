"use client";

import clsx from "clsx";
import { ChevronDown, Info, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export { clsx as cn };

// ---------------- Button ----------------
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary/90",
  secondary: "bg-surface text-fg border border-border hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-negative/10 text-negative hover:bg-negative/15",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={clsx(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props} />;
  },
);

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return clsx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

// ---------------- Card ----------------
export function Card({ className, children, as: Tag = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & Record<string, unknown>) {
  return (
    <Tag className={clsx("rounded-2xl border border-border bg-surface shadow-card", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, id }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight text-fg">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ---------------- Badge ----------------
type Tone = "neutral" | "positive" | "warning" | "negative" | "primary";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  positive: "bg-positive/10 text-positive",
  warning: "bg-warning/10 text-warning",
  negative: "bg-negative/10 text-negative",
  primary: "bg-primary/10 text-primary",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", toneClass[tone], className)}>{children}</span>;
}

// ---------------- Form alanları ----------------
export function Field({ label, error, hint, children, htmlFor, className }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; htmlFor: string; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-negative">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-negative";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={clsx(inputClass, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={clsx(inputClass, "appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  );
});

// ---------------- Switch ----------------
export function Switch({ checked, onChange, label, id, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string; description?: ReactNode }) {
  const autoId = useId();
  const sid = id ?? autoId;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={sid} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description && <p className="text-xs text-subtle">{description}</p>}
      </div>
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", checked ? "bg-primary" : "bg-border")}
      >
        <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

// ---------------- Segmented (sekme benzeri seçici) ----------------
export function Segmented<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx("inline-flex rounded-lg border border-border bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "h-8 rounded-md px-3 text-sm font-medium transition-colors",
            value === o.value ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Dialog (native <dialog>) ----------------
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={clsx(
        "m-auto max-h-[92dvh] w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-fg shadow-pop",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Kapat">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// ---------------- Açıklama paneli ----------------
export function Explain({ title = "Nasıl hesaplandı?", children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <details className={clsx("group rounded-lg text-sm", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <Info aria-hidden className="h-4 w-4" />
        <span className="underline decoration-dotted underline-offset-4">{title}</span>
      </summary>
      <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-2 p-4 text-muted">{children}</div>
    </details>
  );
}

// ---------------- Boş durum ----------------
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="font-medium text-fg">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------------- Satır (etiket – değer) ----------------
export function Row({ label, value, strong, tone, hint }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: "positive" | "negative" | "warning"; hint?: ReactNode }) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-4 py-2", strong && "border-t border-border pt-3")}>
      <div className="min-w-0">
        <span className={clsx("text-sm", strong ? "font-semibold text-fg" : "text-muted")}>{label}</span>
        {hint && <p className="text-xs text-subtle">{hint}</p>}
      </div>
      <span
        className={clsx(
          "tnum shrink-0 text-sm",
          strong ? "text-base font-semibold" : "font-medium",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
          tone === "warning" && "text-warning",
          !tone && "text-fg",
        )}
      >
        {value}
      </span>
    </div>
  );
}
