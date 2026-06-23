import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import {
  getSystemMaintenanceMode,
  setSystemMaintenanceMode,
} from "@/server/services/system-maintenance-mode.service";
import { updateSystemMaintenanceModeSchema } from "@/server/validators/system-maintenance-mode.validator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    const maintenanceMode = await getSystemMaintenanceMode();

    return NextResponse.json({
      maintenanceMode,
    });
  } catch (error) {
    console.error("GET_SYSTEM_MAINTENANCE_MODE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to load maintenance mode" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    if (context.membership.role !== "OWNER") {
      return NextResponse.json(
        { message: "Only owners can change maintenance mode" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = updateSystemMaintenanceModeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid maintenance mode request",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const maintenanceMode = await setSystemMaintenanceMode({
      enabled: validation.data.enabled,
      message: validation.data.message,
      updatedByUserId: context.user.id,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: validation.data.enabled
        ? "system.maintenance_mode.enabled"
        : "system.maintenance_mode.disabled",
      entityType: "SystemMaintenanceMode",
      entityId: maintenanceMode.id,
      metadata: {
        enabled: maintenanceMode.enabled,
        message: maintenanceMode.message,
      },
    });

    await createCompanyNotification({
      companyId: context.membership.companyId,
      type: "SYSTEM",
      severity: validation.data.enabled ? "WARNING" : "SUCCESS",
      title: validation.data.enabled
        ? "Maintenance mode enabled"
        : "Maintenance mode disabled",
      message: validation.data.enabled
        ? maintenanceMode.message || "System maintenance is in progress."
        : "System maintenance has ended.",
      actionHref: "/dashboard/system/health",
      idempotencyKey: `maintenance-mode:${
        validation.data.enabled ? "enabled" : "disabled"
      }:${new Date().toISOString().slice(0, 10)}:${new Date().getHours()}`,
      metadata: {
        enabled: maintenanceMode.enabled,
        startedAt: maintenanceMode.startedAt,
        endedAt: maintenanceMode.endedAt,
      },
    });

    return NextResponse.json({
      message: validation.data.enabled
        ? "Maintenance mode enabled"
        : "Maintenance mode disabled",
      maintenanceMode,
    });
  } catch (error) {
    console.error("UPDATE_SYSTEM_MAINTENANCE_MODE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to update maintenance mode" },
      { status: 500 },
    );
  }
}
