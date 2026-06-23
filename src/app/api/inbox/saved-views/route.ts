import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  createInboxSavedView,
  listInboxSavedViews,
} from "@/server/services/inbox-saved-view.service";

const createSavedViewSchema = z.object({
  name: z.string().min(1).max(100),
  visibility: z.enum(["PRIVATE", "COMPANY"]).default("PRIVATE"),
  filters: z.record(z.string(), z.unknown()).default({}),
  sortBy: z.string().max(100).default("recent"),
  isDefault: z.boolean().default(false),
});

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

    const views = await listInboxSavedViews({
      companyId: context.membership.companyId,
      userId: context.user.id,
    });

    return NextResponse.json({
      views,
    });
  } catch (error) {
    console.error("LIST_INBOX_SAVED_VIEWS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to load saved views" },
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
    const validation = createSavedViewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid saved view",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const view = await createInboxSavedView({
      companyId: context.membership.companyId,
      userId: context.user.id,
      ...validation.data,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.saved_view_created",
      entityType: "InboxSavedView",
      entityId: view.id,
      metadata: {
        name: view.name,
        visibility: view.visibility,
      },
    });

    return NextResponse.json(
      {
        message: "Saved view created successfully",
        view,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_INBOX_SAVED_VIEW_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to create saved view" },
      { status: 500 },
    );
  }
}
