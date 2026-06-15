"use client";

import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  Bell,
  BookOpen,
  ChevronRight,
  Code2,
  CreditCard,
  FileText,
  Gauge,
  KeyRound,
  LayoutGrid,
  Menu,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Tags,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type DashboardShellProps = {
  children: React.ReactNode;
  companyName: string;
  userName: string;
  userRole: string;
};

const mainNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Inbox", href: "/dashboard/inbox", icon: MessageCircle },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Send },
  { label: "Messages", href: "/dashboard/messages", icon: Activity },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users },
  { label: "Templates", href: "/dashboard/templates", icon: FileText },
  { label: "Reports", href: "/dashboard/reports", icon: Gauge },
];

const secondaryNavItems = [
  { label: "WhatsApp", href: "/dashboard/settings/whatsapp", icon: ShieldCheck },
  { label: "Wallet", href: "/dashboard/wallet", icon: Wallet },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Team", href: "/dashboard/settings/team", icon: Users },
  { label: "API Keys", href: "/dashboard/developer/api-keys", icon: KeyRound },
  { label: "API Docs", href: "/dashboard/developer/docs", icon: BookOpen },
  { label: "Webhooks", href: "/dashboard/developer/webhooks", icon: Code2 },
  { label: "Settings", href: "/dashboard/settings/company", icon: Settings },
  { label: "Audit Logs", href: "/dashboard/settings/audit-logs", icon: Tags },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

function NavLink({
  href,
  icon: Icon,
  label,
  collapsed,
  pathname,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={[
        "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition duration-200",
        collapsed ? "justify-center" : "",
        active
          ? "bg-white text-zinc-950 shadow-[0_10px_35px_rgba(129,140,248,0.22)]"
          : "text-zinc-400 hover:bg-white/[0.06] hover:text-white",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-4.5 w-4.5 shrink-0 transition duration-200",
          active ? "text-indigo-500" : "text-zinc-500 group-hover:text-indigo-300",
        ].join(" ")}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function SidebarContent({
  collapsed,
  companyName,
  userRole,
  pathname,
  onToggleCollapse,
  onNavigate,
  mobile = false,
}: {
  collapsed: boolean;
  companyName: string;
  userRole: string;
  pathname: string;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center justify-between px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-indigo-300/20 bg-indigo-500 shadow-[0_0_35px_rgba(99,102,241,0.45)]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                WhatsApp SaaS
              </p>
              <p className="truncate text-xs text-zinc-500">{companyName}</p>
            </div>
          )}
        </Link>

        {mobile ? null : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white xl:grid"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {!collapsed && (
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            Main
          </p>
        )}
        <nav className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              collapsed={collapsed}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        <div className="my-5 h-px bg-white/[0.07]" />

        {!collapsed && (
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            Operations
          </p>
        )}
        <nav className="space-y-1">
          {secondaryNavItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              collapsed={collapsed}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      <div className="border-t border-white/[0.07] p-3">
        <div
          className={[
            "rounded-2xl border border-white/[0.08] bg-white/[0.04]",
            collapsed ? "p-2" : "p-3",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">
                  {userRole}
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  Workspace access
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({
  children,
  companyName,
  userName,
  userRole,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);

  const pageTitle = useMemo(() => {
    const allItems = [...mainNavItems, ...secondaryNavItems];
    return allItems.find((item) => isActivePath(pathname, item.href))?.label;
  }, [pathname]);

  return (
    <div
      className={[
        "min-h-screen transition-colors duration-300",
        lightMode ? "dashboard-light" : "dashboard-dark",
        lightMode
          ? "bg-zinc-100 text-zinc-950"
          : "bg-[#08090d] text-zinc-100",
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-none fixed inset-0 transition-opacity duration-300",
          lightMode ? "opacity-40" : "opacity-100",
        ].join(" ")}
      >
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_35%_0%,rgba(99,102,241,0.22),transparent_38%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.16),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      </div>

      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 hidden border-r border-white/[0.08] bg-zinc-950/78 backdrop-blur-2xl transition-[width] duration-300 md:block",
          collapsed ? "w-20" : "w-20 xl:w-72",
        ].join(" ")}
      >
        <SidebarContent
          collapsed={collapsed}
          companyName={companyName}
          userRole={userRole}
          pathname={pathname}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(86vw,340px)] border-r border-white/[0.08] bg-zinc-950 shadow-2xl">
            <div className="absolute right-3 top-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              mobile
              collapsed={false}
              companyName={companyName}
              userRole={userRole}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div
        className={[
          "relative transition-[padding] duration-300",
          collapsed ? "md:pl-20" : "md:pl-20 xl:pl-72",
        ].join(" ")}
      >
        <header
          className={[
            "sticky top-0 z-20 border-b px-4 py-4 backdrop-blur-2xl sm:px-6 lg:px-8",
            lightMode
              ? "border-zinc-200 bg-zinc-100/80"
              : "border-white/[0.08] bg-[#08090d]/72",
          ].join(" ")}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{companyName}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{pageTitle ?? "Dashboard"}</span>
              </div>
              <p
                className={[
                  "mt-1 truncate text-sm font-medium",
                  lightMode ? "text-zinc-700" : "text-zinc-300",
                ].join(" ")}
              >
                Welcome back, {userName}
              </p>
            </div>

            <div
              className={[
                "hidden h-11 min-w-[280px] items-center gap-3 rounded-2xl border px-4 transition focus-within:border-indigo-400/60 lg:flex",
                lightMode
                  ? "border-zinc-200 bg-white text-zinc-950"
                  : "border-white/[0.08] bg-white/[0.04] text-white",
              ].join(" ")}
            >
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                aria-label="Search"
                placeholder="Search contacts, campaigns, messages..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              />
              <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">
                /
              </kbd>
            </div>

            <button
              type="button"
              className={[
                "relative grid h-10 w-10 place-items-center rounded-xl border transition",
                lightMode
                  ? "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-950"
                  : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white",
              ].join(" ")}
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-zinc-950" />
            </button>

            <button
              type="button"
              onClick={() => setLightMode((value) => !value)}
              className={[
                "grid h-10 w-10 place-items-center rounded-xl border transition",
                lightMode
                  ? "border-zinc-200 bg-white text-zinc-700 hover:text-zinc-950"
                  : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white",
              ].join(" ")}
              title={lightMode ? "Switch to dark theme" : "Switch to light theme"}
            >
              {lightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            <div className="rounded-full border border-white/10 bg-white/[0.04] p-1">
              <UserButton />
            </div>
          </div>
        </header>

        <main className="dashboard-content relative px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
