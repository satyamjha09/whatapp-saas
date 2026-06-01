import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createTemplateForCompany,
  getTemplatesByCompany,
} from "@/server/services/template.service";
import { createTemplateSchema } from "@/server/validators/template.validator";

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

    const templates = await getTemplatesByCompany(
      context.membership.companyId,
    );

    return NextResponse.json({
      templates,
    });
  } catch (error) {
    console.error("GET_TEMPLATES_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch templates" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
        { message: "You do not have permission to create templates" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    const validation = createTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid template details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const template = await createTemplateForCompany(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json(
      {
        message: "Template created successfully",
        template,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_TEMPLATE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to create template" },
      { status: 500 },
    );
  }
}
