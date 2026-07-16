import Link from "next/link";
import { PLATFORM_ROLE_PERMISSIONS } from "@/server/tenant/platform-permissions";
import {
  requirePlatformPermission,
  requirePlatformUser,
} from "@/server/tenant/tenant-context";

function boolLabel(value: boolean) {
  return value ? "Enabled" : "Disabled";
}

function boolClass(value: boolean) {
  return value ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
}

export default async function PlatformSettingsPage() {
  await requirePlatformPermission("PLATFORM_SETTINGS_MANAGE");
  const platform = await requirePlatformUser();

  const settings = [
    {
      label: "Bootstrap access",
      value: process.env.PLATFORM_ADMIN_BOOTSTRAP_ENABLED === "true",
      help: "Allows emergency platform-admin bootstrap based on environment configuration.",
    },
    {
      label: "Production mode",
      value: process.env.NODE_ENV === "production",
      help: "Controls production-only behaviour for runtime and security checks.",
    },
    {
      label: "Clerk configured",
      value: Boolean(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
          process.env.CLERK_SECRET_KEY,
      ),
      help: "Required for production sign-in and platform-user identity.",
    },
    {
      label: "Meta app configured",
      value: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
      help: "Required for WhatsApp Embedded Signup and Cloud API integration.",
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Platform settings
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Console configuration
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review platform access, role permissions, production readiness, and
              where sensitive operational settings are managed.
            </p>
          </div>

          <Link
            href="/platform/users"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            Manage platform users
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {settings.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-black text-slate-950">{item.label}</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${boolClass(
                  item.value,
                )}`}
              >
                {boolLabel(item.value)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.help}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Current platform session
          </h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-600">User</dt>
              <dd className="text-right font-black text-slate-950">
                {platform.user.email}
              </dd>
            </div>
            <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-600">Role</dt>
              <dd className="font-black text-emerald-700">
                {platform.platformRole.replace("_", " ")}
              </dd>
            </div>
            <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-600">Permissions</dt>
              <dd className="font-black text-slate-950">
                {platform.permissions.length}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Sensitive settings policy
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Secrets, payment credentials, Meta app credentials, SMTP settings, and
            production deployment values must stay in environment variables or the
            relevant provider dashboard. This page is intentionally read-only for
            those values.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href="/platform/security"
              className="rounded-xl border border-emerald-200 px-4 py-2 text-center text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              Security center
            </Link>
            <Link
              href="/platform/audit"
              className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Audit trail
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">
            Role permission matrix
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Platform access is controlled by role-scoped permissions.
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          {Object.entries(PLATFORM_ROLE_PERMISSIONS).map(([role, permissions]) => (
            <article
              key={role}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <p className="text-sm font-black text-slate-950">
                {role.replace("_", " ")}
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-700">
                {permissions.length}
              </p>
              <p className="text-xs font-semibold text-slate-500">permissions</p>
              <div className="mt-3 flex max-h-44 flex-col gap-1 overflow-auto pr-1">
                {permissions.length > 0 ? (
                  permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
                    >
                      {permission}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No platform access.</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
