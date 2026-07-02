"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, MessageCircleReply, TestTube2, X } from "lucide-react";
import AutomationTestContextViewer from "@/components/automation-builder/automation-test-context-viewer";
import AutomationTestInput, {
  type AutomationTestFormState,
} from "@/components/automation-builder/automation-test-input";
import AutomationTestMessagePreview from "@/components/automation-builder/automation-test-message-preview";
import AutomationTestNodeHighlight from "@/components/automation-builder/automation-test-node-highlight";
import AutomationTestStepList from "@/components/automation-builder/automation-test-step-list";
import type { AutomationTestRun } from "@/components/automation-builder/automation-test-types";
import type { AutomationGraph } from "@/components/automation-builder/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getLastOutput(testRun: AutomationTestRun | null) {
  const step = [...(testRun?.steps ?? [])]
    .reverse()
    .find((candidate) => candidate.output);

  return asRecord(step?.output);
}

function getReplyOptions(testRun: AutomationTestRun | null) {
  const output = getLastOutput(testRun);
  const buttons = Array.isArray(output.buttons) ? output.buttons.map(asRecord) : [];
  const sections = Array.isArray(output.sections) ? output.sections.map(asRecord) : [];
  const listItems = sections.flatMap((section) =>
    Array.isArray(section.items) ? section.items.map(asRecord) : [],
  );

  return {
    buttons: buttons.map((button) => ({
      id: String(button.id ?? ""),
      label: String(button.label ?? button.id ?? ""),
    })).filter((button) => button.id || button.label),
    listItems: listItems.map((item) => ({
      id: String(item.id ?? ""),
      label: String(item.title ?? item.id ?? ""),
    })).filter((item) => item.id || item.label),
  };
}

async function readJsonResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Automation test failed",
    );
  }

  return data as { testRun: AutomationTestRun };
}

const defaultForm: AutomationTestFormState = {
  countryCode: "91",
  customAttributes: "{\n  \"leadSource\": \"builder_test\"\n}",
  email: "",
  initialMessage: "hi",
  name: "Rahul Sharma",
  phoneNumber: "9876543210",
};

export default function AutomationTestPanel({
  flowId,
  graph,
  graphKey,
  isOpen,
  onClose,
  onSelectNode,
  onTestRunChange,
  testRun,
}: {
  flowId: string;
  graph: AutomationGraph;
  graphKey: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onTestRunChange: (testRun: AutomationTestRun | null) => void;
  testRun: AutomationTestRun | null;
}) {
  const [form, setForm] = useState(defaultForm);
  const [replyText, setReplyText] = useState("");
  const [selectedButtonId, setSelectedButtonId] = useState("");
  const [selectedListItemId, setSelectedListItemId] = useState("");
  const [runGraphKey, setRunGraphKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replyOptions = useMemo(() => getReplyOptions(testRun), [testRun]);
  const flowChanged = Boolean(testRun && runGraphKey && runGraphKey !== graphKey);

  if (!isOpen) return null;

  async function runTest() {
    setIsLoading(true);
    setError(null);

    try {
      const customAttributes = form.customAttributes.trim()
        ? JSON.parse(form.customAttributes)
        : {};
      const response = await fetch(
        `/api/automation/flows/${encodeURIComponent(flowId)}/test/start`,
        {
          body: JSON.stringify({
            graph,
            initialMessage: form.initialMessage,
            simulatedContact: {
              countryCode: form.countryCode,
              customAttributes,
              email: form.email || undefined,
              name: form.name,
              phoneNumber: form.phoneNumber,
            },
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const data = await readJsonResponse(response);

      setRunGraphKey(graphKey);
      onTestRunChange(data.testRun);
      setReplyText("");
      setSelectedButtonId("");
      setSelectedListItemId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to run test");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendReply() {
    if (!testRun) return;

    setIsLoading(true);
    setError(null);

    try {
      const selectedButton = replyOptions.buttons.find(
        (button) => button.id === selectedButtonId,
      );
      const selectedListItem = replyOptions.listItems.find(
        (item) => item.id === selectedListItemId,
      );
      const messageText =
        replyText ||
        selectedButton?.label ||
        selectedButton?.id ||
        selectedListItem?.label ||
        selectedListItem?.id ||
        "";
      const response = await fetch(
        `/api/automation/flows/${encodeURIComponent(flowId)}/test/message`,
        {
          body: JSON.stringify({
            buttonId: selectedButtonId || undefined,
            listItemId: selectedListItemId || undefined,
            messageText,
            testRunId: testRun.id,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const data = await readJsonResponse(response);

      onTestRunChange(data.testRun);
      setReplyText("");
      setSelectedButtonId("");
      setSelectedListItemId("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to send test reply",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function resetTest() {
    if (!testRun) {
      onTestRunChange(null);
      setRunGraphKey(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/automation/flows/${encodeURIComponent(flowId)}/test/${encodeURIComponent(testRun.id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok && response.status !== 404) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.message === "string" ? data.message : "Unable to reset test",
        );
      }

      onTestRunChange(null);
      setRunGraphKey(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset test");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#BFE9D0] bg-white shadow-[0_16px_36px_rgba(8,27,58,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E7F8EF] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
            <TestTube2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-[#081B3A]">Live Test Mode</p>
            <p className="mt-1 text-xs text-[#526173]">
              Testing draft. Published automation is unchanged.
            </p>
            <div className="mt-3">
              <AutomationTestNodeHighlight />
            </div>
          </div>
        </div>
        <button
          className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
          onClick={onClose}
          type="button"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)_minmax(0,390px)]">
        <div className="grid content-start gap-4">
          <AutomationTestInput
            disabled={isLoading}
            form={form}
            onChange={setForm}
            onReset={resetTest}
            onRun={runTest}
          />
          {testRun?.waitingForReply ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">Waiting for reply</p>
              {replyOptions.buttons.length > 0 ? (
                <label className="mt-3 grid gap-1.5 text-xs font-semibold text-amber-800">
                  Button reply
                  <select
                    className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-[#081B3A] outline-none"
                    onChange={(event) => setSelectedButtonId(event.target.value)}
                    value={selectedButtonId}
                  >
                    <option value="">Select button</option>
                    {replyOptions.buttons.map((button) => (
                      <option key={button.id || button.label} value={button.id}>
                        {button.label || button.id}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {replyOptions.listItems.length > 0 ? (
                <label className="mt-3 grid gap-1.5 text-xs font-semibold text-amber-800">
                  List item
                  <select
                    className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-[#081B3A] outline-none"
                    onChange={(event) => setSelectedListItemId(event.target.value)}
                    value={selectedListItemId}
                  >
                    <option value="">Select item</option>
                    {replyOptions.listItems.map((item) => (
                      <option key={item.id || item.label} value={item.id}>
                        {item.label || item.id}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="mt-3 grid gap-1.5 text-xs font-semibold text-amber-800">
                Reply text
                <input
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-[#081B3A] outline-none"
                  onChange={(event) => setReplyText(event.target.value)}
                  value={replyText}
                />
              </label>
              <button
                className="mt-3 inline-flex items-center rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                onClick={sendReply}
                type="button"
              >
                <MessageCircleReply className="mr-1.5 h-3.5 w-3.5" />
                Send Reply
              </button>
            </div>
          ) : null}
          {flowChanged ? (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Flow changed. Restart test to use latest graph.
            </div>
          ) : null}
          {error ? (
            <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
        </div>

        <div className="grid content-start gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#081B3A]">Execution steps</p>
              <p className="mt-1 text-xs text-[#526173]">
                {testRun?.status ?? "NOT_STARTED"}
              </p>
            </div>
            {testRun ? (
              <span className="rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-bold text-[#128C7E]">
                {testRun.steps.length} steps
              </span>
            ) : null}
          </div>
          <AutomationTestStepList
            onSelectNode={onSelectNode}
            steps={testRun?.steps ?? []}
          />
        </div>

        <div className="grid content-start gap-4">
          <div>
            <p className="text-sm font-bold text-[#081B3A]">Preview</p>
            <p className="mt-1 text-xs text-[#526173]">
              Simulated WhatsApp output
            </p>
          </div>
          <AutomationTestMessagePreview steps={testRun?.steps ?? []} />
          <AutomationTestContextViewer context={testRun?.context} />
        </div>
      </div>
    </section>
  );
}
