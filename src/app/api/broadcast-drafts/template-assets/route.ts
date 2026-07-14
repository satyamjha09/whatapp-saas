import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

export async function GET() {
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

    const templates = await prisma.template.findMany({
      where: {
        companyId: context.membership.companyId,
        status: "APPROVED",
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      select: {
        body: true,
        category: true,
        components: true,
        id: true,
        language: true,
        name: true,
        qualityScore: true,
        variables: true,
      },
      take: 100,
    });

    return NextResponse.json({
      templates: templates.map((template) => ({
        ...template,
        category: template.category.toString(),
      })),
    });
  } catch (error) {
    console.error("GET_BROADCAST_TEMPLATE_ASSETS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch approved templates" },
      { status: 500 },
    );
  }
}
