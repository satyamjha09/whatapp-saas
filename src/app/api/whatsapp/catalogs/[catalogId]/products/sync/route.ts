import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  syncCatalogProducts,
  WhatsAppCatalogSyncError,
} from "@/server/services/whatsapp-catalog.service";

type RouteContext = {
  params: Promise<{
    catalogId: string;
  }>;
};

export async function POST(_: Request, { params }: RouteContext) {
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
        { message: "Only owners and admins can sync Catalog products" },
        { status: 403 },
      );
    }

    const { catalogId } = await params;
    const result = await syncCatalogProducts({
      catalogId,
      companyId: context.membership.companyId,
    });

    await createAuditLog({
      action: "whatsapp_catalog_products.synced",
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      entityId: catalogId,
      entityType: "WhatsAppCatalog",
      metadata: result.summary,
    });

    return NextResponse.json({
      message: "Catalog products synced successfully",
      result,
    });
  } catch (error) {
    console.error("SYNC_WHATSAPP_CATALOG_PRODUCTS_ERROR:", error);

    if (error instanceof WhatsAppCatalogSyncError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to sync Catalog products",
      },
      { status: 502 },
    );
  }
}
