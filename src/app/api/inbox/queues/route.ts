import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  createInboxQueue,
  listInboxQueues,
} from "@/server/services/inbox-queue.service";
import { createInboxQueueSchema } from "@/server/validators/inbox-queue.validator";

export async function GET(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const queues = await listInboxQueues(context.membership.companyId);
    return NextResponse.json({ queues });
  } catch (error) {
    return createRoutePermissionErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const body: unknown = await request.json();
    const validation = createInboxQueueSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid queue", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const queue = await createInboxQueue(context.membership.companyId, validation.data);
    return NextResponse.json({ message: "Queue created", queue }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Unable to create queue" }, { status: 500 });
  }
}
