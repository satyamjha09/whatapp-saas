import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  listInboxQueueMembers,
  removeInboxQueueMember,
  upsertInboxQueueMember,
} from "@/server/services/inbox-queue.service";
import { inboxQueueMemberSchema } from "@/server/validators/inbox-queue.validator";

type QueueMembersRouteContext = {
  params: Promise<{ queueId: string }>;
};

export async function GET(request: Request, { params }: QueueMembersRouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const { queueId } = await params;
    const members = await listInboxQueueMembers(context.membership.companyId, queueId);

    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return createRoutePermissionErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: QueueMembersRouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const body: unknown = await request.json();
    const validation = inboxQueueMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid member", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { queueId } = await params;
    const member = await upsertInboxQueueMember(
      context.membership.companyId,
      queueId,
      validation.data,
    );

    return NextResponse.json({ message: "Queue member saved", member });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to save member" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, { params }: QueueMembersRouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const { queueId } = await params;
    const userId = new URL(request.url).searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    const member = await removeInboxQueueMember(
      context.membership.companyId,
      queueId,
      userId,
    );

    return NextResponse.json({ message: "Queue member removed", member });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to remove member" },
      { status: 400 },
    );
  }
}
