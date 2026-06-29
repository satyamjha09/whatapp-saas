import "dotenv/config";
import axios from "axios";

const recipients = [
  { label: "8178444398", to: "918178444398" },
  { label: "+91 88268 26645", to: "918826826645" },
  { label: "+91 83739 46470", to: "918373946470" },
  { label: "+91 83759 38947", to: "918375938947" },
];

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v25.0";

if (!accessToken || !phoneNumberId) {
  throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required.");
}

function getMetaErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response
  ) {
    const data = error.response.data as {
      error?: { message?: string; code?: number; error_subcode?: number };
    };
    const metaError = data.error;

    if (metaError?.message) {
      return `${metaError.message} (code ${metaError.code ?? "unknown"}, subcode ${metaError.error_subcode ?? "none"})`;
    }
  }

  return error instanceof Error ? error.message : "Unknown error";
}

async function main() {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const results = [];

  for (const recipient of recipients) {
    try {
      const response = await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          to: recipient.to,
          type: "template",
          template: {
            name: "hello_world",
            language: {
              code: "en_US",
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 20_000,
        },
      );

      results.push({
        input: recipient.label,
        to: recipient.to,
        ok: true,
        messageId: response.data?.messages?.[0]?.id ?? null,
      });
    } catch (error) {
      results.push({
        input: recipient.label,
        to: recipient.to,
        ok: false,
        error: getMetaErrorMessage(error),
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main();
