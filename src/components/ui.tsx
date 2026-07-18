/** Small shared primitives — instrument-panel idiom (docs/03). */
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function Card({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  n,
  right,
  className,
}: {
  title: string;
  /** Numbered-section accent ("01", "02" …). */
  n?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between border-b border-line px-4 py-2.5", className)}>
      <div className="flex items-baseline gap-2">
        {n ? <span className="font-mono text-[10px] text-ink-faint">{n}</span> : null}
        <h2 className="text-[13px] font-medium tracking-tight">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  copy,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-3 rounded-full border border-line bg-surface2 p-3">
        <Icon className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-muted">{copy}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[0.92em]", className)}>{children}</span>;
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: "ok" | "warn" | "danger" | "accent" | "muted";
  children: React.ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    ok: "bg-ok-dim text-ok",
    warn: "bg-warn-dim text-warn",
    danger: "bg-danger-dim text-danger",
    accent: "bg-accent-dim text-accent",
    muted: "bg-surface2 text-ink-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  variant = "default",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" | "ghost" }) {
  const variants: Record<string, string> = {
    default: "border border-line bg-surface2 text-ink hover:border-line-strong",
    primary: "bg-accent text-accent-ink hover:opacity-90",
    danger: "border border-danger/40 bg-danger-dim text-danger hover:border-danger",
    ghost: "text-ink-muted hover:bg-surface2 hover:text-ink",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
