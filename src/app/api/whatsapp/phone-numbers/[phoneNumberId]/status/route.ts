import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { createAuditLog } from "@/server/services/audit.service";
import { checkWhatsAppPhoneNumberStatus } from "@/server/services/whatsapp-embedded-signup.service";

type PhoneNumberStatusRouteContext = {
  params: Promise<{
    phoneNumberId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: PhoneNumberStatusRouteContext,
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
        { message: "Only owners and admins can check WhatsApp status" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const { phoneNumberId } = await params;

    if (!/^\d+$/.test(phoneNumberId)) {
      return NextResponse.json(
        { message: "Invalid phone number ID" },
        { status: 400 },
      );
    }

    const status = await checkWhatsAppPhoneNumberStatus({
      companyId: context.membership.companyId,
      phoneNumberId,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "whatsapp.phone_number.status_checked",
      entityType: "WhatsAppPhoneNumber",
      metadata: {
        phoneNumberId,
        qualityRating: status.qualityRating,
        canSendMessage: status.canSendMessage,
      },
    });

    return NextResponse.json({
      message: "Phone number status refreshed",
      status,
    });
  } catch (error) {
    console.error("CHECK_WHATSAPP_PHONE_NUMBER_STATUS_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "WhatsApp credentials are incomplete"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to check WhatsApp phone status",
      },
      { status: 502 },
    );
  }
}
