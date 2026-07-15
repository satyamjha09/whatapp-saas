import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  deleteInboxSkill,
  updateInboxSkill,
} from "@/server/services/inbox-skill.service";
import { updateInboxSkillSchema } from "@/server/validators/inbox-skill.validator";

type SkillRouteContext = {
  params: Promise<{ skillId: string }>;
};

export async function PATCH(request: Request, { params }: SkillRouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const body: unknown = await request.json();
    const validation = updateInboxSkillSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid skill", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { skillId } = await params;
    const skill = await updateInboxSkill(
      context.membership.companyId,
      skillId,
      validation.data,
    );

    return NextResponse.json({ message: "Skill updated", skill });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update skill" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, { params }: SkillRouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const { skillId } = await params;
    const skill = await deleteInboxSkill(context.membership.companyId, skillId);

    return NextResponse.json({ message: "Skill deleted", skill });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to delete skill" },
      { status: 400 },
    );
  }
}
