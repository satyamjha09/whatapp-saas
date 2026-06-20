export const billingPlans = {
  FREE: {
    name: "Free",
    monthlyMessageLimit: 100,
    teamMemberLimit: 1,
    templateLimit: 3,
    campaignLimit: 1,
    developerApiAccess: false,
    developerWebhookAccess: false,
  },
  STARTER: {
    name: "Starter",
    monthlyMessageLimit: 1_000,
    teamMemberLimit: 3,
    templateLimit: 10,
    campaignLimit: 5,
    developerApiAccess: false,
    developerWebhookAccess: true,
  },
  PRO: {
    name: "Pro",
    monthlyMessageLimit: 10_000,
    teamMemberLimit: 10,
    templateLimit: 50,
    campaignLimit: 50,
    developerApiAccess: true,
    developerWebhookAccess: true,
  },
  BUSINESS: {
    name: "Business",
    monthlyMessageLimit: 50_000,
    teamMemberLimit: 50,
    templateLimit: 200,
    campaignLimit: 500,
    developerApiAccess: true,
    developerWebhookAccess: true,
  },
} as const;

export type BillingPlan = keyof typeof billingPlans;

export function getBillingPlanConfig(plan: string) {
  return billingPlans[plan as BillingPlan] ?? billingPlans.FREE;
}

export function canUseDeveloperApi(plan: string) {
  return getBillingPlanConfig(plan).developerApiAccess;
}

export function canUseDeveloperWebhooks(plan: string) {
  return getBillingPlanConfig(plan).developerWebhookAccess;
}
