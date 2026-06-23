import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

export class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
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

  if (
    context.membership.role !== "OWNER" &&
    context.membership.role !== "ADMIN"
  ) {
    throw new AuthorizationError("Only owners and admins can access this resource", 403);
  }

  return {
    user: context.user,
    membership: context.membership,
  };
}
