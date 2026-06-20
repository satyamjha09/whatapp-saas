import axios from "axios";
import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { testWhatsAppConnection } from "@/server/services/whatsapp-settings.service";

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
        { message: "Only owners and admins can test WhatsApp settings" },
        { status: 403 },
      );
    }

    const connection = await testWhatsAppConnection(
      context.membership.companyId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "whatsapp.connection.tested",
      entityType: "WhatsAppAccount",
      metadata: {
        connected: connection.connected,
        phoneNumberId: connection.phoneNumberId,
        qualityRating: connection.qualityRating,
      },
    });

    return NextResponse.json({
      message: "WhatsApp connection is working",
      connection,
    });
  } catch (error) {
    console.error("TEST_WHATSAPP_CONNECTION_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "WhatsApp credentials are incomplete"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (axios.isAxiosError(error)) {
      const metaMessage =
        error.response?.data?.error?.message ?? "Meta rejected the credentials";

      return NextResponse.json(
        { message: String(metaMessage) },
        { status: error.response?.status === 401 ? 401 : 502 },
      );
    }

    return NextResponse.json(
      { message: "Unable to test WhatsApp connection" },
      { status: 500 },
    );
  }
}
