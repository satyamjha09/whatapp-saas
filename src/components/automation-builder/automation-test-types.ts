export type AutomationTestStepStatus =
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "WAITING"
  | "SKIPPED";

export type AutomationTestStep = {
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  id: string;
  input: unknown;
  nodeId: string;
  nodeType: string;
  output: unknown;
  startedAt: string;
  status: AutomationTestStepStatus;
};

export type AutomationTestRun = {
  completedAt: string | null;
  context: unknown;
  currentNodeId: string | null;
  flowId: string;
  graph: unknown;
  highlightedEdgeIds: string[];
  id: string;
  simulatedContact: unknown;
  startedAt: string;
  status: "RUNNING" | "WAITING" | "SUCCESS" | "FAILED" | "CANCELLED";
  steps: AutomationTestStep[];
  updatedAt: string;
  waitingForReply: boolean;
  waitingNodeId: string | null;
};
