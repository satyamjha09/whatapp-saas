import { z } from "zod";

export const UseTemplateInputSchema = z.object({
  name: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  triggerKeyword: z.string().trim().max(50).optional(),
  templateMappings: z.record(z.string(), z.string()).optional(),
  integrationMappings: z.record(z.string(), z.string()).optional(),
});

export type UseTemplateInput = z.infer<typeof UseTemplateInputSchema>;
