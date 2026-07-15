import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  assignInboxAgentSkill,
  listInboxAgentProfiles,
  upsertInboxAgentProfile,
} from "@/server/services/inbox-agent.service";
import {
  assignInboxAgentSkillSchema,
  upsertInboxAgentProfileSchema,
} from "@/server/validators/inbox-agent.validator";

export async function GET(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const agents = await listInboxAgentProfiles(context.membership.companyId);
    return NextResponse.json({ agents });
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
    const mode =
      body && typeof body === "object" && "skillId" in body ? "skill" : "profile";

    if (mode === "skill") {
      const validation = assignInboxAgentSkillSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { message: "Invalid skill assignment", errors: validation.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      const agentSkill = await assignInboxAgentSkill(
        context.membership.companyId,
        validation.data,
      );
      return NextResponse.json({ message: "Agent skill saved", agentSkill });
    }

    const validation = upsertInboxAgentProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid agent profile", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const profile = await upsertInboxAgentProfile(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json({ message: "Agent profile saved", profile });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to save agent" },
      { status: 400 },
    );
  }
}
