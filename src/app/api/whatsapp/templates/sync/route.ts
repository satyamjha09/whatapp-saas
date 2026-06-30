import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import { syncWhatsAppTemplatesFromMeta } from "@/server/services/whatsapp-template-sync.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";
import { NUMERIC_WABA_ID_MESSAGE } from "@/server/whatsapp/meta-ids";

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
        { message: "Only owners and admins can sync templates" },
        { status: 403 },
      );
    }

    const result = await syncWhatsAppTemplatesFromMeta(
      context.membership.companyId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "whatsapp.templates.synced",
      entityType: "Template",
      metadata: result,
    });

    return NextResponse.json({
      message: "WhatsApp templates synced successfully",
      result,
    });
  } catch (error) {
    console.error("SYNC_WHATSAPP_TEMPLATES_ERROR:", error);

    if (error instanceof UsageQuotaExceededError) {
      return createUsageQuotaErrorResponse(error);
    }

    if (
      error instanceof Error &&
      (error.message === "WhatsApp account is not connected" ||
        error.message === NUMERIC_WABA_ID_MESSAGE ||
        error.message.startsWith("Meta rejected WABA ID"))
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to sync WhatsApp templates",
      },
      { status: 502 },
    );
  }
}
