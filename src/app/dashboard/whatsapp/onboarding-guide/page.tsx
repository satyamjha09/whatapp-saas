import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

const onboardingSteps = [
  {
    title: "Open the official Meta flow",
    description:
      "Use Login with Facebook from metawhat. Meta opens a hosted popup for consent and WhatsApp onboarding.",
  },
  {
    title: "Select business assets",
    description:
      "Choose or create a Business Portfolio, then choose or create the WhatsApp Business Account.",
  },
  {
    title: "Confirm business information",
    description:
      "Meta asks for business name, category, country, website, and time zone for new assets.",
  },
  {
    title: "Add or select phone number",
    description:
      "Use an eligible existing phone, use display-name-only where available, or add and verify a new phone number.",
  },
  {
    title: "Review access and confirm",
    description:
      "The customer confirms WhatsApp permissions. metawhat then saves WABA ID, phone ID, encrypted token, and webhook subscription.",
  },
  {
    title: "Finish production checks",
    description:
      "Sync templates, check number status, complete payment or business verification if Meta requests it, then start sending.",
  },
];

const importantPoints = [
  "The user connecting WhatsApp should be an admin of the selected Meta Business Portfolio.",
  "The phone number must be eligible for WhatsApp Cloud API onboarding or migration.",
  "The display name should match the business and follow Meta display-name rules.",
  "Allow popups and third-party cookies for the browser session before clicking Login with Facebook.",
  "If Meta requests business or display-name verification, sending limits can remain restricted until review is complete.",
  "Only approved WhatsApp templates should be used for campaigns, automation, and business-initiated messages.",
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
        description="Use this checklist to connect any customer company to WhatsApp Cloud API through Meta Embedded Signup."
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
          Customer Connection Flow
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
        <h2 className="text-lg font-bold text-[#081B3A]">
          Production Readiness
        </h2>

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
