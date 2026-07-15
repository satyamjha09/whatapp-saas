import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  disableInboxQueue,
  updateInboxQueue,
} from "@/server/services/inbox-queue.service";
import { updateInboxQueueSchema } from "@/server/validators/inbox-queue.validator";

type QueueRouteContext = {
  params: Promise<{ queueId: string }>;
};

export async function PATCH(request: Request, { params }: QueueRouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const body: unknown = await request.json();
    const validation = updateInboxQueueSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid queue", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { queueId } = await params;
    const queue = await updateInboxQueue(
      context.membership.companyId,
      queueId,
      validation.data,
    );

    return NextResponse.json({ message: "Queue updated", queue });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update queue" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, { params }: QueueRouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const { queueId } = await params;
    const queue = await disableInboxQueue(context.membership.companyId, queueId);

    return NextResponse.json({ message: "Queue disabled", queue });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to disable queue" },
      { status: 400 },
    );
  }
}
