import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

const onboardingSteps = [
  {
    title: "Connect Phone Number",
    description:
      "Connect a new or existing WhatsApp Business phone number through Meta Embedded Signup.",
  },
  {
    title: "Pre-Paid Wallet",
    description:
      "Keep wallet/payment setup ready so Cloud API messages can be sent without billing interruptions.",
  },
  {
    title: "Business Verification",
    description:
      "Complete Meta business verification when required to unlock production usage and higher trust.",
  },
  {
    title: "Create a Template",
    description:
      "Create and submit WhatsApp message templates for approval before sending campaign messages.",
  },
];

const importantPoints = [
  "Use a new phone number that is not registered on any WhatsApp account.",
  "Alternatively, use a phone number that is already on an existing WhatsApp Business account.",
  "International payments must be activated on your credit/debit card to send messages via Cloud API.",
  "Use an older Facebook account to avoid lengthy Meta verification processes for new accounts.",
];

export default async function WhatsAppOnboardingGuidePage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Onboarding Guide"
        description="Follow these steps before sending WhatsApp Cloud API messages."
        actions={
          <>
            <Link
              href="/dashboard/whatsapp"
              className={actionButtonClass("secondary")}
            >
              Connected Accounts
            </Link>
            <a
              href="https://developers.facebook.com/docs/whatsapp/embedded-signup"
              target="_blank"
              rel="noreferrer"
              className={actionButtonClass()}
            >
              Meta Docs
            </a>
          </>
        }
      />

      <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
        <h2 className="text-lg font-bold text-[#081B3A]">
          WhatsApp Account Setup
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {onboardingSteps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-[#BFE9D0] p-5"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#128C7E] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-[#081B3A]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#526173]">
                    {step.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
        <h2 className="text-lg font-bold text-[#081B3A]">Important Points</h2>

        <ul className="mt-5 space-y-3">
          {importantPoints.map((point) => (
            <li key={point} className="flex gap-3 text-sm text-[#102040]">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#128C7E]" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
