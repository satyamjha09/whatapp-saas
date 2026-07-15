import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  createInboxSkill,
  listInboxSkills,
} from "@/server/services/inbox-skill.service";
import { createInboxSkillSchema } from "@/server/validators/inbox-skill.validator";

export async function GET(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const skills = await listInboxSkills(context.membership.companyId);
    return NextResponse.json({ skills });
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
    const validation = createInboxSkillSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid skill", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const skill = await createInboxSkill(context.membership.companyId, validation.data);
    return NextResponse.json({ message: "Skill created", skill }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create skill" },
      { status: 400 },
    );
  }
}
