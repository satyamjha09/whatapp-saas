import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { removeContactFromGroup } from "@/server/services/contact-group.service";

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ groupId: string; memberId: string }> },
) {
  try {
    const { groupId, memberId } = await params;
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
        { message: "Only owners and admins can remove group members" },
        { status: 403 },
      );
    }

    const result = await removeContactFromGroup(
      context.membership.companyId,
      groupId,
      memberId,
    );
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "contact_group.member.removed",
      entityType: "ContactGroup",
      entityId: groupId,
      metadata: { memberId },
    });

    return NextResponse.json({
      message: "Contact removed from group successfully",
      result,
    });
  } catch (error) {
    console.error("REMOVE_CONTACT_FROM_GROUP_ERROR:", error);
    if (error instanceof Error && error.message === "Group member not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { message: "Unable to remove contact from group" },
      { status: 500 },
    );
  }
}
