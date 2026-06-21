import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { subscribeCurrentWhatsAppAccountToWebhooks } from "@/server/services/whatsapp-settings.service";

export async function POST() {
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
        { message: "Only owners and admins can subscribe webhooks" },
        { status: 403 },
      );
    }

    const result = await subscribeCurrentWhatsAppAccountToWebhooks(
      context.membership.companyId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "whatsapp.webhooks.subscribed",
      entityType: "WhatsAppAccount",
      entityId: result.accountId,
      metadata: { wabaId: result.wabaId },
    });

    return NextResponse.json({
      message: "WhatsApp webhooks subscribed successfully",
      result,
    });
  } catch (error) {
    console.error("SUBSCRIBE_WHATSAPP_WEBHOOKS_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "WhatsApp account is not connected"
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to subscribe WhatsApp webhooks",
      },
      { status: 502 },
    );
  }
}
