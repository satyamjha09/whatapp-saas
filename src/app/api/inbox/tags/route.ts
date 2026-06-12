import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  createInboxTag,
  getInboxTagsByCompany,
} from "@/server/services/inbox-tag.service";
import { createInboxTagSchema } from "@/server/validators/inbox-tag.validator";

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

    const tags = await getInboxTagsByCompany(context.membership.companyId);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("GET_INBOX_TAGS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch inbox tags" },
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
    const validation = createInboxTagSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid tag",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const tag = await createInboxTag(
      context.membership.companyId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.tag.created",
      entityType: "InboxTag",
      entityId: tag.id,
      metadata: {
        name: tag.name,
        color: tag.color,
      },
    });

    return NextResponse.json(
      {
        message: "Tag created successfully",
        tag,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_INBOX_TAG_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "Tag with this name already exists"
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to create tag" },
      { status: 500 },
    );
  }
}
