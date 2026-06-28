import axios from "axios";

type SendWhatsAppTemplateMessageInput = {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  variables: string[];
};

type SendWhatsAppTextMessageInput = {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  body: string;
};

type SendWhatsAppMediaMessageInput = {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  mediaType: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";
  mediaUrl?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
};

type UploadWhatsAppMediaInput = {
  accessToken: string;
  phoneNumberId: string;
  file: File;
};

function getWhatsAppMessagesUrl(phoneNumberId: string) {
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";

  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
}

function getWhatsAppMediaUrl(phoneNumberId: string) {
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";

  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`;
}

export async function sendWhatsAppTemplateMessage(
  input: SendWhatsAppTemplateMessageInput,
) {
  const url = getWhatsAppMessagesUrl(input.phoneNumberId);

  const components =
    input.variables.length > 0
      ? [
          {
            type: "body",
            parameters: input.variables.map((value) => ({
              type: "text",
              text: value,
            })),
          },
        ]
      : [];

  const response = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: {
          code: input.languageCode,
        },
        components,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const metaMessageId = response.data?.messages?.[0]?.id;

  if (!metaMessageId) {
    throw new Error("Meta did not return a message ID");
  }

  return {
    metaMessageId,
    raw: response.data,
  };
}

export async function sendWhatsAppTextMessage(
  input: SendWhatsAppTextMessageInput,
) {
  const response = await axios.post(
    getWhatsAppMessagesUrl(input.phoneNumberId),
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: {
        preview_url: false,
        body: input.body,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const metaMessageId = response.data?.messages?.[0]?.id;

  if (!metaMessageId) {
    throw new Error("Meta did not return a message ID");
  }

  return {
    metaMessageId,
    raw: response.data,
  };
}

export async function sendWhatsAppMediaMessage(
  input: SendWhatsAppMediaMessageInput,
) {
  const type = input.mediaType.toLowerCase();
  const mediaPayload: Record<string, string> = input.mediaId
    ? { id: input.mediaId }
    : { link: input.mediaUrl ?? "" };

  if (!mediaPayload.id && !mediaPayload.link) {
    throw new Error("Media URL or media ID is required");
  }

  if (input.caption && input.mediaType !== "AUDIO") {
    mediaPayload.caption = input.caption;
  }

  if (input.filename && input.mediaType === "DOCUMENT") {
    mediaPayload.filename = input.filename;
  }

  const response = await axios.post(
    getWhatsAppMessagesUrl(input.phoneNumberId),
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type,
      [type]: mediaPayload,
    },
    {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const metaMessageId = response.data?.messages?.[0]?.id;

  if (!metaMessageId) {
    throw new Error("Meta did not return a message ID");
  }

  return {
    metaMessageId,
    raw: response.data,
  };
}

export async function uploadWhatsAppMedia(input: UploadWhatsAppMediaInput) {
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", input.file.type);
  formData.append("file", input.file, input.file.name);

  const response = await fetch(getWhatsAppMediaUrl(input.phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ?? "Unable to upload media to WhatsApp";
    throw new Error(message);
  }

  const mediaId = data?.id;

  if (!mediaId || typeof mediaId !== "string") {
    throw new Error("Meta did not return a media ID");
  }

  return {
    mediaId,
    raw: data,
  };
}
