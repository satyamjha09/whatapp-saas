import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  createQuickReply,
  getQuickRepliesByCompany,
} from "@/server/services/quick-reply.service";
import { createQuickReplySchema } from "@/server/validators/quick-reply.validator";

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

    const quickReplies = await getQuickRepliesByCompany(
      context.membership.companyId,
    );

    return NextResponse.json({
      quickReplies,
    });
  } catch (error) {
    console.error("GET_QUICK_REPLIES_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch quick replies" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
    const validation = createQuickReplySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid quick reply",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const quickReply = await createQuickReply(
      context.membership.companyId,
      context.user.id,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.quick_reply.created",
      entityType: "QuickReply",
      entityId: quickReply.id,
      metadata: {
        title: quickReply.title,
      },
    });

    return NextResponse.json(
      {
        message: "Quick reply created successfully",
        quickReply,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_QUICK_REPLY_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "Quick reply with this title already exists"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { message: "Unable to create quick reply" },
      { status: 500 },
    );
  }
}
