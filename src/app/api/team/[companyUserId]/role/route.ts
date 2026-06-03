import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { updateCompanyMemberRole } from "@/server/services/team.service";
import { updateMemberRoleSchema } from "@/server/validators/team.validator";

type UpdateMemberRoleRouteContext = {
  params: Promise<{
    companyUserId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: UpdateMemberRoleRouteContext,
) {
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

    if (context.membership.role !== "OWNER") {
      return NextResponse.json(
        { message: "Only owner can update team roles" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    const validation = updateMemberRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid role",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { companyUserId } = await params;

    const member = await updateCompanyMemberRole({
      companyId: context.membership.companyId,
      companyUserId,
      currentUserId: context.user.id,
      input: validation.data,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "team.member.role_updated",
      entityType: "CompanyUser",
      entityId: member.id,
      metadata: {
        memberEmail: member.user.email,
        newRole: member.role,
      },
    });

    return NextResponse.json({
      message: "Team member role updated successfully",
      member,
    });
  } catch (error) {
    console.error("UPDATE_TEAM_ROLE_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Team member not found",
        "You cannot change your own role",
        "Company must have at least one owner",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to update team role" },
      { status: 500 },
    );
  }
}
