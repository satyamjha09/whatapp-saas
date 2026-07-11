import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  getWhatsAppCatalogsByCompany,
  syncWhatsAppCatalogsForCompany,
  WhatsAppCatalogSyncError,
} from "@/server/services/whatsapp-catalog.service";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(1, Math.floor(parsed));
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);

    const result = await getWhatsAppCatalogsByCompany({
      companyId: context.membership.companyId,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET_WHATSAPP_CATALOGS_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to fetch WhatsApp catalogs",
      },
      { status: 500 },
    );
  }
}

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
        { message: "Only owners and admins can sync WhatsApp catalogs" },
        { status: 403 },
      );
    }

    const result = await syncWhatsAppCatalogsForCompany(
      context.membership.companyId,
    );

    await createAuditLog({
      action: "whatsapp_catalogs.synced",
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      entityType: "WhatsAppCatalog",
      metadata: result.summary,
    });

    return NextResponse.json({
      message: "WhatsApp catalogs synced successfully",
      result,
    });
  } catch (error) {
    console.error("SYNC_WHATSAPP_CATALOGS_ERROR:", error);

    if (error instanceof WhatsAppCatalogSyncError) {
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
            : "Unable to sync WhatsApp catalogs",
      },
      { status: 502 },
    );
  }
}
