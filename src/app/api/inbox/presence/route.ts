import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getCompanyAgentPresence,
  setAgentAvailability,
} from "@/server/realtime/inbox-presence";
import { inboxPresenceHeartbeatSchema } from "@/server/validators/inbox-presence.validator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const context = await getCurrentWorkspaceContext();

  if (!context?.membership) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const presence = await getCompanyAgentPresence(context.membership.companyId);

  return NextResponse.json({ data: presence });
}

export async function POST(request: Request) {
  const context = await getCurrentWorkspaceContext();

  if (!context?.membership) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const validation = inboxPresenceHeartbeatSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        message: "Invalid presence payload",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const presence = await setAgentAvailability({
    companyId: context.membership.companyId,
    userId: context.user.id,
    status: validation.data.status,
    activeContactId: validation.data.activeContactId,
  });

  return NextResponse.json({ data: presence });
}
