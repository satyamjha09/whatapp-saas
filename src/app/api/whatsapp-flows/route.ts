import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createWhatsAppFlow,
  getWhatsAppFlowsByCompany,
  getUsableWhatsAppFlowsForCompany,
} from "@/server/services/whatsapp-flow.service";
import { createWhatsAppFlowSchema } from "@/server/validators/whatsapp-flow.validator";

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
    const usableOnly = searchParams.get("usableOnly") === "true";
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const status = searchParams.get("status")?.trim().toUpperCase() ?? "";
    const flows = usableOnly
      ? await getUsableWhatsAppFlowsForCompany(context.membership.companyId)
      : await getWhatsAppFlowsByCompany(context.membership.companyId);
    const filteredFlows = flows.filter((flow) => {
      const matchesSearch =
        !search ||
        flow.name.toLowerCase().includes(search) ||
        flow.metaFlowId.toLowerCase().includes(search);

      if (!matchesSearch) return false;
      if (!status || status === "ALL") return true;
      if (status === "UNAVAILABLE") return Boolean(flow.remoteMissingAt);

      return flow.status === status;
    });

    return NextResponse.json({ flows: filteredFlows });
  } catch (error) {
    console.error("GET_WHATSAPP_FLOWS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch WhatsApp flows" },
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
        { message: "You do not have permission to manage WhatsApp flows" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = createWhatsAppFlowSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid WhatsApp flow details",
        },
        { status: 400 },
      );
    }

    const flow = await createWhatsAppFlow({
      companyId: context.membership.companyId,
      input: validation.data,
    });

    return NextResponse.json(
      {
        flow,
        message: "WhatsApp flow created",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_WHATSAPP_FLOW_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to create WhatsApp flow",
      },
      { status: 400 },
    );
  }
}
