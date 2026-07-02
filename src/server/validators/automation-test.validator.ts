import { z } from "zod";
import { automationGraphSchema } from "@/server/validators/automation-builder.validator";

export const automationTestSimulatedContactSchema = z.object({
  countryCode: z.string().trim().min(1).max(8).default("91"),
  customAttributes: z.record(z.string(), z.unknown()).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(120).default("Rahul Sharma"),
  phoneNumber: z.string().trim().min(4).max(20).default("9876543210"),
});

export const startAutomationTestSchema = z.object({
  graph: automationGraphSchema,
  initialMessage: z.string().trim().min(1).max(4096),
  simulatedContact: automationTestSimulatedContactSchema,
});

export const continueAutomationTestSchema = z.object({
  buttonId: z.string().trim().max(120).optional(),
  listItemId: z.string().trim().max(120).optional(),
  messageText: z.string().trim().max(4096).default(""),
  testRunId: z.string().trim().min(1).max(160),
});

export const automationFlowTestParamsSchema = z.object({
  flowId: z.string().trim().min(1).max(160),
});

export const automationTestRunParamsSchema =
  automationFlowTestParamsSchema.extend({
    testRunId: z.string().trim().min(1).max(160),
  });

export type StartAutomationTestInput = z.infer<
  typeof startAutomationTestSchema
>;
export type ContinueAutomationTestInput = z.infer<
  typeof continueAutomationTestSchema
>;
export type AutomationTestSimulatedContact = z.infer<
  typeof automationTestSimulatedContactSchema
>;
