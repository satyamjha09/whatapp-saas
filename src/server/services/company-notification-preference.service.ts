import type {
  CompanyNotificationSeverity,
  CompanyNotificationType,
} from "@/generated/prisma/enums";
import {
  NOTIFICATION_SEVERITY_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
} from "@/lib/notification-preferences";
import { prisma } from "@/lib/prisma";

export { NOTIFICATION_SEVERITY_OPTIONS, NOTIFICATION_TYPE_OPTIONS };

const severityRank: Record<CompanyNotificationSeverity, number> = {
  INFO: 1,
  SUCCESS: 2,
  WARNING: 3,
  ERROR: 4,
};

export function isSeverityAllowed({
  notificationSeverity,
  minimumSeverity,
}: {
  notificationSeverity: CompanyNotificationSeverity;
  minimumSeverity: CompanyNotificationSeverity;
}) {
  return severityRank[notificationSeverity] >= severityRank[minimumSeverity];
}

export async function ensureCompanyNotificationPreferences({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  await prisma.companyNotificationPreference.createMany({
    data: NOTIFICATION_TYPE_OPTIONS.map((option) => ({
      companyId,
      userId,
      type: option.type,
      inAppEnabled: true,
      minimumSeverity: "INFO" as CompanyNotificationSeverity,
      emailEnabled: false,
      emailMinimumSeverity: "ERROR" as CompanyNotificationSeverity,
    })),
    skipDuplicates: true,
  });
}

export async function getCompanyNotificationPreferences({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  await ensureCompanyNotificationPreferences({ companyId, userId });

  return prisma.companyNotificationPreference.findMany({
    where: { companyId, userId },
    orderBy: { type: "asc" },
  });
}

export async function updateCompanyNotificationPreference({
  companyId,
  userId,
  type,
  inAppEnabled,
  minimumSeverity,
  emailEnabled,
  emailMinimumSeverity,
}: {
  companyId: string;
  userId: string;
  type: CompanyNotificationType;
  inAppEnabled: boolean;
  minimumSeverity: CompanyNotificationSeverity;
  emailEnabled: boolean;
  emailMinimumSeverity: CompanyNotificationSeverity;
}) {
  return prisma.companyNotificationPreference.upsert({
    where: {
      companyId_userId_type: { companyId, userId, type },
    },
    update: {
      inAppEnabled,
      minimumSeverity,
      emailEnabled,
      emailMinimumSeverity,
    },
    create: {
      companyId,
      userId,
      type,
      inAppEnabled,
      minimumSeverity,
      emailEnabled,
      emailMinimumSeverity,
    },
  });
}

export async function shouldSendEmailForNotification({
  companyId,
  userId,
  type,
  severity,
}: {
  companyId: string;
  userId: string;
  type: CompanyNotificationType;
  severity: CompanyNotificationSeverity;
}) {
  await ensureCompanyNotificationPreferences({ companyId, userId });

  const preference = await prisma.companyNotificationPreference.findUnique({
    where: {
      companyId_userId_type: { companyId, userId, type },
    },
  });

  if (!preference) return false;
  if (!preference.emailEnabled) return false;

  return isSeverityAllowed({
    notificationSeverity: severity,
    minimumSeverity: preference.emailMinimumSeverity,
  });
}

export async function shouldCreateRecipientForNotification({
  companyId,
  userId,
  type,
  severity,
}: {
  companyId: string;
  userId: string;
  type: CompanyNotificationType;
  severity: CompanyNotificationSeverity;
}) {
  await ensureCompanyNotificationPreferences({ companyId, userId });

  const preference = await prisma.companyNotificationPreference.findUnique({
    where: {
      companyId_userId_type: { companyId, userId, type },
    },
  });

  if (!preference) return true;
  if (!preference.inAppEnabled) return false;

  return isSeverityAllowed({
    notificationSeverity: severity,
    minimumSeverity: preference.minimumSeverity,
  });
}
