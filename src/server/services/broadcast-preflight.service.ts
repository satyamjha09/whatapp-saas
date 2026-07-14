import { prisma } from "@/lib/prisma";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import {
  broadcastDraftDataSchema,
  type BroadcastDraftData,
} from "@/server/validators/broadcast-draft.validator";
import { previewBroadcastAudience } from "@/server/services/broadcast-audience.service";

type PreflightStatus = "PASS" | "WARN" | "FAIL";

export type BroadcastPreflightCheck = {
  id: string;
  label: string;
  message: string;
  status: PreflightStatus;
};

type VariableMapping = {
  customValue?: string | null;
  fallback?: string | null;
  source?: "CONTACT_NAME" | "PHONE_NUMBER" | "CITY" | "SOURCE" | "CUSTOM";
};

function addCheck(
  checks: BroadcastPreflightCheck[],
  check: BroadcastPreflightCheck,
) {
  checks.push(check);
}

function getDraftData(value: unknown): BroadcastDraftData {
  const parsed = broadcastDraftDataSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function getTemplateData(draftData: BroadcastDraftData) {
  const template = draftData.template ?? {};

  return {
    category: template.category?.trim() ?? "",
    language: template.language?.trim() ?? "",
    templateId: template.templateId?.trim() ?? "",
    templateName: template.templateName?.trim() ?? "",
    variables: template.variables ?? [],
  };
}

function getPersonalisationData(draftData: BroadcastDraftData) {
  const personalisation = draftData.personalisation ?? {};
  const mappings = (personalisation.mappings ?? {}) as Record<
    string,
    VariableMapping
  >;

  return { mappings };
}

function isMarketingTemplate(category: string) {
  return category.toUpperCase() === "MARKETING";
}

function hasFallback(mapping: VariableMapping | undefined) {
  return Boolean(mapping?.fallback?.trim());
}

function hasCustomValue(mapping: VariableMapping | undefined) {
  return Boolean(mapping?.customValue?.trim());
}

function estimateThroughputPerMinute(
  phoneNumbers: Array<{ throughput: unknown }>,
) {
  const envValue = Number(process.env.BROADCAST_THROUGHPUT_PER_MINUTE);
  const envThroughput =
    Number.isFinite(envValue) && envValue > 0 ? Math.floor(envValue) : null;

  const metaThroughputs = phoneNumbers
    .map((phoneNumber) => {
      const value = phoneNumber.throughput;
      if (!value || typeof value !== "object") return null;
      const record = value as Record<string, unknown>;
      const raw =
        record.messages_per_second ??
        record.messagesPerSecond ??
        record.max_per_second ??
        record.maxPerSecond;
      const parsed = Number(raw);

      return Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed * 60)
        : null;
    })
    .filter((value): value is number => Boolean(value));

  return {
    isDefault: !envThroughput && metaThroughputs.length === 0,
    perMinute: envThroughput ?? Math.max(...metaThroughputs, 60),
  };
}

export async function runBroadcastDraftPreflight({
  companyId,
  draftId,
}: {
  companyId: string;
  draftId: string;
}) {
  const draft = await prisma.broadcastCampaignDraft.findFirst({
    where: {
      companyId,
      id: draftId,
      status: {
        in: ["DRAFT", "APPROVED", "READY_TO_SEND", "SCHEDULED", "PAUSED"],
      },
    },
  });

  if (!draft) {
    throw new Error("Broadcast draft not found");
  }

  const checks: BroadcastPreflightCheck[] = [];
  const draftData = getDraftData(draft.draftData);
  const templateData = getTemplateData(draftData);
  const personalisation = getPersonalisationData(draftData);
  const audience = draftData.audience ?? {};

  addCheck(checks, {
    id: "CAMPAIGN_SETUP",
    label: "Campaign setup",
    message:
      draft.name.trim().length >= 2
        ? "Campaign name and objective are saved."
        : "Campaign name is missing.",
    status: draft.name.trim().length >= 2 ? "PASS" : "FAIL",
  });

  const audiencePreview = await previewBroadcastAudience({
    companyId,
    filters: {
      city: audience.city ?? null,
      source: audience.source ?? null,
      tag: audience.tag ?? null,
    },
    groupIds: audience.groupIds ?? [],
    requireMarketingConsent:
      isMarketingTemplate(templateData.category) ||
      audience.requireMarketingConsent !== false,
    segmentIds: audience.segmentIds ?? [],
  });

  addCheck(checks, {
    id: "AUDIENCE_ELIGIBLE",
    label: "Audience eligibility",
    message:
      audiencePreview.counts.eligible > 0
        ? `${audiencePreview.counts.eligible.toLocaleString(
            "en-IN",
          )} eligible recipient(s) after exclusions.`
        : "No eligible recipients remain after consent, opt-out, block, duplicate, and phone checks.",
    status: audiencePreview.counts.eligible > 0 ? "PASS" : "FAIL",
  });

  const excludedRecipients =
    audiencePreview.counts.totalMatched - audiencePreview.counts.eligible;

  addCheck(checks, {
    id: "AUDIENCE_EXCLUSIONS",
    label: "Audience exclusions",
    message:
      excludedRecipients > 0
        ? `${excludedRecipients.toLocaleString(
            "en-IN",
          )} matched contact(s) will be skipped safely.`
        : "No matched contacts are being skipped.",
    status: excludedRecipients > 0 ? "WARN" : "PASS",
  });

  const template = templateData.templateId
    ? await prisma.template.findFirst({
        where: {
          companyId,
          id: templateData.templateId,
          status: "APPROVED",
        },
        select: {
          category: true,
          id: true,
          language: true,
          name: true,
          status: true,
          variables: true,
        },
      })
    : null;

  addCheck(checks, {
    id: "APPROVED_TEMPLATE",
    label: "Approved template",
    message: template
      ? `${template.name} (${template.language}) is approved.`
      : "Select an approved WhatsApp template before launch.",
    status: template ? "PASS" : "FAIL",
  });

  const variables = template?.variables ?? templateData.variables;
  const missingMappings = variables.filter((variable) => {
    const mapping = personalisation.mappings[variable];
    if (!mapping) return true;
    if (mapping.source === "CUSTOM") {
      return !hasCustomValue(mapping) && !hasFallback(mapping);
    }
    if (mapping.source === "PHONE_NUMBER") return false;

    return !hasFallback(mapping);
  });

  addCheck(checks, {
    id: "VARIABLE_MAPPING",
    label: "Variable mapping",
    message:
      missingMappings.length === 0
        ? variables.length > 0
          ? "Every template variable has a source and safe fallback."
          : "Template has no variables to map."
        : `Add fallback or custom value for ${missingMappings.join(", ")}.`,
    status: missingMappings.length === 0 ? "PASS" : "FAIL",
  });

  const [wallet, connectedAccounts] = await Promise.all([
    prisma.wallet.findUnique({
      where: { companyId },
      select: { balancePaise: true },
    }),
    prisma.whatsAppAccount.findMany({
      where: {
        companyId,
        status: "CONNECTED",
      },
      select: {
        id: true,
        phoneNumbers: {
          select: {
            id: true,
            phoneNumberId: true,
            throughput: true,
          },
        },
      },
    }),
  ]);

  const eligibleRecipients = audiencePreview.counts.eligible;
  const estimatedCostPaise = eligibleRecipients * MESSAGE_PRICE_PAISE;
  const walletBalancePaise = wallet?.balancePaise ?? 0;

  addCheck(checks, {
    id: "WALLET_BALANCE",
    label: "Wallet balance",
    message:
      walletBalancePaise >= estimatedCostPaise
        ? "Wallet has enough balance for this dry-run estimate."
        : "Wallet balance is lower than the estimated campaign cost.",
    status: walletBalancePaise >= estimatedCostPaise ? "PASS" : "FAIL",
  });

  const phoneNumbers = connectedAccounts.flatMap(
    (account) => account.phoneNumbers,
  );
  addCheck(checks, {
    id: "CONNECTED_NUMBER",
    label: "Connected WhatsApp number",
    message:
      phoneNumbers.length > 0
        ? `${phoneNumbers.length.toLocaleString(
            "en-IN",
          )} connected phone number(s) available.`
        : "Connect a WhatsApp phone number before launching broadcasts.",
    status: phoneNumbers.length > 0 ? "PASS" : "FAIL",
  });

  const throughput = estimateThroughputPerMinute(phoneNumbers);
  const estimatedDurationMinutes =
    eligibleRecipients > 0
      ? Math.max(1, Math.ceil(eligibleRecipients / throughput.perMinute))
      : 0;

  addCheck(checks, {
    id: "THROUGHPUT",
    label: "Throughput estimate",
    message: throughput.isDefault
      ? `Using default ${throughput.perMinute.toLocaleString(
          "en-IN",
        )} messages/minute until Meta throughput is available.`
      : `Estimated throughput is ${throughput.perMinute.toLocaleString(
          "en-IN",
        )} messages/minute.`,
    status: throughput.isDefault ? "WARN" : "PASS",
  });

  const blockers = checks
    .filter((check) => check.status === "FAIL")
    .map((check) => check.message);
  const warnings = checks
    .filter((check) => check.status === "WARN")
    .map((check) => check.message);

  return {
    blockers,
    checks,
    ok: blockers.length === 0,
    summary: {
      eligibleRecipients,
      estimatedCostPaise,
      estimatedDurationMinutes,
      messagePricePaise: MESSAGE_PRICE_PAISE,
      throughputPerMinute: throughput.perMinute,
      walletAfterPaise: walletBalancePaise - estimatedCostPaise,
      walletBalancePaise,
    },
    warnings,
  };
}
