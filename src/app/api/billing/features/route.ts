import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getCompanyPlan,
  getCompanyPlanFeatures,
} from "@/server/services/plan-feature.service";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 }
      );
    }

    const companyId = context.membership.companyId;
    const planTier = await getCompanyPlan(companyId);
    const features = await getCompanyPlanFeatures(companyId);

    return NextResponse.json({
      planTier,
      features,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET_BILLING_FEATURES_ERROR:", err);
    return NextResponse.json(
      { message: "Unable to retrieve billing features." },
      { status: 500 }
    );
  }
}
