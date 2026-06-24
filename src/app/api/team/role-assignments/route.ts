import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuditLog } from "@/server/services/audit.service";
import { assertUserPermission, assignUserRole } from "@/server/services/rbac-v2.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createPermissionErrorResponse } from "@/server/utils/api-permission-error";

const AssignRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

export async function POST(request: Request) {
  let workspace;
  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    await assertUserPermission({
      companyId: workspace.membership.companyId,
      userId: workspace.user.id,
      permission: "TEAM_MANAGE_ROLES",
    });
  } catch (error) {
    return createPermissionErrorResponse(error);
  }

  const validation = AssignRoleSchema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ ok: false, message: "Invalid role assignment" }, { status: 400 });
  }

  try {
    const assignment = await assignUserRole({
      companyId: workspace.membership.companyId,
      userId: validation.data.userId,
      roleId: validation.data.roleId,
      assignedByUserId: workspace.user.id,
    });
    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "rbac.role_assigned",
      entityType: "CompanyAccessRoleAssignment",
      entityId: assignment.id,
      metadata: { targetUserId: validation.data.userId, roleId: validation.data.roleId },
    });
    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to assign role" },
      { status: 400 },
    );
  }
}
