import { NextResponse } from "next/server";
import { z } from "zod";
import { RbacPermission } from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuditLog } from "@/server/services/audit.service";
import {
  assertUserPermission,
  createCompanyRole,
  listCompanyRoles,
} from "@/server/services/rbac-v2.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createPermissionErrorResponse } from "@/server/utils/api-permission-error";

const CreateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).optional().nullable(),
  permissions: z.array(z.enum(RbacPermission)).default([]),
});

async function authorize(request: Request, permission: RbacPermission) {
  const workspace = await requireAdmin({ request });
  await assertUserPermission({
    companyId: workspace.membership.companyId,
    userId: workspace.user.id,
    permission,
  });
  return workspace;
}

export async function GET(request: Request) {
  let workspace;
  try {
    workspace = await authorize(request, "TEAM_VIEW");
  } catch (error) {
    try {
      return createAuthorizationErrorResponse(error);
    } catch {
      return createPermissionErrorResponse(error);
    }
  }

  const roles = await listCompanyRoles({ companyId: workspace.membership.companyId });
  return NextResponse.json({ ok: true, roles, permissions: Object.values(RbacPermission) });
}

export async function POST(request: Request) {
  let workspace;
  try {
    workspace = await authorize(request, "TEAM_MANAGE_ROLES");
  } catch (error) {
    if (error instanceof Error && error.name === "PermissionDeniedError") {
      return createPermissionErrorResponse(error);
    }
    return createAuthorizationErrorResponse(error);
  }

  const validation = CreateRoleSchema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid role", errors: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const role = await createCompanyRole({
      companyId: workspace.membership.companyId,
      ...validation.data,
    });
    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "rbac.role_created",
      entityType: "CompanyAccessRole",
      entityId: role.id,
      metadata: { name: role.name, slug: role.slug, permissions: role.permissions },
    });
    return NextResponse.json({ ok: true, role }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to create role" },
      { status: 400 },
    );
  }
}
