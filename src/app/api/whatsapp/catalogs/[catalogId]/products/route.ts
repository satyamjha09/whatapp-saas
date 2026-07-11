import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getCatalogProducts,
  WhatsAppCatalogSyncError,
} from "@/server/services/whatsapp-catalog.service";

type RouteContext = {
  params: Promise<{
    catalogId: string;
  }>;
};

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(1, Math.floor(parsed));
}

export async function GET(request: Request, { params }: RouteContext) {
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

    const { catalogId } = await params;
    const { searchParams } = new URL(request.url);
    const result = await getCatalogProducts({
      availability: searchParams.get("availability"),
      catalogId,
      companyId: context.membership.companyId,
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: parsePositiveInt(searchParams.get("pageSize"), 20),
      search: searchParams.get("search"),
      usableOnly: searchParams.get("usableOnly") === "true",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET_WHATSAPP_CATALOG_PRODUCTS_ERROR:", error);

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
            : "Unable to fetch Catalog products",
      },
      { status: 500 },
    );
  }
}
