import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  getSecurityEventById,
  reopenSecurityEvent,
} from "@/server/services/security-event.service";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteParams) {
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

    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can reopen security events" },
        { status: 403 },
      );
    }

    const { eventId } = await params;
    const existingEvent = await getSecurityEventById({ eventId });

    if (!existingEvent) {
      return NextResponse.json(
        { message: "Security event not found" },
        { status: 404 },
      );
    }

    const event = await reopenSecurityEvent({ eventId });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "security_event.reopened",
      entityType: "SecurityEvent",
      entityId: event.id,
      metadata: {
        type: event.type,
        severity: event.severity,
        summary: event.summary,
      },
    });

    return NextResponse.json({
      message: "Security event reopened",
      event,
    });
  } catch (error) {
    console.error("REOPEN_SECURITY_EVENT_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to reopen security event" },
      { status: 500 },
    );
  }
}
