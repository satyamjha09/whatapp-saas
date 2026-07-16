"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlatformRole } from "@/generated/prisma/client";
import {
  PLATFORM_NAVIGATION,
  type PlatformNavigationItem,
} from "@/app/platform/platform-navigation";
import type { PlatformPermission } from "@/server/tenant/platform-permissions";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PlatformShell({
  children,
  permissions,
  role,
  userEmail,
}: {
  children: React.ReactNode;
  permissions: readonly PlatformPermission[];
  role: PlatformRole;
  userEmail: string;
}) {
  const pathname = usePathname();
  const navigation = PLATFORM_NAVIGATION.filter((item: PlatformNavigationItem) =>
    permissions.includes(item.permission),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-slate-950/95 px-5 py-6 lg:block">
        <Link href="/platform/overview" className="block">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">
            MetaWhat
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
            Platform Console
          </h1>
        </Link>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Signed in
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-white">
            {userEmail}
          </p>
          <span className="mt-3 inline-flex rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
            {role.replace("_", " ")}
          </span>
        </div>

        <nav className="mt-6 space-y-1">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 text-slate-950 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Internal operations
              </p>
              <p className="text-lg font-black text-slate-950">
                Platform control plane
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              Back to workspace
            </Link>
          </div>
        </header>

        <div className="min-h-[calc(100vh-73px)] bg-gradient-to-br from-slate-50 via-white to-emerald-50 text-slate-950">
          {children}
        </div>
      </div>
    </div>
  );
}
