import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { markConversationAsRead } from "@/server/services/inbox.service";

type MarkConversationReadRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: MarkConversationReadRouteContext,
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

    const { contactId } = await params;

    const result = await markConversationAsRead(
      context.membership.companyId,
      contactId,
    );

    return NextResponse.json({
      message: "Conversation marked as read",
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("MARK_CONVERSATION_READ_ERROR:", error);

    if (error instanceof Error && error.message === "Contact not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to mark conversation as read" },
      { status: 500 },
    );
  }
}
