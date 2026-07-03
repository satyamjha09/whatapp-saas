import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "metawhat Public API",
      version: "1.0.0",
      description: "Stable public API for WhatsApp messaging and CRM automation.",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          description: "Use your metawhat API key as the Bearer token.",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["ok", "error"],
          properties: {
            ok: { type: "boolean", const: false },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
                requestId: { type: "string", format: "uuid" },
              },
            },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/messages/send-template": {
        post: {
          operationId: "sendTemplateMessage",
          summary: "Send WhatsApp template message",
          description: "Queues an approved template message. Requires Idempotency-Key.",
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              schema: { type: "string", maxLength: 200 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["to", "templateName"],
                  properties: {
                    to: { type: "string", example: "918810386013" },
                    templateName: { type: "string", example: "hello_world" },
                    language: { type: "string", default: "en_US" },
                    bodyParameters: { type: "array", items: { type: "string" } },
                    contactName: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Message queued" },
            "400": { description: "Invalid request or missing Idempotency-Key" },
            "401": { description: "Unauthorized" },
            "402": { description: "Wallet balance or quota unavailable" },
            "403": { description: "Forbidden" },
            "404": { description: "Template not found" },
            "409": { description: "Idempotency conflict or request processing" },
            "413": { description: "Request body too large" },
            "422": { description: "Validation error" },
            "500": { description: "Internal server error" },
          },
        },
      },
    },
  });
}
