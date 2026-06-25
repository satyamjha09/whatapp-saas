import { NextResponse } from "next/server";
import { getCurrentDatabaseUser } from "@/server/auth/current-user";
import { acceptCompanyInvite } from "@/server/services/invite.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";

type AcceptInviteRouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: AcceptInviteRouteContext,
) {
  try {
    const user = await getCurrentDatabaseUser();

    if (!user) {
      return NextResponse.json(
        { message: "Sign in to accept this invite" },
        { status: 401 },
      );
    }

    const { token } = await params;

    const result = await acceptCompanyInvite(token, user.id);

    return NextResponse.json({
      message: "Invite accepted successfully",
      ...result,
    });
  } catch (error) {
    console.error("ACCEPT_INVITE_ERROR:", error);

    if (error instanceof UsageQuotaExceededError) {
      return createUsageQuotaErrorResponse(error);
    }

    if (
      error instanceof Error &&
      [
        "User not found",
        "Invite not found",
        "Invite is not pending",
        "Invite has expired",
        "This company workspace is not active",
        "This invite belongs to another email address",
        "User is already a member of this company",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("plan allows maximum")) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to accept invite" },
      { status: 500 },
    );
  }
}
