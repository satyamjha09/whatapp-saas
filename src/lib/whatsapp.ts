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

function getWhatsAppMessagesUrl(phoneNumberId: string) {
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";

  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
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
