import { Prisma } from "@/generated/prisma/client";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import {
  resolveBroadcastAudience,
  type BroadcastAudienceContact,
} from "@/server/services/broadcast-audience.service";
import { runBroadcastDraftPreflight } from "@/server/services/broadcast-preflight.service";
import { confirmAndQueueCampaignLaunch } from "@/server/services/campaign-launch-orchestrator.service";
import {
  broadcastDraftDataSchema,
  type BroadcastDraftData,
  type BroadcastLaunchControlInput,
} from "@/server/validators/broadcast-draft.validator";
import { getBroadcastApprovalStatus } from "@/server/services/broadcast-collaboration.service";

type LaunchStatus =
  | "DRAFT"
  | "APPROVED"
  | "READY_TO_SEND"
  | "SCHEDULED"
  | "PAUSED"
  | "CANCELED"
  | "LAUNCHED";

type VariableMapping = {
  customValue?: string | null;
  fallback?: string | null;
  source?: "CONTACT_NAME" | "PHONE_NUMBER" | "CITY" | "SOURCE" | "CUSTOM";
};

function getDraftData(value: unknown): BroadcastDraftData {
  const parsed = broadcastDraftDataSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseFutureDate(value?: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ensureLaunchableStatus(status: string) {
  if (["READY_TO_SEND", "SCHEDULED", "PAUSED", "LAUNCHED"].includes(status)) {
    throw new Error(
      "This broadcast already has launch controls. Use pause, resume, or cancel instead.",
    );
  }

  if (status === "CANCELED") {
    throw new Error("Canceled broadcasts cannot be launched again.");
  }

  if (status === "SUBMITTED_FOR_APPROVAL") {
    throw new Error("This broadcast is waiting for approval.");
  }

  if (status === "REJECTED") {
    throw new Error(
      "Rejected broadcasts must be edited and resubmitted before launch.",
    );
  }
}

function appendHistory(
  draftData: BroadcastDraftData,
  event: Record<string, unknown>,
) {
  const launch = asRecord((draftData as Record<string, unknown>).launch);
  const currentHistory = Array.isArray(launch.history)
    ? (launch.history as unknown[])
    : [];

  return [...currentHistory, event];
}

function cloneDraftDataForNewCampaign(draftData: BroadcastDraftData) {
  const cloned = {
    ...draftData,
    launch: undefined,
  } as Record<string, unknown>;
  const schedule = asRecord(draftData.schedule);

  cloned.schedule = {
    ...schedule,
    scheduledAt: null,
    sendMode: "NOW",
  };

  delete cloned.launch;

  return cloned;
}

function templateCategory(value?: string | null) {
  return value === "MARKETING" ||
    value === "UTILITY" ||
    value === "AUTHENTICATION"
    ? value
    : "UTILITY";
}

function getMappingValue(
  contact: BroadcastAudienceContact,
  mapping: VariableMapping | undefined,
) {
  if (!mapping) return "";

  const mappedValue =
    mapping.source === "CUSTOM"
      ? mapping.customValue
      : mapping.source === "PHONE_NUMBER"
        ? contact.normalizedPhone
        : mapping.source === "CITY"
          ? contact.city
          : mapping.source === "SOURCE"
            ? contact.source
            : contact.name;

  return String(mappedValue || mapping.fallback || "").trim();
}

function maskPhone(phone: string) {
  return `${"*".repeat(Math.max(phone.length - 4, 0))}${phone.slice(-4)}`;
}

async function createAndQueueRuntimeLaunch(input: {
  actorUserId?: string | null;
  companyId: string;
  draft: {
    createdByUserId: string | null;
    id: string;
    name: string;
    objective: string;
  };
  draftData: BroadcastDraftData;
  idempotencyKey: string;
  preflight: Awaited<ReturnType<typeof runBroadcastDraftPreflight>>;
}) {
  const templateData = asRecord(input.draftData.template);
  const personalisation = asRecord(input.draftData.personalisation);
  const audience = asRecord(input.draftData.audience);
  const templateId = String(templateData.templateId || "");

  if (!templateId) {
    throw new Error("Select an approved template before launching.");
  }

  const template = await prisma.template.findFirst({
    where: {
      companyId: input.companyId,
      id: templateId,
      status: "APPROVED",
    },
    select: {
      body: true,
      category: true,
      id: true,
      language: true,
      name: true,
      variables: true,
    },
  });

  if (!template) {
    throw new Error("Selected template is no longer approved.");
  }

  const mappings = asRecord(personalisation.mappings) as Record<
    string,
    VariableMapping
  >;
  const resolution = await resolveBroadcastAudience({
    companyId: input.companyId,
    filters: {
      city: typeof audience.city === "string" ? audience.city : null,
      source: typeof audience.source === "string" ? audience.source : null,
      tag: typeof audience.tag === "string" ? audience.tag : null,
    },
    groupIds: Array.isArray(audience.groupIds)
      ? audience.groupIds.filter((id): id is string => typeof id === "string")
      : [],
    requireMarketingConsent:
      templateCategory(template.category) === "MARKETING" ||
      audience.requireMarketingConsent !== false,
    segmentIds: Array.isArray(audience.segmentIds)
      ? audience.segmentIds.filter((id): id is string => typeof id === "string")
      : [],
  });

  if (resolution.eligibleContacts.length === 0) {
    throw new Error("No eligible recipients remain for launch.");
  }

  const runtime = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        companyId: input.companyId,
        name: input.draft.name,
        status: "DRAFT",
        templateId: template.id,
        totalContacts: resolution.eligibleContacts.length,
        variables: template.variables,
      },
    });

    const launchRun = await tx.campaignLaunchRun.create({
      data: {
        campaignId: campaign.id,
        companyId: input.companyId,
        createdByUserId: input.actorUserId ?? input.draft.createdByUserId,
        dryRunId: `broadcast-draft:${input.draft.id}`,
        estimatedCostPaise:
          input.preflight.summary.estimatedCostPaise ||
          resolution.eligibleContacts.length * MESSAGE_PRICE_PAISE,
        idempotencyKey: input.idempotencyKey,
        metadata: safeJson({
          broadcastDraftId: input.draft.id,
          duplicatePhones: resolution.duplicatePhones,
          duplicateSelections: resolution.duplicateSelections,
          objective: input.draft.objective,
          source: "broadcast_wizard",
          totalMatched: resolution.totalMatched,
        }),
        skippedRecipients:
          resolution.blocked +
          resolution.invalidPhone +
          resolution.missingConsent +
          resolution.optedOut +
          resolution.duplicatePhones,
        status: "DRY_RUN_CREATED",
        templateBody: template.body,
        templateCategory: template.category,
        templateId: template.id,
        templateLanguage: template.language,
        templateName: template.name,
        totalRecipients: resolution.totalMatched,
        validRecipients: resolution.eligibleContacts.length,
      },
    });

    await tx.campaignLaunchRecipient.createMany({
      data: resolution.eligibleContacts.map((contact) => {
        const bodyParameters = template.variables.map((variable) =>
          getMappingValue(contact, mappings[variable]),
        );

        return {
          bodyParameters: safeJson(bodyParameters),
          campaignId: campaign.id,
          companyId: input.companyId,
          contactId: contact.id,
          launchRunId: launchRun.id,
          phoneLast4: contact.normalizedPhone.slice(-4),
          phoneMasked: maskPhone(contact.normalizedPhone),
          renderedPreview: template.body,
          status: "PLANNED" as const,
          variables: safeJson(
            Object.fromEntries(
              template.variables.map((variable, index) => [
                variable,
                bodyParameters[index] ?? "",
              ]),
            ),
          ),
        };
      }),
    });

    await tx.broadcastCampaignDraft.update({
      where: { id: input.draft.id },
      data: {
        status: "LAUNCHED",
      },
    });

    return { campaign, launchRun };
  });

  await confirmAndQueueCampaignLaunch({
    actorUserId: input.actorUserId,
    companyId: input.companyId,
    launchRunId: runtime.launchRun.id,
  });

  return runtime;
}

export async function requestBroadcastLaunch({
  actorUserId,
  companyId,
  draftId,
  input,
}: {
  actorUserId?: string | null;
  companyId: string;
  draftId: string;
  input: BroadcastLaunchControlInput;
}) {
  const draft = await prisma.broadcastCampaignDraft.findFirst({
    where: { companyId, id: draftId },
  });

  if (!draft) throw new Error("Broadcast draft not found");
  ensureLaunchableStatus(draft.status);

  const preflight = await runBroadcastDraftPreflight({ companyId, draftId });
  if (!preflight.ok) {
    throw new Error("Fix dry-run blockers before launching this broadcast.");
  }

  const draftData = getDraftData(draft.draftData);
  const approvalStatus = getBroadcastApprovalStatus(draftData);

  if (approvalStatus === "SUBMITTED_FOR_APPROVAL") {
    throw new Error("This broadcast is waiting for approval.");
  }

  if (approvalStatus === "REJECTED") {
    throw new Error(
      "Rejected broadcasts must be edited and resubmitted before launch.",
    );
  }

  if (approvalStatus !== "APPROVED") {
    throw new Error("Approve this broadcast before launching.");
  }

  const isScheduled = input.action === "SCHEDULE_LATER";
  const scheduledAt = parseFutureDate(input.schedule?.scheduledAt);

  if (isScheduled && !scheduledAt) {
    throw new Error("Choose a valid future date and time before scheduling.");
  }

  if (scheduledAt && scheduledAt.getTime() <= Date.now() + 60_000) {
    throw new Error("Scheduled time must be at least one minute in the future.");
  }

  const nextStatus: LaunchStatus = isScheduled ? "SCHEDULED" : "READY_TO_SEND";
  const scheduleSendMode = isScheduled ? "SCHEDULED" : "NOW";
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    `broadcast-launch:${draftId}:${nextStatus}`;
  const history = appendHistory(draftData, {
    actorUserId: actorUserId ?? null,
    at: new Date().toISOString(),
    event: nextStatus,
  });
  const nextSchedule: NonNullable<BroadcastDraftData["schedule"]> = {
    ...asRecord(draftData.schedule),
    businessHoursEnd: input.schedule?.businessHoursEnd ?? null,
    businessHoursOnly: input.schedule?.businessHoursOnly ?? false,
    businessHoursStart: input.schedule?.businessHoursStart ?? null,
    recipientTimezoneScheduling:
      input.schedule?.recipientTimezoneScheduling ?? false,
    recurring: input.schedule?.recurring,
    scheduledAt: scheduledAt?.toISOString() ?? null,
    sendMode: scheduleSendMode,
    timezone: input.schedule?.timezone || "Asia/Kolkata",
  };

  const nextDraftData = {
    ...draftData,
    launch: {
      action: input.action,
      businessHoursEnd: input.schedule?.businessHoursEnd ?? null,
      businessHoursOnly: input.schedule?.businessHoursOnly ?? false,
      businessHoursStart: input.schedule?.businessHoursStart ?? null,
      history,
      idempotencyKey,
      preflightSnapshot: preflight,
      recipientTimezoneScheduling:
        input.schedule?.recipientTimezoneScheduling ?? false,
      requestedAt: new Date().toISOString(),
      requestedByUserId: actorUserId ?? null,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      timezone: input.schedule?.timezone || "Asia/Kolkata",
    },
    schedule: nextSchedule,
  };

  const updatedDraft = await prisma.broadcastCampaignDraft.update({
    where: { id: draft.id },
    data: {
      draftData: safeJson(nextDraftData),
      status: nextStatus,
    },
  });

  if (!isScheduled) {
    const runtime = await createAndQueueRuntimeLaunch({
      actorUserId,
      companyId,
      draft,
      draftData: nextDraftData,
      idempotencyKey,
      preflight,
    });
    const launchedDraft =
      (await prisma.broadcastCampaignDraft.findUnique({
        where: { id: draft.id },
      })) ?? updatedDraft;

    return {
      campaign: runtime.campaign,
      draft: launchedDraft,
      launchRun: runtime.launchRun,
      preflight,
    };
  }

  return { draft: updatedDraft, preflight };
}

export async function launchScheduledBroadcastDraft({
  actorUserId = null,
  companyId,
  draftId,
  now = new Date(),
}: {
  actorUserId?: string | null;
  companyId: string;
  draftId: string;
  now?: Date;
}) {
  const draft = await prisma.broadcastCampaignDraft.findFirst({
    where: { companyId, id: draftId, status: "SCHEDULED" },
  });

  if (!draft) throw new Error("Scheduled broadcast draft not found");

  const draftData = getDraftData(draft.draftData);
  const schedule = asRecord(draftData.schedule);
  const scheduledAt = parseFutureDate(
    typeof schedule.scheduledAt === "string" ? schedule.scheduledAt : null,
  );

  if (!scheduledAt) {
    throw new Error("Scheduled broadcast is missing a valid scheduled time.");
  }

  if (scheduledAt.getTime() > now.getTime()) {
    throw new Error("Scheduled broadcast is not due yet.");
  }

  const preflight = await runBroadcastDraftPreflight({ companyId, draftId });
  if (!preflight.ok) {
    throw new Error("Fix dry-run blockers before launching this broadcast.");
  }

  const launch = asRecord((draftData as Record<string, unknown>).launch);
  const existingIdempotencyKey =
    typeof launch.idempotencyKey === "string"
      ? launch.idempotencyKey.trim()
      : "";
  const idempotencyKey =
    existingIdempotencyKey ||
    `broadcast-scheduled:${draftId}:${scheduledAt.toISOString()}`;

  return createAndQueueRuntimeLaunch({
    actorUserId,
    companyId,
    draft,
    draftData,
    idempotencyKey,
    preflight,
  });
}

export async function updateBroadcastLaunchControl({
  actorUserId,
  action,
  companyId,
  draftId,
}: {
  actorUserId?: string | null;
  action: "PAUSE" | "RESUME" | "CANCEL";
  companyId: string;
  draftId: string;
}) {
  const draft = await prisma.broadcastCampaignDraft.findFirst({
    where: { companyId, id: draftId },
  });

  if (!draft) throw new Error("Broadcast draft not found");

  if (
    action === "PAUSE" &&
    !["READY_TO_SEND", "SCHEDULED"].includes(draft.status)
  ) {
    throw new Error("Only ready or scheduled broadcasts can be paused.");
  }

  if (action === "RESUME" && draft.status !== "PAUSED") {
    throw new Error("Only paused broadcasts can be resumed.");
  }

  if (
    action === "CANCEL" &&
    !["READY_TO_SEND", "SCHEDULED", "PAUSED"].includes(draft.status)
  ) {
    throw new Error(
      "Only ready, scheduled, or paused broadcasts can be canceled.",
    );
  }

  const draftData = getDraftData(draft.draftData);
  const launch = asRecord((draftData as Record<string, unknown>).launch);
  const previousStatus =
    typeof launch.previousStatus === "string"
      ? launch.previousStatus
      : "SCHEDULED";
  const nextStatus: LaunchStatus =
    action === "PAUSE"
      ? "PAUSED"
      : action === "CANCEL"
        ? "CANCELED"
        : previousStatus === "READY_TO_SEND"
          ? "READY_TO_SEND"
          : "SCHEDULED";
  const history = appendHistory(draftData, {
    actorUserId: actorUserId ?? null,
    at: new Date().toISOString(),
    event: action,
    fromStatus: draft.status,
    toStatus: nextStatus,
  });

  const nextDraftData = {
    ...draftData,
    launch: {
      ...launch,
      canceledAt:
        action === "CANCEL" ? new Date().toISOString() : launch.canceledAt,
      history,
      pausedAt: action === "PAUSE" ? new Date().toISOString() : launch.pausedAt,
      previousStatus: action === "PAUSE" ? draft.status : launch.previousStatus,
      resumedAt:
        action === "RESUME" ? new Date().toISOString() : launch.resumedAt,
    },
  };

  const updatedDraft = await prisma.broadcastCampaignDraft.update({
    where: { id: draft.id },
    data: {
      draftData: safeJson(nextDraftData),
      status: nextStatus,
    },
  });

  return { draft: updatedDraft };
}

export async function cloneBroadcastDraft({
  actorUserId,
  companyId,
  draftId,
}: {
  actorUserId?: string | null;
  companyId: string;
  draftId: string;
}) {
  const draft = await prisma.broadcastCampaignDraft.findFirst({
    where: { companyId, id: draftId },
  });

  if (!draft) throw new Error("Broadcast draft not found");

  const draftData = getDraftData(draft.draftData);
  const clonedDraft = await prisma.broadcastCampaignDraft.create({
    data: {
      companyId,
      createdByUserId: actorUserId ?? draft.createdByUserId,
      currentStep: Math.min(Math.max(draft.currentStep, 1), 6),
      draftData: safeJson(cloneDraftDataForNewCampaign(draftData)),
      name: `${draft.name} copy`.slice(0, 100),
      objective: draft.objective,
      status: "DRAFT",
    },
  });

  return { draft: clonedDraft };
}
