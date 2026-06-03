import { NextResponse } from "next/server";
import { authenticatePublicApiRequest } from "@/server/auth/public-api";
import { getTemplatesByCompany } from "@/server/services/template.service";

export async function GET(request: Request) {
  try {
    const auth = await authenticatePublicApiRequest(request);

    if (!auth.success) {
      return auth.response;
    }

    const { apiKeyRecord } = auth;

    const templates = await getTemplatesByCompany(apiKeyRecord.companyId);

    return NextResponse.json({
      success: true,
      data: templates.map((template) => ({
        id: template.id,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        body: template.body,
        variables: template.variables,
        variableCount: template.variables.length,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })),
    });
  } catch (error) {
    console.error("PUBLIC_GET_TEMPLATES_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch templates" },
      { status: 500 },
    );
  }
}
