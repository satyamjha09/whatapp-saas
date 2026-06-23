import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  getSecurityEventById,
  resolveSecurityEvent,
} from "@/server/services/security-event.service";

export const dynamic = "force-dynamic";

const resolveSecurityEventSchema = z.object({
  resolutionNote: z.string().max(1000).optional(),
});

type RouteParams = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
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
        { message: "Only owners and admins can resolve security events" },
        { status: 403 },
      );
    }

    const { eventId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = resolveSecurityEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Invalid request",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const existingEvent = await getSecurityEventById({ eventId });

    if (!existingEvent) {
      return NextResponse.json(
        { message: "Security event not found" },
        { status: 404 },
      );
    }

    if (existingEvent.resolvedAt) {
      return NextResponse.json({
        message: "Security event is already resolved",
      });
    }

    const event = await resolveSecurityEvent({
      eventId,
      resolvedByUserId: context.user.id,
      resolutionNote: parsed.data.resolutionNote,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "security_event.resolved",
      entityType: "SecurityEvent",
      entityId: event.id,
      metadata: {
        type: event.type,
        severity: event.severity,
        summary: event.summary,
        resolutionNote: event.resolutionNote,
      },
    });

    return NextResponse.json({
      message: "Security event resolved",
      event,
    });
  } catch (error) {
    console.error("RESOLVE_SECURITY_EVENT_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to resolve security event" },
      { status: 500 },
    );
  }
}
