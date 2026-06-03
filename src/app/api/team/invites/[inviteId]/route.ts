import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { revokeCompanyInvite } from "@/server/services/invite.service";

type RevokeInviteRouteContext = {
  params: Promise<{
    inviteId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  { params }: RevokeInviteRouteContext,
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

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "You do not have permission to revoke invites" },
        { status: 403 },
      );
    }

    const { inviteId } = await params;

    const invite = await revokeCompanyInvite(
      context.membership.companyId,
      inviteId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "team.invite.revoked",
      entityType: "CompanyInvite",
      entityId: invite.id,
      metadata: {
        email: invite.email,
        role: invite.role,
      },
    });

    return NextResponse.json({
      message: "Invite revoked successfully",
      invite,
    });
  } catch (error) {
    console.error("REVOKE_INVITE_ERROR:", error);

    if (
      error instanceof Error &&
      ["Invite not found", "Only pending invites can be revoked"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to revoke invite" },
      { status: 500 },
    );
  }
}
