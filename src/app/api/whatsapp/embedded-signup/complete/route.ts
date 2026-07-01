import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { completeWhatsAppEmbeddedSignup } from "@/server/services/whatsapp-embedded-signup.service";
import { completeWhatsAppEmbeddedSignupSchema } from "@/server/validators/whatsapp-embedded-signup.validator";

const expectedErrors = new Set([
  "Meta app credentials are not configured",
  "This WhatsApp Business Account is already connected",
  "This WhatsApp phone number is already connected",
  "Selected phone number does not belong to the selected WABA",
  "Meta did not return the WABA and phone number details. Please try again.",
  "Selected phone number was not found in Meta discovery",
  "Selected WhatsApp Business Account was not found in Meta discovery",
  "Selected WhatsApp Business Account has no discoverable phone number",
]);

function isExpectedEmbeddedSignupError(error: Error) {
  return (
    expectedErrors.has(error.message) ||
    error.message.startsWith("Error validating verification code") ||
    error.message.startsWith("Meta returned authorization code")
  );
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
        { message: "Only owners and admins can connect WhatsApp" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = completeWhatsAppEmbeddedSignupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid Embedded Signup response",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const connection = await completeWhatsAppEmbeddedSignup(
      context.membership.companyId,
      validation.data,
      context.user.id,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "whatsapp.embedded_signup.connected",
      entityType: "WhatsAppAccount",
      entityId: connection.accountId,
      metadata: {
        wabaId: connection.wabaId,
        phoneNumberId: connection.phoneNumberId,
        displayPhoneNumber: connection.displayPhoneNumber,
        verifiedName: connection.verifiedName,
        qualityRating: connection.qualityRating,
        webhooksSubscribed: connection.webhooksSubscribed,
        flowSessionId: validation.data.flowSessionId,
        phoneResultCount: connection.phones.length,
      },
    });

    return NextResponse.json({
      message: "WhatsApp connected successfully",
      connection,
    });
  } catch (error) {
    console.error("COMPLETE_WHATSAPP_EMBEDDED_SIGNUP_ERROR:", error);

    if (error instanceof Error && isExpectedEmbeddedSignupError(error)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to complete WhatsApp connection",
      },
      { status: 500 },
    );
  }
}
