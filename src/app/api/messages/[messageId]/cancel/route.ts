import { NextResponse } from "next/server";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { cancelScheduledSingleMessage } from "@/server/services/scheduled-single-message.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { messageId } = await params;
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

    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can cancel scheduled messages" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    await assertSystemWritesAllowed({
      operation: "Canceling scheduled messages",
    });

    const result = await cancelScheduledSingleMessage(
      context.membership.companyId,
      messageId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "message.scheduled.canceled",
      entityType: "Message",
      entityId: messageId,
      metadata: result,
    });

    return NextResponse.json({
      message: "Scheduled message canceled successfully",
      result,
    });
  } catch (error) {
    console.error("CANCEL_SCHEDULED_SINGLE_MESSAGE_ERROR:", error);

    if (error instanceof SystemMaintenanceModeError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (
      error instanceof Error &&
      [
        "Message not found",
        "Only queued scheduled messages can be canceled",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to cancel scheduled message" },
      { status: 500 },
    );
  }
}
