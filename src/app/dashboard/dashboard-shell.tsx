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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
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
  { label: "WhatsApp", href: "/dashboard/whatsapp", icon: ShieldCheck },
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
        "group flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition duration-200",
        collapsed ? "justify-center" : "",
        active
          ? "bg-[#F0F8FF] text-[#0052CC] shadow-[inset_3px_0_0_#0052CC]"
          : "text-[#526173] hover:bg-[#F0F8FF] hover:text-[#0052CC]",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-4.5 w-4.5 shrink-0 transition duration-200",
          active ? "text-[#0052CC]" : "text-[#526173] group-hover:text-[#0052CC]",
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
      <div className="flex h-18 items-center justify-between px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0052CC] text-white shadow-[0_12px_26px_rgba(0,82,204,0.22)]">
            <Sparkles className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#081B3A]">
                TallyKonnect
              </p>
              <p className="truncate text-xs text-[#526173]">{companyName}</p>
            </div>
          )}
        </Link>

        {mobile ? null : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden h-9 w-9 place-items-center rounded-lg border border-[#D8E6F3] bg-white text-[#526173] transition hover:border-[#0052CC]/30 hover:bg-[#F0F8FF] hover:text-[#0052CC] xl:grid"
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
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-normal text-[#526173]/70">
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

        <div className="my-5 h-px bg-[#D8E6F3]" />

        {!collapsed && (
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-normal text-[#526173]/70">
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

      <div className="border-t border-[#D8E6F3] p-3">
        <div
          className={[
            "rounded-xl border border-[#D8E6F3] bg-[#F0F8FF]",
            collapsed ? "p-2" : "p-3",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#0052CC]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#102040]">
                  {userRole}
                </p>
                <p className="truncate text-[11px] text-[#526173]">
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

  const pageTitle = useMemo(() => {
    const allItems = [...mainNavItems, ...secondaryNavItems];
    return allItems.find((item) => isActivePath(pathname, item.href))?.label;
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#F0F8FF] text-[#102040]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,#F0F8FF,#FFFFFF_48%,rgba(216,230,243,0.55))]" />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 hidden border-r border-[#D8E6F3] bg-white/95 shadow-[6px_0_30px_rgba(8,27,58,0.06)] backdrop-blur-xl transition-[width] duration-300 md:block",
          collapsed ? "w-20" : "w-20 xl:w-64",
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
            className="absolute inset-0 bg-[#081B3A]/45 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(86vw,320px)] border-r border-[#D8E6F3] bg-white shadow-2xl">
            <div className="absolute right-3 top-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#D8E6F3] text-[#526173]"
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
          collapsed ? "md:pl-20" : "md:pl-20 xl:pl-64",
        ].join(" ")}
      >
        <header className="sticky top-0 z-20 border-b border-[#D8E6F3] bg-white/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#D8E6F3] text-[#526173] transition hover:bg-[#F0F8FF] md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-[#526173]">
                <span>{companyName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-[#0052CC]" />
                <span>{pageTitle ?? "Dashboard"}</span>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-[#102040]">
                Welcome back, {userName}
              </p>
            </div>

            <div className="hidden h-10 min-w-[280px] items-center gap-3 rounded-lg border border-[#D8E6F3] bg-white px-3 text-[#102040] transition focus-within:border-[#0052CC]/40 focus-within:ring-4 focus-within:ring-[#0052CC]/10 lg:flex">
              <Search className="h-4 w-4 text-[#526173]/70" />
              <input
                aria-label="Search"
                placeholder="Search contacts, campaigns, messages..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#526173]/60"
              />
              <kbd className="rounded-md border border-[#D8E6F3] px-1.5 py-0.5 text-[10px] text-[#526173]/70">
                /
              </kbd>
            </div>

            <button
              type="button"
              className="relative grid h-10 w-10 place-items-center rounded-lg border border-[#D8E6F3] bg-white text-[#526173] transition hover:bg-[#F0F8FF] hover:text-[#0052CC]"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#F8C830] ring-2 ring-white" />
            </button>

            <div className="rounded-full border border-[#D8E6F3] bg-white p-1">
              <UserButton />
            </div>
          </div>
        </header>

        <main className="dashboard-content relative px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
