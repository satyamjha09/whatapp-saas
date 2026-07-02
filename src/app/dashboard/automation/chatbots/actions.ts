"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createChatbot,
  createChatbotEdge,
  createChatbotNode,
  createChatbotTrigger,
  deleteChatbotEdge,
  deleteChatbotNode,
  deleteChatbotTrigger,
  updateChatbotFallback,
  updateChatbotNodePosition,
  updateChatbotStatus,
} from "@/server/services/chatbot.service";
import { startChatbotWhatsAppTest } from "@/server/services/chatbot-runtime.service";
import {
  createChatbotEdgeSchema,
  createChatbotNodeSchema,
  createChatbotSchema,
  createChatbotTriggerSchema,
  startChatbotWhatsAppTestSchema,
  updateChatbotFallbackSchema,
  updateChatbotStatusSchema,
} from "@/server/validators/chatbot.validator";

export type ChatbotActionState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
  sessionId?: string;
};

function readOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : null;
}

async function requireChatbotManager() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return {
      error: "Unauthorized",
    };
  }

  if (!context.membership) {
    return {
      error: "Complete company onboarding first",
    };
  }

  const membership = context.membership;

  if (
    membership.role !== "OWNER" &&
    membership.role !== "ADMIN"
  ) {
    return {
      error: "Only owners and admins can manage chatbots",
    };
  }

  return {
    workspace: {
      membership,
      user: context.user,
    },
  };
}

export async function createChatbotAction(
  _previousState: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  const validation = createChatbotSchema.safeParse({
    description: readOptionalString(formData.get("description")),
    keywords: readOptionalString(formData.get("keywords")),
    name: formData.get("name"),
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: "Please check the chatbot details",
    };
  }

  let chatbotId = "";

  try {
    const chatbot = await createChatbot({
      actorUserId: manager.workspace.user.id,
      companyId: manager.workspace.membership.companyId,
      input: validation.data,
    });

    chatbotId = chatbot.id;
  } catch (error) {
    console.error("CREATE_CHATBOT_ACTION_ERROR:", error);

    return {
      message:
        error instanceof Error ? error.message : "Unable to create chatbot",
    };
  }

  revalidatePath("/dashboard/automation/chatbots");
  redirect(`/dashboard/automation/chatbots/${chatbotId}/builder`);
}

export async function createChatbotNodeAction(
  _previousState: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  const chatbotId = readOptionalString(formData.get("chatbotId"));

  if (!chatbotId) {
    return { message: "Chatbot is required" };
  }

  const validation = createChatbotNodeSchema.safeParse({
    aiFallback: readOptionalString(formData.get("aiFallback")),
    aiPrompt: readOptionalString(formData.get("aiPrompt")),
    apiBody: readOptionalString(formData.get("apiBody")),
    apiHeaders: readOptionalString(formData.get("apiHeaders")),
    apiMethod: formData.get("apiMethod"),
    apiUrl: readOptionalString(formData.get("apiUrl")),
    assignTo: readOptionalString(formData.get("assignTo")),
    body: readOptionalString(formData.get("body")),
    buttons: readOptionalString(formData.get("buttons")),
    conditionOperator: formData.get("conditionOperator"),
    conditionValue: readOptionalString(formData.get("conditionValue")),
    fallbackMessage: readOptionalString(formData.get("fallbackMessage")),
    footer: readOptionalString(formData.get("footer")),
    header: readOptionalString(formData.get("header")),
    listRows: readOptionalString(formData.get("listRows")),
    mediaId: readOptionalString(formData.get("mediaId")),
    mediaName: readOptionalString(formData.get("mediaName")),
    mediaType: readOptionalString(formData.get("mediaType")),
    mediaUrl: readOptionalString(formData.get("mediaUrl")),
    name: formData.get("name"),
    paymentAmount: readOptionalString(formData.get("paymentAmount")),
    paymentDescription: readOptionalString(formData.get("paymentDescription")),
    paymentLinkUrl: readOptionalString(formData.get("paymentLinkUrl")),
    primaryButton: readOptionalString(formData.get("primaryButton")),
    productDescription: readOptionalString(formData.get("productDescription")),
    productImageUrl: readOptionalString(formData.get("productImageUrl")),
    productRetailerId: readOptionalString(formData.get("productRetailerId")),
    productTitle: readOptionalString(formData.get("productTitle")),
    productUrl: readOptionalString(formData.get("productUrl")),
    questionField: readOptionalString(formData.get("questionField")),
    responseField: readOptionalString(formData.get("responseField")),
    sheetPayload: readOptionalString(formData.get("sheetPayload")),
    sheetWebhookUrl: readOptionalString(formData.get("sheetWebhookUrl")),
    successMessage: readOptionalString(formData.get("successMessage")),
    tallyEndpointUrl: readOptionalString(formData.get("tallyEndpointUrl")),
    tallySearchField: readOptionalString(formData.get("tallySearchField")),
    type: formData.get("type"),
    webhookSecret: readOptionalString(formData.get("webhookSecret")),
    webhookUrl: readOptionalString(formData.get("webhookUrl")),
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: "Please check the node details",
    };
  }

  try {
    await createChatbotNode({
      actorUserId: manager.workspace.user.id,
      chatbotId,
      companyId: manager.workspace.membership.companyId,
      input: validation.data,
    });
  } catch (error) {
    console.error("CREATE_CHATBOT_NODE_ACTION_ERROR:", error);

    return {
      message: error instanceof Error ? error.message : "Unable to create node",
    };
  }

  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
  return {
    message: "Node added",
    ok: true,
  };
}

export async function createChatbotEdgeAction(
  _previousState: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  const chatbotId = readOptionalString(formData.get("chatbotId"));

  if (!chatbotId) {
    return { message: "Chatbot is required" };
  }

  const validation = createChatbotEdgeSchema.safeParse({
    label: readOptionalString(formData.get("label")),
    sourceNodeId: formData.get("sourceNodeId"),
    targetNodeId: formData.get("targetNodeId"),
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: "Please check the connection",
    };
  }

  try {
    await createChatbotEdge({
      actorUserId: manager.workspace.user.id,
      chatbotId,
      companyId: manager.workspace.membership.companyId,
      input: validation.data,
    });
  } catch (error) {
    console.error("CREATE_CHATBOT_EDGE_ACTION_ERROR:", error);

    return {
      message:
        error instanceof Error ? error.message : "Unable to create connection",
    };
  }

  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
  return {
    message: "Connection added",
    ok: true,
  };
}

export async function createChatbotCanvasEdgeAction({
  chatbotId,
  sourceNodeId,
  targetNodeId,
}: {
  chatbotId: string;
  sourceNodeId: string;
  targetNodeId: string;
}): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  const validation = createChatbotEdgeSchema.safeParse({
    label: null,
    sourceNodeId,
    targetNodeId,
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: "Please check the connection",
    };
  }

  try {
    await createChatbotEdge({
      actorUserId: manager.workspace.user.id,
      chatbotId,
      companyId: manager.workspace.membership.companyId,
      input: validation.data,
    });
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Unable to create connection",
    };
  }

  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
  return {
    message: "Connection added",
    ok: true,
  };
}

export async function deleteChatbotNodeAction(formData: FormData) {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return;

  const chatbotId = readOptionalString(formData.get("chatbotId"));
  const nodeId = readOptionalString(formData.get("nodeId"));

  if (!chatbotId || !nodeId) return;

  await deleteChatbotNode({
    actorUserId: manager.workspace.user.id,
    chatbotId,
    companyId: manager.workspace.membership.companyId,
    nodeId,
  });
  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
}

export async function deleteChatbotEdgeAction(formData: FormData) {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return;

  const chatbotId = readOptionalString(formData.get("chatbotId"));
  const edgeId = readOptionalString(formData.get("edgeId"));

  if (!chatbotId || !edgeId) return;

  await deleteChatbotEdge({
    actorUserId: manager.workspace.user.id,
    chatbotId,
    companyId: manager.workspace.membership.companyId,
    edgeId,
  });
  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
}

export async function deleteChatbotCanvasEdgeAction({
  chatbotId,
  edgeId,
}: {
  chatbotId: string;
  edgeId: string;
}): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  if (!chatbotId || !edgeId) {
    return {
      message: "Connection is required",
    };
  }

  try {
    await deleteChatbotEdge({
      actorUserId: manager.workspace.user.id,
      chatbotId,
      companyId: manager.workspace.membership.companyId,
      edgeId,
    });
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Unable to delete connection",
    };
  }

  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
  return {
    message: "Connection removed",
    ok: true,
  };
}

export async function updateChatbotNodePositionAction({
  chatbotId,
  nodeId,
  positionX,
  positionY,
}: {
  chatbotId: string;
  nodeId: string;
  positionX: number;
  positionY: number;
}): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  if (
    !chatbotId ||
    !nodeId ||
    !Number.isFinite(positionX) ||
    !Number.isFinite(positionY)
  ) {
    return {
      message: "Invalid node position",
    };
  }

  try {
    await updateChatbotNodePosition({
      actorUserId: manager.workspace.user.id,
      chatbotId,
      companyId: manager.workspace.membership.companyId,
      nodeId,
      positionX: Math.round(positionX),
      positionY: Math.round(positionY),
    });
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Unable to save node position",
    };
  }

  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
  return {
    message: "Position saved",
    ok: true,
  };
}

export async function createChatbotTriggerAction(
  _previousState: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  const chatbotId = readOptionalString(formData.get("chatbotId"));

  if (!chatbotId) {
    return { message: "Chatbot is required" };
  }

  const validation = createChatbotTriggerSchema.safeParse({
    priority: formData.get("priority"),
    type: formData.get("type"),
    value: readOptionalString(formData.get("value")),
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: "Please check the trigger details",
    };
  }

  try {
    await createChatbotTrigger({
      actorUserId: manager.workspace.user.id,
      chatbotId,
      companyId: manager.workspace.membership.companyId,
      input: validation.data,
    });
  } catch (error) {
    console.error("CREATE_CHATBOT_TRIGGER_ACTION_ERROR:", error);

    return {
      message:
        error instanceof Error ? error.message : "Unable to create trigger",
    };
  }

  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
  return {
    message: "Trigger added",
    ok: true,
  };
}

export async function deleteChatbotTriggerAction(formData: FormData) {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return;

  const chatbotId = readOptionalString(formData.get("chatbotId"));
  const triggerId = readOptionalString(formData.get("triggerId"));

  if (!chatbotId || !triggerId) return;

  await deleteChatbotTrigger({
    actorUserId: manager.workspace.user.id,
    chatbotId,
    companyId: manager.workspace.membership.companyId,
    triggerId,
  });
  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
}

export async function updateChatbotFallbackAction(
  _previousState: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  const chatbotId = readOptionalString(formData.get("chatbotId"));

  if (!chatbotId) {
    return { message: "Chatbot is required" };
  }

  const validation = updateChatbotFallbackSchema.safeParse({
    fallbackMessage: readOptionalString(formData.get("fallbackMessage")),
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: "Please check fallback details",
    };
  }

  try {
    await updateChatbotFallback({
      actorUserId: manager.workspace.user.id,
      chatbotId,
      companyId: manager.workspace.membership.companyId,
      input: validation.data,
    });
  } catch (error) {
    console.error("UPDATE_CHATBOT_FALLBACK_ACTION_ERROR:", error);

    return {
      message:
        error instanceof Error ? error.message : "Unable to save fallback",
    };
  }

  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
  return {
    message: "Fallback saved",
    ok: true,
  };
}

export async function startChatbotWhatsAppTestAction(
  _previousState: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return { message: manager.error };

  const chatbotId = readOptionalString(formData.get("chatbotId"));

  if (!chatbotId) {
    return { message: "Chatbot is required" };
  }

  const validation = startChatbotWhatsAppTestSchema.safeParse({
    countryCode: formData.get("countryCode"),
    name: readOptionalString(formData.get("name")),
    phoneNumber: formData.get("phoneNumber"),
    testMessage: readOptionalString(formData.get("testMessage")),
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: "Please check the test contact",
    };
  }

  try {
    const result = await startChatbotWhatsAppTest({
      actorUserId: manager.workspace.user.id,
      chatbotId,
      companyId: manager.workspace.membership.companyId,
      input: validation.data,
    });

    revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
    revalidatePath(
      `/dashboard/automation/chatbots/${chatbotId}/sessions/${result.session.id}`,
    );

    return {
      message: "WhatsApp test session started",
      ok: true,
      sessionId: result.session.id,
    };
  } catch (error) {
    console.error("START_CHATBOT_WHATSAPP_TEST_ACTION_ERROR:", error);

    return {
      message:
        error instanceof Error
          ? error.message
          : "Unable to start WhatsApp test",
    };
  }
}

export async function updateChatbotStatusAction(formData: FormData) {
  const manager = await requireChatbotManager();
  if (manager.error || !manager.workspace) return;

  const chatbotId = readOptionalString(formData.get("chatbotId"));
  const validation = updateChatbotStatusSchema.safeParse({
    status: formData.get("status"),
  });

  if (!chatbotId || !validation.success) return;

  await updateChatbotStatus({
    actorUserId: manager.workspace.user.id,
    chatbotId,
    companyId: manager.workspace.membership.companyId,
    input: validation.data,
  });

  revalidatePath("/dashboard/automation/chatbots");
  revalidatePath(`/dashboard/automation/chatbots/${chatbotId}/builder`);
}
