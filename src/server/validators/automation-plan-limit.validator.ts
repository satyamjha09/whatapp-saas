import { z } from "zod";

export const UsageCheckInputSchema = z.object({
  action: z.enum([
    "CREATE_FLOW",
    "PUBLISH_FLOW",
    "RUN_TEST",
    "RUN_EXECUTION",
    "USE_TEMPLATE",
  ]),
  graph: z.unknown().optional(),
  flowId: z.string().optional(),
  nodeTypes: z.array(z.string()).optional(),
  templateSlug: z.string().optional(),
});

export type UsageCheckInput = z.infer<typeof UsageCheckInputSchema>;
