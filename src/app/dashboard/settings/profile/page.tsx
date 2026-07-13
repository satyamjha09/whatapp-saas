import {
  ArrowRight,
  Building2,
  CalendarDays,
  KeyRound,
  Mail,
  Phone,
  Sparkles,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import ProfileForm from "./profile-form";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function userInitial(name: string | null, email: string) {
  return (name?.trim().charAt(0) || email.trim().charAt(0) || "U").toUpperCase();
}

function completionPercent(items: boolean[]) {
  const completed = items.filter(Boolean).length;
  return Math.round((completed / items.length) * 100);
}

function ProfileSummaryCard({
  action,
  emphasized = false,
  icon: Icon,
  label,
  status,
  statusToneValue = "green",
  value,
}: {
  action?: React.ReactNode;
  emphasized?: boolean;
  icon: LucideIcon;
  label: string;
  status?: string;
  statusToneValue?: "green" | "amber" | "blue" | "zinc";
  value: React.ReactNode;
}) {
  return (
    <div
      className={[
        "group rounded-[20px] border bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(8,27,58,0.1)]",
        emphasized
          ? "border-[#9EDFC0] bg-gradient-to-br from-white to-[#E7F8EF]/55"
          : "border-[#BFE9D0]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E7F8EF] text-[#128C7E] ring-1 ring-[#BFE9D0] transition group-hover:bg-[#128C7E] group-hover:text-white">
          <Icon className="h-5 w-5" />
        </div>
        {status ? <StatusPill tone={statusToneValue}>{status}</StatusPill> : null}
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#526173]">
        {label}
      </p>
      <div className="mt-2 min-h-6 text-sm font-bold text-[#081B3A]">
        {value}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export default async function ProfilePage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const user = context.user;
  const membership = context.membership;
  const displayName = user.name ?? "Unnamed user";
  const hasMobile = Boolean(user.mobile);
  const percentComplete = completionPercent([
    Boolean(user.name),
    Boolean(user.email),
    hasMobile,
    Boolean(user.imageUrl),
  ]);

  return (
    <div>
      <section className="mb-6 overflow-hidden rounded-[24px] border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[22px] bg-gradient-to-br from-[#128C7E] to-[#2563EB] text-2xl font-extrabold text-white shadow-[0_16px_32px_rgba(18,140,126,0.22)] ring-4 ring-[#E7F8EF]">
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-20 w-20 object-cover"
                />
              ) : (
                userInitial(user.name, user.email)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
                {membership.company.name}
              </p>
              <h1 className="mt-2 truncate text-3xl font-bold tracking-normal text-[#081B3A]">
                Profile
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
                Manage your personal details, workspace access, and account
                security information.
              </p>
              <div className="mt-4 max-w-md">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-[#081B3A]">
                    Profile {percentComplete}% complete
                  </span>
                  <span className="text-[#526173]">
                    {hasMobile ? "Looks good" : "Add mobile to complete setup"}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#E7F8EF]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#128C7E] to-[#2563EB]"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/settings/team"
              className="inline-flex items-center justify-center rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] px-4 py-2.5 text-sm font-semibold text-[#128C7E] transition hover:border-[#128C7E]/30 hover:bg-[#DDF4E8]"
            >
              <UserRound className="mr-2 h-4 w-4" />
              Team
            </Link>
            <Link
              href="/dashboard/settings/company"
              className="inline-flex items-center justify-center rounded-xl border border-[#B9D9FF] bg-[#EEF6FF] px-4 py-2.5 text-sm font-semibold text-[#2563EB] transition hover:border-[#2563EB]/30 hover:bg-[#E0F0FF]"
            >
              <Building2 className="mr-2 h-4 w-4" />
              Company
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ProfileSummaryCard
          emphasized
          icon={Mail}
          label="Email"
          status="Verified"
          value={
            <p className="truncate">
            {user.email}
            </p>
          }
        />
        <ProfileSummaryCard
          action={
            !hasMobile ? (
              <Link
                href="#personal-details"
                className="inline-flex items-center text-xs font-bold text-[#128C7E] hover:underline"
              >
                Add mobile number
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            ) : null
          }
          icon={Phone}
          label="Mobile"
          status={hasMobile ? "Added" : "Missing"}
          statusToneValue={hasMobile ? "green" : "amber"}
          value={
            <p className="truncate">
              {user.mobile || "Not added"}
            </p>
          }
        />
        <ProfileSummaryCard
          emphasized
          icon={ShieldCheck}
          label="Workspace Role"
          status="Access"
          statusToneValue="blue"
          value={membership.role}
        />
        <ProfileSummaryCard
          icon={CalendarDays}
          label="Joined"
          value={formatDate(user.createdAt)}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#128C7E] text-2xl font-bold text-white">
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                userInitial(user.name, user.email)
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-[#081B3A]">
                {displayName}
              </h2>
              <p className="mt-1 truncate text-sm text-[#526173]">
                {user.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone={statusTone(membership.company.status)}>
                  {membership.company.status.replaceAll("_", " ")}
                </StatusPill>
                <StatusPill tone={statusTone(membership.company.subscriptionStatus)}>
                  {membership.company.subscriptionStatus.replaceAll("_", " ")}
                </StatusPill>
                <StatusPill tone={hasMobile ? "green" : "amber"}>
                  {hasMobile ? "Profile ready" : "Mobile missing"}
                </StatusPill>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
              <p className="text-xs font-semibold uppercase text-[#526173]">
                Company
              </p>
              <p className="mt-2 font-bold text-[#081B3A]">
                {membership.company.name}
              </p>
            </div>
            <div className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
              <p className="text-xs font-semibold uppercase text-[#526173]">
                Plan
              </p>
              <p className="mt-2 font-bold text-[#081B3A]">
                {membership.company.billingPlan}
              </p>
            </div>
          </div>
        </Panel>

        <div id="personal-details" className="scroll-mt-6">
        <Panel>
          <PanelTitle
            title="Personal Details"
            description="Update the name and mobile number shown inside this workspace."
          />
          <div className="mt-6">
            <ProfileForm
              initialName={user.name ?? ""}
              initialMobile={user.mobile ?? ""}
            />
          </div>
        </Panel>
        </div>
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Login & Security"
            description="Authentication is managed by Clerk. Use Clerk account controls for password, email verification, and two-factor authentication."
          />
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#128C7E]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#081B3A]">
                  Password and 2FA
                </p>
                <p className="mt-1 text-sm text-[#526173]">
                  Managed by the sign-in provider for this account.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[#B9D9FF] bg-[#EEF6FF] p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#2563EB]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#081B3A]">
                  Account hygiene
                </p>
                <p className="mt-1 text-sm text-[#526173]">
                  Keep profile information updated so team actions and audit
                  records stay easy to identify.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Account Activity"
            description="Key timestamps for this local workspace profile."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#BFE9D0] p-4">
              <p className="text-xs font-semibold uppercase text-[#526173]">
                Created
              </p>
              <p className="mt-2 font-bold text-[#081B3A]">
                {formatDate(user.createdAt)}
              </p>
            </div>
            <div className="rounded-xl border border-[#BFE9D0] p-4">
              <p className="text-xs font-semibold uppercase text-[#526173]">
                Last Updated
              </p>
              <p className="mt-2 font-bold text-[#081B3A]">
                {formatDate(user.updatedAt)}
              </p>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
