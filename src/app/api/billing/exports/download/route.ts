import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createAuditLog } from "@/server/services/audit.service";
import {
  billingExportFileName,
  formatBillingExportDateRange,
  generateBillingExportCsv,
  getBillingExportReport,
  type BillingExportReportType,
} from "@/server/services/billing-export.service";

function startOfUtcDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfUtcDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function defaultDateRange() {
  const now = new Date();
  const dateTo = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  const dateFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );

  return { dateFrom, dateTo };
}

function parseDateRange(searchParams: URLSearchParams) {
  const defaults = defaultDateRange();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dateFrom = from ? startOfUtcDay(from) : defaults.dateFrom;
  const dateTo = to ? endOfUtcDay(to) : defaults.dateTo;

  if (
    Number.isNaN(dateFrom.getTime()) ||
    Number.isNaN(dateTo.getTime()) ||
    dateFrom > dateTo
  ) {
    throw new Error("Invalid export date range");
  }

  return { dateFrom, dateTo };
}

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("reportType") ?? "wallet_ledger";
    const report = getBillingExportReport(reportType);

    if (!report) {
      return NextResponse.json(
        { message: "Invalid billing export report type" },
        { status: 400 },
      );
    }

    const { dateFrom, dateTo } = parseDateRange(searchParams);
    const exportResult = await generateBillingExportCsv({
      companyId: workspace.membership.companyId,
      dateFrom,
      dateTo,
      reportType: report.type as BillingExportReportType,
    });
    const fileName = billingExportFileName({
      dateFrom,
      dateTo,
      reportType: report.type as BillingExportReportType,
    });

    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "billing.export.downloaded",
      entityType: "BillingExport",
      metadata: {
        reportType: report.type,
        reportLabel: report.label,
        rows: exportResult.rowCount,
        dateRange: formatBillingExportDateRange(dateFrom, dateTo),
      },
    });

    return new Response(`\uFEFF${exportResult.csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("BILLING_EXPORT_DOWNLOAD_ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Unable to generate export";

    return NextResponse.json(
      {
        message,
      },
      { status: message.startsWith("Invalid ") ? 400 : 500 },
    );
  }
}
