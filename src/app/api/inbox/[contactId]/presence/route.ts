import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import {
  getConversationTyping,
  getConversationViewers,
  heartbeatConversationViewer,
  setConversationTyping,
} from "@/server/realtime/inbox-presence";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";
import { inboxConversationPresenceSchema } from "@/server/validators/inbox-presence.validator";

type InboxConversationPresenceRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveContext(
  request: Request,
  params: InboxConversationPresenceRouteContext["params"],
) {
  const context = await getCurrentWorkspaceContext();

  if (!context?.membership) {
    return {
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const { contactId } = await params;

  try {
    await assertTenantEntityAccess({
      request,
      companyId: context.membership.companyId,
      entityType: "Contact",
      entityId: contactId,
    });
  } catch (error) {
    return { error: createTenantErrorResponse(error) } as const;
  }

  return {
    context,
    companyId: context.membership.companyId,
    contactId,
  } as const;
}

export async function GET(
  request: Request,
  { params }: InboxConversationPresenceRouteContext,
) {
  const resolved = await resolveContext(request, params);

  if ("error" in resolved) return resolved.error;

  const [viewers, typing] = await Promise.all([
    getConversationViewers(resolved.companyId, resolved.contactId),
    getConversationTyping(resolved.companyId, resolved.contactId),
  ]);

  return NextResponse.json({ data: { viewers, typing } });
}

export async function POST(
  request: Request,
  { params }: InboxConversationPresenceRouteContext,
) {
  const resolved = await resolveContext(request, params);

  if ("error" in resolved) return resolved.error;

  const body: unknown = await request.json().catch(() => ({}));
  const validation = inboxConversationPresenceSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        message: "Invalid presence payload",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const tasks: Promise<unknown>[] = [];

  if (validation.data.viewer) {
    tasks.push(
      heartbeatConversationViewer({
        companyId: resolved.companyId,
        contactId: resolved.contactId,
        userId: resolved.context.user.id,
      }),
    );
  }

  if (typeof validation.data.typing === "boolean") {
    tasks.push(
      setConversationTyping({
        companyId: resolved.companyId,
        contactId: resolved.contactId,
        userId: resolved.context.user.id,
        isTyping: validation.data.typing,
      }),
    );
  }

  await Promise.all(tasks);

  return NextResponse.json({ message: "Presence updated" });
}
