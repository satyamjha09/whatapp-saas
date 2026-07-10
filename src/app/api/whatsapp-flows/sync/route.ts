import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  syncWhatsAppFlowsForCompany,
  WhatsAppFlowSyncError,
} from "@/server/services/whatsapp-flow.service";

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
        { message: "Only owners and admins can sync WhatsApp flows" },
        { status: 403 },
      );
    }

    const result = await syncWhatsAppFlowsForCompany(
      context.membership.companyId,
    );

    await createAuditLog({
      action: "whatsapp_flows.synced",
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      entityType: "WhatsAppFlow",
      metadata: result.summary,
    });

    return NextResponse.json({
      message: "WhatsApp flows synced successfully",
      result,
    });
  } catch (error) {
    console.error("SYNC_WHATSAPP_FLOWS_ERROR:", error);

    if (error instanceof WhatsAppFlowSyncError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to sync WhatsApp flows",
      },
      { status: 502 },
    );
  }
}
