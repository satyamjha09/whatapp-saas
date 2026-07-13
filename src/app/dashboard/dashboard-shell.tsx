"use client";

import {
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ContactRound,
  Gauge,
  LayoutGrid,
  LayoutTemplate,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBag,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  dashboardNavigation,
  type DashboardNavItem,
} from "@/lib/dashboard-navigation";

type DashboardShellProps = {
  children: React.ReactNode;
  companyName: string;
  notificationBadge: React.ReactNode;
  userName: string;
  userRole: string;
};

function userInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

const navigationIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  Dashboard: LayoutGrid,
  "Connected Accounts": ShieldCheck,
  Templates: LayoutTemplate,
  Notifications: Bell,
  "Notification Preferences": Bell,
  Inbox: MessageCircle,
  "Send Message": Send,
  Orders: ShoppingBag,
  Reports: Gauge,
  "Scheduled Items": CalendarClock,
  Analytics: Gauge,
  Automation: Sparkles,
  Money: Wallet,
  Contact: ContactRound,
  "WhatsApp Items": MessageCircle,
  "Integrations & Utilities": Wrench,
  "Workspace Settings": Settings,
  "Production Checklist": ClipboardCheck,
  "WhatsApp Settings": ShieldCheck,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveHref(pathname: string) {
  const links = dashboardNavigation.flatMap((group) => {
    const directLink = group.href
      ? [{ label: group.label, href: group.href }]
      : [];

    return [...directLink, ...(group.items ?? [])];
  });

  return links
    .filter((item) => isActivePath(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
}

function DirectNavLink({
  item,
  icon: Icon,
  collapsed,
  activeHref,
  onNavigate,
}: {
  item: DashboardNavItem;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  activeHref?: string;
  onNavigate?: () => void;
}) {
  const active = activeHref === item.href;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={[
        "group flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition duration-200",
        collapsed ? "justify-center" : "",
        active
          ? "bg-[#E7F8EF] text-[#128C7E] shadow-[inset_3px_0_0_#128C7E]"
          : "text-[#526173] hover:bg-[#E7F8EF] hover:text-[#128C7E]",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-4.5 w-4.5 shrink-0 transition duration-200",
          active ? "text-[#128C7E]" : "text-[#526173] group-hover:text-[#128C7E]",
        ].join(" ")}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function CollapsibleNavGroup({
  activeHref,
  collapsed,
  item,
  onNavigate,
  onToggle,
  open,
}: {
  activeHref?: string;
  collapsed: boolean;
  item: { label: string; items: DashboardNavItem[] };
  onNavigate?: () => void;
  onToggle: () => void;
  open: boolean;
}) {
  const Icon = navigationIcons[item.label] ?? LayoutGrid;
  const active = item.items.some((child) => child.href === activeHref);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? item.label : undefined}
        aria-expanded={open}
        className={[
          "group flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition duration-200",
          collapsed ? "justify-center" : "",
          active
            ? "bg-[#E7F8EF] text-[#128C7E]"
            : "text-[#526173] hover:bg-[#E7F8EF] hover:text-[#128C7E]",
        ].join(" ")}
      >
        <Icon
          className={[
            "h-4.5 w-4.5 shrink-0",
            active ? "text-[#128C7E]" : "text-[#526173] group-hover:text-[#128C7E]",
          ].join(" ")}
        />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate text-left">
              {item.label}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </>
        ) : null}
      </button>

      {!collapsed && open ? (
        <div className="mt-1 space-y-1 border-l border-[#BFE9D0] pl-3 ml-5">
          {item.items.map((child) => {
            const childActive = child.href === activeHref;

            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={[
                  "flex min-h-9 items-center rounded-lg px-3 py-2 text-xs font-medium transition",
                  childActive
                    ? "bg-[#E7F8EF] text-[#128C7E]"
                    : "text-[#526173] hover:bg-[#E7F8EF] hover:text-[#128C7E]",
                ].join(" ")}
              >
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  collapsed,
  companyName,
  userRole,
  activeHref,
  groupOpenOverrides,
  onToggleCollapse,
  onToggleGroup,
  onNavigate,
  mobile = false,
}: {
  collapsed: boolean;
  companyName: string;
  userRole: string;
  activeHref?: string;
  groupOpenOverrides: Record<string, boolean | undefined>;
  onToggleCollapse?: () => void;
  onToggleGroup: (label: string) => void;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-18 items-center justify-between px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-[0_12px_26px_rgba(18,140,126,0.18)] ring-1 ring-[#BFE9D0]">
            <Image
              src="/brand/metawhat-mark.png"
              alt="metawhat logo"
              width={34}
              height={34}
              className="h-8 w-8 object-contain"
              priority
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#081B3A]">
                metawhat
              </p>
              <p className="truncate text-xs text-[#526173]">{companyName}</p>
            </div>
          )}
        </Link>

        {mobile ? null : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden h-9 w-9 place-items-center rounded-lg border border-[#BFE9D0] bg-white text-[#526173] transition hover:border-[#128C7E]/30 hover:bg-[#E7F8EF] hover:text-[#128C7E] xl:grid"
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
            Workspace
          </p>
        )}
        <nav className="space-y-1">
          {dashboardNavigation.map((item) => {
            const Icon = navigationIcons[item.label] ?? LayoutGrid;

            if (item.href) {
              return (
                <DirectNavLink
                  key={item.href}
                  item={{ label: item.label, href: item.href }}
                  icon={Icon}
                  collapsed={collapsed}
                  activeHref={activeHref}
                  onNavigate={onNavigate}
                />
              );
            }

            if (item.items) {
              return (
                <CollapsibleNavGroup
                  key={item.label}
                  item={{ label: item.label, items: item.items }}
                  collapsed={collapsed}
                  activeHref={activeHref}
                  open={
                    groupOpenOverrides[item.label] ??
                    item.items.some((child) => child.href === activeHref)
                  }
                  onToggle={() => onToggleGroup(item.label)}
                  onNavigate={onNavigate}
                />
              );
            }

            return null;
          })}
        </nav>
      </div>

      <div className="border-t border-[#BFE9D0] p-3">
        <div
          className={[
            "rounded-xl border border-[#BFE9D0] bg-[#E7F8EF]",
            collapsed ? "p-2" : "p-3",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#128C7E]">
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
  notificationBadge,
  userName,
  userRole,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groupOpenOverrides, setGroupOpenOverrides] = useState<
    Record<string, boolean | undefined>
  >({});
  const activeHref = useMemo(() => getActiveHref(pathname), [pathname]);

  const pageTitle = useMemo(() => {
    for (const group of dashboardNavigation) {
      if (group.href === activeHref) return group.label;

      const activeItem = group.items?.find((item) => item.href === activeHref);
      if (activeItem) return activeItem.label;
    }

    return "Dashboard";
  }, [activeHref]);

  function toggleGroup(label: string) {
    const activeByDefault = dashboardNavigation
      .find((group) => group.label === label)
      ?.items?.some((item) => item.href === activeHref);

    setGroupOpenOverrides((current) => {
      const currentlyOpen = current[label] ?? Boolean(activeByDefault);
      const nextOpenState: Record<string, boolean | undefined> = {};

      for (const group of dashboardNavigation) {
        if (group.items) {
          nextOpenState[group.label] = false;
        }
      }

      return {
        ...nextOpenState,
        [label]: !currentlyOpen,
      };
    });
  }

  return (
    <div className="min-h-screen bg-[#E7F8EF] text-[#102040]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,#E7F8EF,#FFFFFF_48%,rgba(191,233,208,0.62))]" />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 hidden border-r border-[#BFE9D0] bg-white/95 shadow-[6px_0_30px_rgba(8,27,58,0.06)] backdrop-blur-xl transition-[width] duration-300 md:block",
          collapsed ? "w-20" : "w-20 xl:w-64",
        ].join(" ")}
      >
        <SidebarContent
          collapsed={collapsed}
          companyName={companyName}
          userRole={userRole}
          activeHref={activeHref}
          groupOpenOverrides={groupOpenOverrides}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onToggleGroup={toggleGroup}
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
          <div className="absolute inset-y-0 left-0 w-[min(86vw,320px)] border-r border-[#BFE9D0] bg-white shadow-2xl">
            <div className="absolute right-3 top-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#BFE9D0] text-[#526173]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              mobile
              collapsed={false}
              companyName={companyName}
              userRole={userRole}
              activeHref={activeHref}
              groupOpenOverrides={groupOpenOverrides}
              onToggleGroup={toggleGroup}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div
        className={[
          "relative min-w-0 overflow-x-hidden transition-[padding] duration-300",
          collapsed ? "md:pl-20" : "md:pl-20 xl:pl-64",
        ].join(" ")}
      >
        <header className="sticky top-0 z-20 border-b border-[#BFE9D0] bg-white/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#BFE9D0] text-[#526173] transition hover:bg-[#E7F8EF] md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-[#526173]">
                <span>{companyName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-[#128C7E]" />
                <span>{pageTitle ?? "Dashboard"}</span>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-[#102040]">
                Welcome back, {userName}
              </p>
            </div>

            <div className="hidden h-10 min-w-[280px] items-center gap-3 rounded-lg border border-[#BFE9D0] bg-white px-3 text-[#102040] transition focus-within:border-[#128C7E]/40 focus-within:ring-4 focus-within:ring-[#128C7E]/10 lg:flex">
              <Search className="h-4 w-4 text-[#526173]/70" />
              <input
                aria-label="Search"
                placeholder="Search contacts, campaigns, messages..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#526173]/60"
              />
              <kbd className="rounded-md border border-[#BFE9D0] px-1.5 py-0.5 text-[10px] text-[#526173]/70">
                /
              </kbd>
            </div>

            {notificationBadge}

            <Link
              href="/dashboard/settings/profile"
              className="flex items-center gap-3 rounded-full border border-[#BFE9D0] bg-white py-1 pl-1 pr-3 transition hover:bg-[#E7F8EF]"
              title="Open profile settings"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-sm font-bold text-white">
                {userInitial(userName)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-32 truncate text-sm font-bold text-[#081B3A]">
                  {userName}
                </span>
                <span className="block text-xs uppercase text-[#526173]">
                  {userRole}
                </span>
              </span>
            </Link>
          </div>
        </header>

        <main className="dashboard-content relative min-w-0 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto w-full max-w-[1480px] min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
