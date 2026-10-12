"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, Store, X } from "lucide-react";
import { NAV, activeHref } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const active = activeHref(pathname);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV.map((g) => [g.key, true])),
  );

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((group) => {
        const Icon = group.icon;
        if (!group.children && group.href) {
          const isActive = active === group.href;
          return (
            <Link
              key={group.key}
              href={group.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent hover:text-white",
              )}
            >
              <Icon className="size-4" />
              {t.nav[group.key]}
            </Link>
          );
        }
        const groupActive = group.children?.some((c) => c.href === active);
        const isOpen = open[group.key];
        return (
          <div key={group.key} className="mt-1">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [group.key]: !s[group.key] }))}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-white",
                groupActive && "text-white",
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1 text-left">{t.nav[group.key]}</span>
              <ChevronDown className={cn("size-4 text-sidebar-muted transition-transform", !isOpen && "-rotate-90")} />
            </button>
            {isOpen && (
              <div className="ml-5 mt-0.5 flex flex-col border-l border-sidebar-accent pl-3">
                {group.children?.map((child) => {
                  const isActive = child.href === active;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent font-medium text-white"
                          : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-white",
                      )}
                    >
                      {t.nav[child.key]}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-accent px-5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Store className="size-4" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">{t.common.appName}</div>
        <div className="text-xs text-sidebar-muted">{t.common.storeName}</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <Brand />
      <NavContent />
      <div className="border-t border-sidebar-accent px-5 py-3 text-xs text-sidebar-muted">{t.common.footer}</div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label={t.common.openMenu}
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-md border bg-card lg:hidden"
      >
        <Menu className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <button
              type="button"
              aria-label={t.common.closeMenu}
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 text-sidebar-muted hover:text-white"
            >
              <X className="size-5" />
            </button>
            <Brand />
            <NavContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
