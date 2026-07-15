import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { routeConversation } from "@/server/services/inbox-routing.service";
import { routeConversationSchema } from "@/server/validators/inbox-assignment.validator";

type InboxRouteConversationRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: InboxRouteConversationRouteContext,
) {
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

    const body: unknown = await request.json();
    const validation = routeConversationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid routing request",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { contactId } = await params;
    const contact = await routeConversation({
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      contactId,
      handoffReason: validation.data.handoffReason,
      inboundText: validation.data.inboundText,
      metadata:
        validation.data.metadata !== undefined
          ? (validation.data.metadata as Prisma.InputJsonValue)
          : undefined,
      requestedQueueId: validation.data.requestedQueueId,
    });

    return NextResponse.json({
      contact,
      routed: Boolean(contact),
    });
  } catch (error) {
    console.error("ROUTE_INBOX_CONVERSATION_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Contact not found",
        "Disabled queue cannot receive new conversations",
        "Queue not found",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to route conversation" },
      { status: 500 },
    );
  }
}
