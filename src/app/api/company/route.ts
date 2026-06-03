import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { updateCompany } from "@/server/services/company.service";
import { updateCompanySchema } from "@/server/validators/company.validator";

export async function PATCH(request: Request) {
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

    if (context.membership.role !== "OWNER") {
      return NextResponse.json(
        { message: "Only owner can update company settings" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    const validation = updateCompanySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid company details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const company = await updateCompany(
      context.membership.companyId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "company.updated",
      entityType: "Company",
      entityId: company.id,
      metadata: {
        name: company.name,
      },
    });

    return NextResponse.json({
      message: "Company updated successfully",
      company,
    });
  } catch (error) {
    console.error("UPDATE_COMPANY_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to update company" },
      { status: 500 },
    );
  }
}
