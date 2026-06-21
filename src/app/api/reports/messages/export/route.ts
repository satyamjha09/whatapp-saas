import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/csv";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getMessageReportsForExport } from "@/server/services/message-report.service";

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
    const messages = await getMessageReportsForExport(
      context.membership.companyId,
      {
        direction: searchParams.get("direction") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        search: searchParams.get("search") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
      },
    );
    const csv = rowsToCsv([
      [
        "Message ID",
        "Created At",
        "Direction",
        "Status",
        "Contact Name",
        "Country Code",
        "Phone Number",
        "Template",
        "Language",
        "Meta Message ID",
        "Body",
      ],
      ...messages.map((message) => [
        message.id,
        message.createdAt,
        message.direction,
        message.status,
        message.contact.name ?? "",
        message.contact.countryCode,
        message.contact.phoneNumber,
        message.template?.name ?? "",
        message.template?.language ?? "",
        message.metaMessageId ?? "",
        message.body,
      ]),
    ]);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="message-report-${date}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("EXPORT_MESSAGE_REPORT_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to export message report" },
      { status: 500 },
    );
  }
}
