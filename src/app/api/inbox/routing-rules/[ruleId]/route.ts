import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  deleteInboxRoutingRule,
  getInboxRoutingRule,
  updateInboxRoutingRule,
} from "@/server/services/inbox-routing-rule.service";
import { updateInboxRoutingRuleSchema } from "@/server/validators/inbox-routing-rule.validator";

type InboxRoutingRuleRouteContext = {
  params: Promise<{
    ruleId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: InboxRoutingRuleRouteContext,
) {
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

    const { ruleId } = await params;
    const rule = await getInboxRoutingRule(context.membership.companyId, ruleId);

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("GET_INBOX_ROUTING_RULE_ERROR:", error);

    if (error instanceof Error && error.message === "Routing rule not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to load routing rule" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: InboxRoutingRuleRouteContext,
) {
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

    const body: unknown = await request.json();
    const validation = updateInboxRoutingRuleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid routing rule",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { ruleId } = await params;
    const rule = await updateInboxRoutingRule(
      context.membership.companyId,
      ruleId,
      validation.data,
    );

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("UPDATE_INBOX_ROUTING_RULE_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Queue not found",
        "One or more routing skills were not found",
        "Routing rule not found",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to update routing rule" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: InboxRoutingRuleRouteContext,
) {
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

    const { ruleId } = await params;
    await deleteInboxRoutingRule(context.membership.companyId, ruleId);

    return NextResponse.json({ message: "Routing rule deleted" });
  } catch (error) {
    console.error("DELETE_INBOX_ROUTING_RULE_ERROR:", error);

    if (error instanceof Error && error.message === "Routing rule not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to delete routing rule" },
      { status: 500 },
    );
  }
}
