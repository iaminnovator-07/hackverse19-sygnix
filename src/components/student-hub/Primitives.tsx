import {
  ArrowRight,
  Check,
  Gem,
  Lock,
  PlayCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export const accentClasses = {
  blue: {
    card: "border-blue-100 bg-blue-50 text-blue-700",
    icon: "bg-blue-600 text-white",
    progress: "bg-blue-600",
    text: "text-blue-700",
  },
  teal: {
    card: "border-teal-100 bg-teal-50 text-teal-700",
    icon: "bg-teal-600 text-white",
    progress: "bg-teal-600",
    text: "text-teal-700",
  },
  amber: {
    card: "border-amber-100 bg-amber-50 text-amber-700",
    icon: "bg-amber-500 text-white",
    progress: "bg-amber-500",
    text: "text-amber-700",
  },
  rose: {
    card: "border-rose-100 bg-rose-50 text-rose-700",
    icon: "bg-rose-500 text-white",
    progress: "bg-rose-500",
    text: "text-rose-700",
  },
  indigo: {
    card: "border-indigo-100 bg-indigo-50 text-indigo-700",
    icon: "bg-indigo-600 text-white",
    progress: "bg-indigo-600",
    text: "text-indigo-700",
  },
  green: {
    card: "border-emerald-100 bg-emerald-50 text-emerald-700",
    icon: "bg-emerald-600 text-white",
    progress: "bg-emerald-600",
    text: "text-emerald-700",
  },
} as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-200">
        <Gem className="size-6" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold text-slate-950">Diamond Student Hub</p>
          <p className="truncate text-xs font-semibold text-slate-500">Maharashtra Board Class 9</p>
        </div>
      )}
    </div>
  );
}

export function LaunchBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">
      <Sparkles className="size-4" aria-hidden="true" />
      Launch Offer
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow && <p className="mb-2 text-sm font-bold text-blue-700">{eyebrow}</p>}
      <h2 className="text-3xl font-extrabold text-slate-950 sm:text-4xl">{title}</h2>
      {copy && <p className="mt-3 text-base leading-7 text-slate-600">{copy}</p>}
    </div>
  );
}

export function PrimaryLink({
  children,
  href,
  icon: Icon = ArrowRight,
}: {
  children: ReactNode;
  href: string;
  icon?: LucideIcon;
}) {
  return (
    <a
      href={href}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
    >
      {children}
      <Icon className="size-4" aria-hidden="true" />
    </a>
  );
}

export function SecondaryLink({
  children,
  href,
  icon: Icon = PlayCircle,
}: {
  children: ReactNode;
  href: string;
  icon?: LucideIcon;
}) {
  return (
    <a
      href={href}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50"
    >
      <Icon className="size-4 text-blue-700" aria-hidden="true" />
      {children}
    </a>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md">
      <p className="text-3xl font-extrabold text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "bg-blue-600",
  label,
}: {
  value: number;
  tone?: string;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-600">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm font-semibold text-slate-700">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="size-3.5" aria-hidden="true" />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function LockedPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
      <Lock className="size-3.5" aria-hidden="true" />
      Premium
    </span>
  );
}
