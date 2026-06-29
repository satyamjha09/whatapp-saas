import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { SignupAccountDetailsSchema } from "@/server/validators/signup.validator";
import { ensureCompanyUserAccessRole } from "@/server/services/rbac-v2.service";
import { createAuditLog } from "@/server/services/audit.service";
import { assignDefaultTrialPlan } from "@/server/services/company-plan-assignment.service";
import { syncUser } from "@/server/services/auth.service";

export async function POST(request: Request) {
  const session = await auth();

  if (!session.userId) {
    return NextResponse.json(
      {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Please create account first.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const body = SignupAccountDetailsSchema.parse(await request.json());
    const clerkUser = await currentUser();

    const user = await syncUser({
      clerkUserId: session.userId,
      email: body.email,
      name: body.personalName,
      mobile: body.mobile,
      imageUrl: clerkUser?.imageUrl ?? null,
    });

    const existingOwnerCompany = await prisma.companyUser.findFirst({
      where: {
        userId: user.id,
        role: "OWNER",
        company: {
          name: body.businessName,
        },
      },
      include: {
        company: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingOwnerCompany) {
      await assignDefaultTrialPlan({
        companyId: existingOwnerCompany.companyId,
        actorUserId: user.id,
      }).catch(() => undefined);

      await prisma.userWorkspacePreference.upsert({
        where: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          activeCompanyId: existingOwnerCompany.companyId,
          lastSelectedAt: new Date(),
        },
        update: {
          activeCompanyId: existingOwnerCompany.companyId,
          lastSelectedAt: new Date(),
        },
      });

      return NextResponse.json({
        ok: true,
        company: existingOwnerCompany.company,
        alreadyExists: true,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: body.businessName,
          legalName: body.businessName,
          brandName: body.businessName,

          businessCategory: body.businessCategory,
          city: body.city,
          pinCode: body.pinCode,
          channelPartner: body.channelPartner || null,
          employeeCode: body.employeeCode || null,

          whatsappUpdatesConsent: body.whatsappUpdatesConsent,
          whatsappUpdatesConsentAt: body.whatsappUpdatesConsent
            ? new Date()
            : null,

          type: "DIRECT_COMPANY",
          status: "PENDING_ONBOARDING",
          billingOwnerType: "SELF",
        },
      });

      await tx.companyUser.create({
        data: {
          companyId: company.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      await tx.userWorkspacePreference.upsert({
        where: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          activeCompanyId: company.id,
          lastSelectedAt: new Date(),
        },
        update: {
          activeCompanyId: company.id,
          lastSelectedAt: new Date(),
        },
      });

      return {
        company,
      };
    });

    await ensureCompanyUserAccessRole({
      companyId: result.company.id,
      userId: user.id,
      legacyRole: "OWNER",
    }).catch(() => undefined);

    await assignDefaultTrialPlan({
      companyId: result.company.id,
      actorUserId: user.id,
    }).catch(() => undefined);

    await createAuditLog({
      companyId: result.company.id,
      actorUserId: user.id,
      action: "company.signup_workspace_created",
      entityType: "Company",
      entityId: result.company.id,
      metadata: {
        businessCategory: body.businessCategory,
        city: body.city,
        channelPartner: body.channelPartner,
        whatsappUpdatesConsent: body.whatsappUpdatesConsent,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      company: result.company,
      alreadyExists: false,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid signup details.",
          errors: error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    throw error;
  }
}
