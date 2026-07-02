import { z } from "zod";

const mappingValueSchema = z.string().trim().max(200);

export const UseTemplateInputSchema = z.object({
  name: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  triggerKeyword: z.string().trim().max(50).optional(),
  templateMappings: z.record(z.string(), mappingValueSchema).optional(),
  integrationMappings: z.record(z.string(), mappingValueSchema).optional(),
});

export type UseTemplateInput = z.infer<typeof UseTemplateInputSchema>;
