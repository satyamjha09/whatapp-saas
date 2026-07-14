import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  launchScheduledBroadcastDraft,
} from "@/server/services/broadcast-launch-control.service";
import {
  broadcastDraftDataSchema,
  type BroadcastDraftData,
} from "@/server/validators/broadcast-draft.validator";

type SchedulerResult = {
  due: number;
  errors: Array<{ draftId: string; message: string }>;
  launched: number;
  skipped: number;
};

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getDraftData(value: unknown): BroadcastDraftData {
  const parsed = broadcastDraftDataSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone || "Asia/Kolkata",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  return hour * 60 + minute;
}

function timeToMinutes(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function isInsideBusinessHours(draftData: BroadcastDraftData, now: Date) {
  const schedule = asRecord(draftData.schedule);
  if (schedule.businessHoursOnly !== true) return true;

  const start = timeToMinutes(schedule.businessHoursStart);
  const end = timeToMinutes(schedule.businessHoursEnd);
  if (start === null || end === null) return true;

  const timezone =
    typeof schedule.timezone === "string" ? schedule.timezone : "Asia/Kolkata";
  const current = minutesInTimezone(now, timezone);

  if (start <= end) {
    return current >= start && current <= end;
  }

  return current >= start || current <= end;
}

async function markScheduledDraftPaused({
  draftData,
  draftId,
  message,
}: {
  draftData: BroadcastDraftData;
  draftId: string;
  message: string;
}) {
  const launch = asRecord((draftData as Record<string, unknown>).launch);
  const history = Array.isArray(launch.history) ? launch.history : [];

  await prisma.broadcastCampaignDraft.update({
    where: { id: draftId },
    data: {
      draftData: safeJson({
        ...draftData,
        launch: {
          ...launch,
          history: [
            ...history,
            {
              at: new Date().toISOString(),
              event: "SCHEDULER_PAUSED",
              message,
            },
          ],
          schedulerError: message,
        },
      }),
      status: "PAUSED",
    },
  });
}

export async function processDueBroadcastSchedules({
  limit = 25,
  now = new Date(),
}: {
  limit?: number;
  now?: Date;
} = {}): Promise<SchedulerResult> {
  const drafts = await prisma.broadcastCampaignDraft.findMany({
    where: { status: "SCHEDULED" },
    orderBy: { updatedAt: "asc" },
    take: Math.max(limit * 4, limit),
    select: {
      companyId: true,
      draftData: true,
      id: true,
    },
  });

  const result: SchedulerResult = {
    due: 0,
    errors: [],
    launched: 0,
    skipped: 0,
  };

  for (const draft of drafts) {
    if (result.launched >= limit) break;

    const draftData = getDraftData(draft.draftData);
    const schedule = asRecord(draftData.schedule);
    const scheduledAt = parseDate(schedule.scheduledAt);

    if (!scheduledAt || scheduledAt.getTime() > now.getTime()) {
      result.skipped += 1;
      continue;
    }

    if (!isInsideBusinessHours(draftData, now)) {
      result.skipped += 1;
      continue;
    }

    result.due += 1;

    try {
      await launchScheduledBroadcastDraft({
        companyId: draft.companyId,
        draftId: draft.id,
        now,
      });
      result.launched += 1;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to launch scheduled broadcast.";
      result.errors.push({ draftId: draft.id, message });
      await markScheduledDraftPaused({
        draftData,
        draftId: draft.id,
        message,
      });
    }
  }

  return result;
}
