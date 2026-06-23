import { prisma } from "@/lib/prisma";

export const SYSTEM_MAINTENANCE_MODE_ID = "global";

export class SystemMaintenanceModeError extends Error {
  constructor(message = "System maintenance mode is enabled") {
    super(message);
    this.name = "SystemMaintenanceModeError";
  }
}

export async function getSystemMaintenanceMode() {
  return prisma.systemMaintenanceMode.upsert({
    where: {
      id: SYSTEM_MAINTENANCE_MODE_ID,
    },
    update: {},
    create: {
      id: SYSTEM_MAINTENANCE_MODE_ID,
      enabled: false,
    },
  });
}

export async function setSystemMaintenanceMode({
  enabled,
  message,
  updatedByUserId,
}: {
  enabled: boolean;
  message?: string | null;
  updatedByUserId?: string | null;
}) {
  const now = new Date();

  return prisma.systemMaintenanceMode.upsert({
    where: {
      id: SYSTEM_MAINTENANCE_MODE_ID,
    },
    update: {
      enabled,
      message: enabled ? message || "System maintenance is in progress." : null,
      updatedByUserId: updatedByUserId ?? null,
      startedAt: enabled ? now : undefined,
      endedAt: enabled ? null : now,
    },
    create: {
      id: SYSTEM_MAINTENANCE_MODE_ID,
      enabled,
      message: enabled ? message || "System maintenance is in progress." : null,
      updatedByUserId: updatedByUserId ?? null,
      startedAt: enabled ? now : null,
      endedAt: enabled ? null : now,
    },
  });
}

export async function assertSystemWritesAllowed({
  operation = "This action",
}: {
  operation?: string;
} = {}) {
  const maintenanceMode = await getSystemMaintenanceMode();

  if (!maintenanceMode.enabled) {
    return;
  }

  throw new SystemMaintenanceModeError(
    `${operation} is temporarily unavailable because system maintenance mode is enabled.`,
  );
}

export async function isSystemMaintenanceModeEnabled() {
  const maintenanceMode = await getSystemMaintenanceMode();

  return maintenanceMode.enabled;
}
