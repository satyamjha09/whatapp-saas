import { Check } from "lucide-react";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { getPlanPricePaise } from "@/server/services/plan-upgrade.service";
import { UpgradePlanButton } from "../upgrade-plan-button";

function formatRupees(paise: number) {
  return `Rs ${(paise / 100).toLocaleString("en-IN")}`;
}

export default async function UpgradeBillingPage() {
  const context = await requireAuthenticatedWorkspace();
  const currentPlan = context.membership.company.billingPlan;
  const plans = [
    {
      plan: "STARTER" as const,
      title: "Starter",
      description: "For small teams starting WhatsApp CRM.",
      features: [
        "1,000 monthly messages",
        "Campaigns",
        "Basic analytics",
        "3 team members",
      ],
    },
    {
      plan: "GROWTH" as const,
      title: "Growth",
      description: "For growing businesses and agencies.",
      features: [
        "10,000 monthly messages",
        "Developer API",
        "Webhooks",
        "RBAC",
        "Status page",
      ],
    },
    {
      plan: "BUSINESS" as const,
      title: "Business",
      description: "For high-volume teams and enterprise workflows.",
      features: [
        "50,000 monthly messages",
        "System operations",
        "Compliance exports",
        "Unlimited scale options",
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Upgrade Plan
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Current plan: <strong>{currentPlan}</strong>
        </p>
      </div>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {plans.map((item) => {
          const price = getPlanPricePaise(item.plan);
          const isCurrent = currentPlan === item.plan;

          return (
            <article
              key={item.plan}
              className="rounded-lg border bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              <p className="mt-5 text-3xl font-bold text-gray-900">
                {formatRupees(price)}
                <span className="text-base font-medium text-gray-500">
                  {" "}
                  / month
                </span>
              </p>

              <ul className="mt-5 space-y-2 text-sm text-gray-700">
                {item.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-green-700" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg border px-4 py-2 text-sm font-semibold text-gray-500"
                  >
                    Current Plan
                  </button>
                ) : (
                  <UpgradePlanButton
                    toPlan={item.plan}
                    label={`Upgrade to ${item.title}`}
                  />
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
