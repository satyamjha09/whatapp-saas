import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  createCompanyInvite,
  getCompanyInvites,
} from "@/server/services/invite.service";
import { createCompanyInviteSchema } from "@/server/validators/invite.validator";

export async function GET() {
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

    const invites = await getCompanyInvites(context.membership.companyId);

    return NextResponse.json({
      invites,
    });
  } catch (error) {
    console.error("GET_TEAM_INVITES_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch invites" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
        { message: "You do not have permission to invite team members" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    const validation = createCompanyInviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid invite details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { emailResult, invite, inviteUrl } = await createCompanyInvite(
      context.membership.companyId,
      context.user.id,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "team.invite.created",
      entityType: "CompanyInvite",
      entityId: invite.id,
      metadata: {
        email: invite.email,
        role: invite.role,
      },
    });

    return NextResponse.json(
      {
        message: "Invite created successfully",
        emailResult,
        invite,
        inviteUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_TEAM_INVITE_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "User is already a member of this company",
        "A pending invite already exists for this email",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (error instanceof Error && error.message.includes("plan allows maximum")) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to create invite" },
      { status: 500 },
    );
  }
}
