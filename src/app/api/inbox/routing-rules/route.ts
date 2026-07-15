import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createInboxRoutingRule,
  listInboxRoutingRules,
} from "@/server/services/inbox-routing-rule.service";
import { createInboxRoutingRuleSchema } from "@/server/validators/inbox-routing-rule.validator";

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

    const rules = await listInboxRoutingRules(context.membership.companyId);

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("LIST_INBOX_ROUTING_RULES_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to load routing rules" },
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

    const body: unknown = await request.json();
    const validation = createInboxRoutingRuleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid routing rule",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const rule = await createInboxRoutingRule(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("CREATE_INBOX_ROUTING_RULE_ERROR:", error);

    if (
      error instanceof Error &&
      ["Queue not found", "One or more routing skills were not found"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to create routing rule" },
      { status: 500 },
    );
  }
}
