import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getWhatsAppCatalogAnalytics } from "@/server/services/whatsapp-catalog-analytics.service";
import { whatsAppCatalogAnalyticsQuerySchema } from "@/server/validators/whatsapp-catalog-analytics.validator";

function normalizeSearchParams(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}

export async function GET(request: Request) {
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

  const parsed = whatsAppCatalogAnalyticsQuerySchema.safeParse(
    normalizeSearchParams(new URL(request.url).searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        errors: parsed.error.flatten().fieldErrors,
        message: "Invalid catalog analytics filters",
      },
      { status: 400 },
    );
  }

  const analytics = await getWhatsAppCatalogAnalytics(
    context.membership.companyId,
    parsed.data,
  );

  return NextResponse.json({ analytics });
}
