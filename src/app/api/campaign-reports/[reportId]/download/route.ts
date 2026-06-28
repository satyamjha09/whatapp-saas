import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/authorization";
import {
  CampaignCompletionReportError,
  generateCampaignReportCsv,
} from "@/server/services/campaign-completion-report.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { reportId } = await context.params;
  const report = await prisma.campaignCompletionReport.findFirst({
    where: {
      companyId: workspace.membership.companyId,
      id: reportId,
    },
  });

  if (!report) {
    return NextResponse.json(
      {
        ok: false,
        code: "REPORT_NOT_FOUND",
        message: "Report not found.",
      },
      { status: 404 },
    );
  }

  try {
    const exportData = await generateCampaignReportCsv({
      actorUserId: workspace.user.id,
      campaignId: report.campaignId,
      companyId: workspace.membership.companyId,
      reportId: report.id,
    });

    return new NextResponse(`\uFEFF${exportData.csv}`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${exportData.filename}"`,
        "Content-Type": exportData.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof CampaignCompletionReportError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CAMPAIGN_REPORT_EXPORT_ERROR",
          message: error.message,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
