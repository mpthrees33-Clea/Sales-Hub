"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Building2,
  FolderCheck,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Mail,
  Map,
  Menu,
  Mic,
  Package,
  ScanText,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Mission Control", icon: LayoutDashboard },
  { href: "/approvals", label: "Approvals", icon: Inbox, badge: true },
  { href: "/crm", label: "CRM", icon: Building2 },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/po-intake", label: "PO Intake", icon: ScanText },
  { href: "/meetings", label: "Meetings", icon: Mic },
  { href: "/samples", label: "Samples", icon: Package },
  { href: "/catalog", label: "Catalog", icon: BookOpen },
  { href: "/scenes", label: "Scenes", icon: ImageIcon },
  { href: "/routes", label: "Routes", icon: Map },
  { href: "/submittals", label: "Submittals", icon: FolderCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Rail({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
              active ? "bg-surface2 text-ink" : "text-ink-muted hover:bg-surface2 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="flex-1">{item.label}</span>
            {"badge" in item && item.badge && pendingApprovals > 0 ? (
              <span className="rounded-full bg-accent-dim px-1.5 py-0.5 font-mono text-[10px] text-accent">
                {pendingApprovals}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Phone: hamburger + overlay drawer */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-md border border-line bg-surface p-2 md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-line bg-surface pb-4 pt-4">
            <div className="mb-4 flex items-center justify-between px-4">
              <BrandMark />
              <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-ink-muted" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface pb-4 pt-4 md:flex">
        <div className="mb-5 px-4">
          <BrandMark />
        </div>
        {nav}
        <div className="mt-auto px-4 pt-4">
          <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
            Drafts only —
            <br />
            humans send.
          </p>
        </div>
      </aside>
    </>
  );
}

function BrandMark() {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.25em] text-ink-faint">CLEA</div>
      <div className="text-sm font-semibold tracking-tight">Sales Hub</div>
    </div>
  );
}
