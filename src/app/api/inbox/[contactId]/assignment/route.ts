import { InboxAssignmentSource } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assignConversation,
  assignConversationToBestAgent,
} from "@/server/services/inbox-assignment.service";
import { assignConversationSchema } from "@/server/validators/inbox-assignment.validator";

type InboxAssignmentRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: InboxAssignmentRouteContext,
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
    const validation = assignConversationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid assignment",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { contactId } = await params;
    const input = validation.data;
    const source = input.source ?? InboxAssignmentSource.MANUAL;
    const contact =
      input.queueId && !input.assignedToUserId && input.assignmentMode
        ? await assignConversationToBestAgent({
            actorUserId: context.user.id,
            assignmentMode: input.assignmentMode,
            companyId: context.membership.companyId,
            contactId,
            queueId: input.queueId,
            reason: input.reason,
            requiredSkillIds: input.requiredSkillIds,
            source,
          })
        : await assignConversation({
            actorUserId: context.user.id,
            assignedToUserId: input.assignedToUserId,
            companyId: context.membership.companyId,
            contactId,
            queueId: input.queueId,
            reason: input.reason,
            source,
          });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("ASSIGN_INBOX_CONVERSATION_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Assigned user is not a member of this company",
        "Assigned user is not an active member of this queue",
        "Contact not found",
        "Conversation assignment changed. Please retry.",
        "Disabled queue cannot receive new conversations",
        "Queue not found",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to assign conversation" },
      { status: 500 },
    );
  }
}
