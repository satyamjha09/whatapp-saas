import { NextResponse, type NextRequest } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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

    const { searchParams } = request.nextUrl;
    const campaignId = searchParams.get("campaignId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const templateId = searchParams.get("templateId");
    const direction = searchParams.get("direction");
    const status = searchParams.get("status");
    const to = searchParams.get("to");
    const hasError = searchParams.get("hasError");
    const errorCode = searchParams.get("errorCode");
    const metaMessageId = searchParams.get("metaMessageId");
    const id = searchParams.get("id");
    const limit = Number(searchParams.get("limit") || "50");
    const page = Number(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      companyId: context.membership.companyId,
    };

    if (campaignId) where.campaignId = campaignId;
    if (templateId) where.templateId = templateId;
    if (direction) where.direction = direction as "OUTBOUND" | "INBOUND";
    if (status) where.status = status as "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
    if (errorCode) where.errorCode = { contains: errorCode, mode: "insensitive" };
    if (metaMessageId) where.metaMessageId = { contains: metaMessageId, mode: "insensitive" };
    if (id) where.id = id;

    if (hasError === "true") {
      where.errorCode = { not: null };
    } else if (hasError === "false") {
      where.errorCode = null;
    }

    if (to) {
      where.OR = [
        { toPhoneNumber: { contains: to, mode: "insensitive" } },
        { contact: { name: { contains: to, mode: "insensitive" } } },
      ];
    }

    if (startDate || endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          contact: {
            select: {
              name: true,
              phoneNumber: true,
              countryCode: true,
            },
          },
          template: {
            select: {
              name: true,
            },
          },
          campaign: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.message.count({
        where,
      }),
    ]);

    return NextResponse.json({
      messages,
      totalCount,
      page,
      limit,
    });
  } catch (error) {
    console.error("GET_MESSAGES_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch messages" },
      { status: 500 },
    );
  }
}
