import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  forceReleaseProductionOperationLock,
  getActiveProductionOperationLock,
} from "@/server/services/production-operation-lock.service";

export const dynamic = "force-dynamic";

export async function POST() {
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
        { message: "Only owners can release production operation locks" },
        { status: 403 },
      );
    }

    const existingLock = await getActiveProductionOperationLock();

    if (!existingLock) {
      return NextResponse.json({
        message: "No production operation lock is active",
      });
    }

    await forceReleaseProductionOperationLock();

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "system.production_operation_lock.force_released",
      entityType: "ProductionOperationLock",
      entityId: existingLock.id,
      metadata: {
        operationType: existingLock.operationType,
        lockOwner: existingLock.lockOwner,
        lockedAt: existingLock.lockedAt,
        expiresAt: existingLock.expiresAt,
        wasExpired: existingLock.isExpired,
      },
    });

    return NextResponse.json({
      message: "Production operation lock released",
    });
  } catch (error) {
    console.error("FORCE_RELEASE_OPERATION_LOCK_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to release production operation lock" },
      { status: 500 },
    );
  }
}
