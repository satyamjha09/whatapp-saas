import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { removeCompanyMember } from "@/server/services/team.service";

type RemoveMemberRouteContext = {
  params: Promise<{
    companyUserId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  { params }: RemoveMemberRouteContext,
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
        { message: "Only owner can remove team members" },
        { status: 403 },
      );
    }

    const { companyUserId } = await params;

    const member = await removeCompanyMember({
      companyId: context.membership.companyId,
      companyUserId,
      currentUserId: context.user.id,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "team.member.removed",
      entityType: "CompanyUser",
      entityId: member.id,
      metadata: {
        memberEmail: member.user.email,
        role: member.role,
      },
    });

    return NextResponse.json({
      message: "Team member removed successfully",
      member,
    });
  } catch (error) {
    console.error("REMOVE_TEAM_MEMBER_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Team member not found",
        "You cannot remove yourself",
        "Company must have at least one owner",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to remove team member" },
      { status: 500 },
    );
  }
}
