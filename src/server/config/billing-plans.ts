import type { BillingPlan } from "@/generated/prisma/client";

export type BillingFeature =
  | "SINGLE_MESSAGES"
  | "BULK_CAMPAIGNS"
  | "CONTACT_GROUPS"
  | "DEVELOPER_API"
  | "DEVELOPER_WEBHOOKS"
  | "ADVANCED_REPORTS";

export type BillingPlanConfig = {
  id: BillingPlan;
  name: string;
  description: string;
  monthlyPricePaise: number;
  monthlyMessageLimit: number;
  maxBulkRecipients: number;
  maxTeamMembers: number;
  teamMemberLimit: number;
  templateLimit: number;
  campaignLimit: number;
  developerApiAccess: boolean;
  developerWebhookAccess: boolean;
  developerApiDailyLimit: number;
  developerLogRetentionDays: number;
  enabledFeatures: BillingFeature[];
  features: string[];
};

export const BILLING_PLANS: BillingPlanConfig[] = [
  {
    id: "FREE",
    name: "Free",
    description: "For testing your WhatsApp setup.",
    monthlyPricePaise: 0,
    monthlyMessageLimit: 100,
    maxBulkRecipients: 50,
    maxTeamMembers: 1,
    teamMemberLimit: 1,
    templateLimit: 3,
    campaignLimit: 1,
    developerApiAccess: false,
    developerWebhookAccess: false,
    developerApiDailyLimit: 0,
    developerLogRetentionDays: 7,
    enabledFeatures: ["SINGLE_MESSAGES"],
    features: ["Basic inbox", "Single message sending", "Manual credits"],
  },
  {
    id: "STARTER",
    name: "Starter",
    description: "For small businesses starting WhatsApp campaigns.",
    monthlyPricePaise: 99_900,
    monthlyMessageLimit: 1_000,
    maxBulkRecipients: 500,
    maxTeamMembers: 3,
    teamMemberLimit: 3,
    templateLimit: 10,
    campaignLimit: 5,
    developerApiAccess: false,
    developerWebhookAccess: false,
    developerApiDailyLimit: 0,
    developerLogRetentionDays: 7,
    enabledFeatures: ["SINGLE_MESSAGES", "BULK_CAMPAIGNS", "CONTACT_GROUPS"],
    features: ["Bulk campaigns", "Contact groups", "Campaign reports"],
  },
  {
    id: "GROWTH",
    name: "Growth",
    description: "For growing teams sending regular campaigns.",
    monthlyPricePaise: 299_900,
    monthlyMessageLimit: 5_000,
    maxBulkRecipients: 2_000,
    maxTeamMembers: 10,
    teamMemberLimit: 10,
    templateLimit: 50,
    campaignLimit: 50,
    developerApiAccess: true,
    developerWebhookAccess: true,
    developerApiDailyLimit: 1_000,
    developerLogRetentionDays: 30,
    enabledFeatures: [
      "SINGLE_MESSAGES",
      "BULK_CAMPAIGNS",
      "CONTACT_GROUPS",
      "DEVELOPER_API",
      "DEVELOPER_WEBHOOKS",
      "ADVANCED_REPORTS",
    ],
    features: ["Advanced reports", "Opt-out automation", "Developer webhooks"],
  },
  {
    id: "BUSINESS",
    name: "Business",
    description: "For high-volume WhatsApp operations.",
    monthlyPricePaise: 999_900,
    monthlyMessageLimit: 25_000,
    maxBulkRecipients: 10_000,
    maxTeamMembers: 25,
    teamMemberLimit: 25,
    templateLimit: 200,
    campaignLimit: 500,
    developerApiAccess: true,
    developerWebhookAccess: true,
    developerApiDailyLimit: 10_000,
    developerLogRetentionDays: 90,
    enabledFeatures: [
      "SINGLE_MESSAGES",
      "BULK_CAMPAIGNS",
      "CONTACT_GROUPS",
      "DEVELOPER_API",
      "DEVELOPER_WEBHOOKS",
      "ADVANCED_REPORTS",
    ],
    features: ["Large campaigns", "Priority-ready inbox", "Advanced billing controls"],
  },
];

export const billingPlans = Object.fromEntries(
  BILLING_PLANS.map((plan) => [plan.id, plan]),
) as Record<BillingPlan, BillingPlanConfig>;

export function getBillingPlanConfig(plan: BillingPlan | string) {
  const config = BILLING_PLANS.find((item) => item.id === plan);

  if (!config) throw new Error("Invalid billing plan");

  return config;
}

export function formatPlanPrice(amountPaise: number) {
  if (amountPaise === 0) return "Free";

  return `${new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountPaise / 100)}/month`;
}

export function canUseDeveloperApi(plan: BillingPlan | string) {
  return getBillingPlanConfig(plan).enabledFeatures.includes("DEVELOPER_API");
}

export function canUseDeveloperWebhooks(plan: BillingPlan | string) {
  return getBillingPlanConfig(plan).enabledFeatures.includes(
    "DEVELOPER_WEBHOOKS",
  );
}
