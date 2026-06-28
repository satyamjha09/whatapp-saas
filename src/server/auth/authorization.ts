import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertRoutePermission } from "@/server/auth/route-permission-guard";

export class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

function assertUsableWorkspace(company: { status?: string }) {
  if (company.status && company.status !== "ACTIVE" && company.status !== "PENDING_ONBOARDING") {
    throw new AuthorizationError("This company workspace is not active.", 403);
  }
}

export async function requireAdmin({
  request,
}: {
  request?: Request;
} = {}) {
  void request;

  const context = await getCurrentWorkspaceContext();

  if (!context) {
    throw new AuthorizationError("Unauthorized", 401);
  }

  if (!context.membership) {
    throw new AuthorizationError("Complete company onboarding first", 403);
  }

  assertUsableWorkspace(context.membership.company);

  if (
    context.membership.role !== "OWNER" &&
    context.membership.role !== "ADMIN"
  ) {
    throw new AuthorizationError("Only owners and admins can access this resource", 403);
  }

  const workspace = {
    user: context.user,
    membership: context.membership,
  };

  if (request) await assertRoutePermission({ request, workspace });
  return workspace;
}

export async function requireMember() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    throw new AuthorizationError("Unauthorized", 401);
  }

  if (!context.membership) {
    throw new AuthorizationError("Complete company onboarding first", 403);
  }

  assertUsableWorkspace(context.membership.company);

  return {
    user: context.user,
    membership: context.membership,
  };
}

export async function requireAuthenticatedWorkspace({
  request,
}: {
  request?: Request;
} = {}) {
  const workspace = await requireMember();

  if (request) await assertRoutePermission({ request, workspace });
  return workspace;
}
