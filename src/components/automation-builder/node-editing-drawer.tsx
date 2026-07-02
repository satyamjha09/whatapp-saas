"use client";

import { Copy, PanelRightClose, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import type { AutomationFlowNode } from "@/components/automation-builder/node-renderer";
import ApiNodeForm from "@/components/automation-builder/node-forms/api-node-form";
import ButtonReplyRouterNodeForm from "@/components/automation-builder/node-forms/button-reply-router-node-form";
import ConditionNodeForm from "@/components/automation-builder/node-forms/condition-node-form";
import HandoffNodeForm from "@/components/automation-builder/node-forms/handoff-node-form";
import MessageNodeForm from "@/components/automation-builder/node-forms/message-node-form";
import QuickReplyNodeForm from "@/components/automation-builder/node-forms/quick-reply-node-form";
import TemplateNodeForm from "@/components/automation-builder/node-forms/template-node-form";
import TemplateTriggerNodeForm from "@/components/automation-builder/node-forms/template-trigger-node-form";
import WaitForReplyNodeForm from "@/components/automation-builder/node-forms/wait-for-reply-node-form";
import {
  createDefaultNodeData,
  getAutomationNodeLabel,
  normalizeAutomationNodeData,
  type AutomationEditableNodeData,
  type AutomationNodeData,
  type AutomationNodeType,
  type ButtonReplyRoute,
  type QuickReplyButton,
  type TemplateVariableMapping,
} from "@/components/automation-builder/types";

type NodeEditingDrawerProps = {
  isOpen: boolean;
  node: AutomationFlowNode | null;
  nodes: AutomationFlowNode[];
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onSave: (nodeId: string, data: AutomationNodeData) => void;
};

type NodeEditingDrawerContentProps = Omit<
  NodeEditingDrawerProps,
  "isOpen" | "node"
> & {
  node: AutomationFlowNode;
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

function isBlank(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0;
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readButtons(value: unknown): QuickReplyButton[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (button): button is QuickReplyButton =>
        Boolean(button) &&
        typeof button === "object" &&
        "id" in button &&
        "label" in button,
    )
    .map((button) => ({
      id: String(button.id),
      label: String(button.label),
    }));
}

function readMappings(value: unknown): TemplateVariableMapping[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (mapping): mapping is TemplateVariableMapping =>
      Boolean(mapping) &&
      typeof mapping === "object" &&
      "variableName" in mapping &&
      "sourceType" in mapping &&
      "sourceValue" in mapping,
  );
}

function readRoutes(value: unknown): ButtonReplyRoute[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (route): route is ButtonReplyRoute =>
      Boolean(route) &&
      typeof route === "object" &&
      "buttonId" in route &&
      "buttonLabel" in route,
  );
}

function validateNode(
  type: AutomationNodeType,
  draft: AutomationEditableNodeData,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (isBlank(draft.label)) {
    errors.label = "Node label is required.";
  }

  if (type === "SEND_MESSAGE" && isBlank(draft.messageText)) {
    errors.messageText = "Message text is required.";
  }

  if (type === "TEMPLATE_TRIGGER") {
    if (isBlank(draft.triggerName)) {
      errors.triggerName = "Trigger name is required.";
    }
    if (
      draft.triggerMode === "SPECIFIC_TEMPLATE_REPLY" &&
      isBlank(draft.templateId)
    ) {
      errors.templateId = "Template is required.";
    }
    if (
      draft.triggerMode === "SPECIFIC_CAMPAIGN_REPLY" &&
      isBlank(draft.campaignId)
    ) {
      errors.campaignId = "Campaign ID is required.";
    }
    if (
      draft.triggerMode === "BUTTON_REPLY" &&
      (!Array.isArray(draft.buttonIds) || draft.buttonIds.length === 0)
    ) {
      errors.buttonIds = "At least one button ID is required.";
    }
  }

  if (type === "QUICK_REPLY") {
    const buttons = readButtons(draft.buttons).filter((button) =>
      button.label.trim(),
    );

    if (isBlank(draft.bodyText)) {
      errors.bodyText = "Body text is required.";
    }

    if (buttons.length === 0) {
      errors.buttons = "At least one button is required.";
    }
  }

  if (type === "LIST_MESSAGE") {
    if (isBlank(draft.bodyText)) errors.bodyText = "Body text is required.";
    if (isBlank(draft.buttonText)) errors.buttonText = "Button text is required.";
  }

  if (type === "CONDITION") {
    if (isBlank(draft.variable)) errors.variable = "Variable is required.";
    if (isBlank(draft.operator)) errors.operator = "Operator is required.";
    if (isBlank(draft.value)) errors.value = "Value is required.";
  }

  if (type === "SEND_TEMPLATE") {
    if (isBlank(draft.templateId)) {
      errors.templateId = "Template ID is required.";
    }
    if (isBlank(draft.languageCode)) {
      errors.languageCode = "Language code is required.";
    }
    if (
      !isBlank(draft.templateStatus) &&
      draft.templateStatus !== "APPROVED"
    ) {
      errors.templateId = "Only approved templates can be used.";
    }
    if (
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(String(draft.headerType)) &&
      isBlank(draft.mediaUrl)
    ) {
      errors.mediaUrl = "Media URL is required for this template header.";
    }
    if (String(draft.fallbackMessage ?? "").length > 1024) {
      errors.fallbackMessage = "Fallback message cannot exceed 1024 characters.";
    }

    const missingMapping = [
      ...readMappings(draft.headerVariableMappings),
      ...readMappings(draft.bodyVariableMappings),
      ...readMappings(draft.buttonVariableMappings),
    ].find((mapping) => !mapping.sourceValue.trim());

    if (missingMapping) {
      errors.templateId = `Map variable {{${missingMapping.variableName}}}.`;
    }
  }

  if (type === "WAIT_FOR_REPLY") {
    const timeoutMinutes = Number(draft.timeoutMinutes);
    if (!Number.isFinite(timeoutMinutes) || timeoutMinutes < 1) {
      errors.timeoutMinutes = "Timeout must be at least 1 minute.";
    }
    if (isBlank(draft.saveReplyAs)) {
      errors.saveReplyAs = "Save variable is required.";
    }
  }

  if (type === "BUTTON_REPLY_ROUTER") {
    if (isBlank(draft.sourceNodeId)) {
      errors.sourceNodeId = "Source node is required.";
    }

    const routes = readRoutes(draft.routes);
    if (routes.length === 0) {
      errors.routes = "At least one route is required.";
    }

    const routeIds = routes.map((route) => route.buttonId.trim().toLowerCase());
    if (new Set(routeIds).size !== routeIds.length) {
      errors.routes = "Route button IDs must be unique.";
    }
  }

  if (type === "API_CALL") {
    if (isBlank(draft.url)) {
      errors.url = "API URL is required.";
    } else if (!isValidHttpUrl(String(draft.url))) {
      errors.url = "Enter a valid http or https URL.";
    }
  }

  if (type === "HUMAN_HANDOFF" && isBlank(draft.messageToCustomer)) {
    errors.messageToCustomer = "Handoff message is required.";
  }

  if (type === "HUMAN_HANDOFF" && draft.assignmentMode === "SPECIFIC_USER" && isBlank(draft.assignedUserId)) {
    errors.assignedUserId = "Assigned user is required.";
  }

  if ((type === "ADD_TAG" || type === "REMOVE_TAG") && isBlank(draft.tagName)) {
    errors.tagName = "Tag name is required.";
  }

  if (type === "UPDATE_CONTACT_FIELD") {
    if (isBlank(draft.fieldName)) errors.fieldName = "Field name is required.";
    if (isBlank(draft.fieldValue)) errors.fieldValue = "Field value is required.";
  }

  if (type === "DELAY") {
    const duration = Number(draft.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      errors.duration = "Duration must be positive.";
    }
  }

  return errors;
}

function createDraft(node: AutomationFlowNode | null): AutomationEditableNodeData {
  if (!node) return createDefaultNodeData("SEND_MESSAGE");

  const data: Record<string, unknown> = { ...node.data };
  delete data.nodeType;
  delete data.validationIssueCount;
  delete data.validationSeverity;

  return {
    ...createDefaultNodeData(node.data.nodeType),
    ...data,
    label: node.data.label,
  };
}

function parseKeywords(value: string) {
  return value
    .split(/[\n,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function stringifyArray(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value ?? [], null, 2);
}

export default function NodeEditingDrawer({
  isOpen,
  node,
  nodes,
  onClose,
  onDelete,
  onDuplicate,
  onSave,
}: NodeEditingDrawerProps) {
  if (!isOpen || !node) {
    return (
      <aside className="w-full rounded-2xl border border-dashed border-[#BFE9D0] bg-white/80 p-5 text-sm leading-6 text-[#526173] shadow-[0_14px_34px_rgba(8,27,58,0.06)] xl:w-[420px] xl:shrink-0">
        Click a node on the canvas to edit its label and configuration.
      </aside>
    );
  }

  return (
    <NodeEditingDrawerContent
      key={node.id}
      node={node}
      nodes={nodes}
      onClose={onClose}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
      onSave={onSave}
    />
  );
}

function NodeEditingDrawerContent({
  node,
  nodes,
  onClose,
  onDelete,
  onDuplicate,
  onSave,
}: NodeEditingDrawerContentProps) {
  const [draft, setDraft] = useState<AutomationEditableNodeData>(() =>
    createDraft(node),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const drawerTitle = useMemo(
    () => `${getAutomationNodeLabel(node.data.nodeType)} settings`,
    [node.data.nodeType],
  );

  function saveNode() {
    const nextErrors = validateNode(node.data.nodeType, draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSave(
      node.id,
      normalizeAutomationNodeData(node.data.nodeType, {
        ...draft,
        label: String(draft.label).trim(),
      }),
    );
  }

  function closeDrawer() {
    onClose();
  }

  function deleteNode() {
    const confirmed = window.confirm(
      `Delete "${node.data.label}" from this automation graph?`,
    );

    if (confirmed) {
      onDelete(node.id);
    }
  }

  return (
    <aside className="flex max-h-[720px] w-full flex-col overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white shadow-[0_18px_44px_rgba(8,27,58,0.10)] xl:w-[430px] xl:shrink-0">
      <div className="flex items-start justify-between gap-4 border-b border-[#BFE9D0] p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
            {getAutomationNodeLabel(node.data.nodeType)}
          </p>
          <h2 className="mt-1 truncate text-lg font-bold text-[#081B3A]">
            {drawerTitle}
          </h2>
        </div>
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#BFE9D0] text-[#128C7E] transition hover:bg-[#E7F8EF]"
          onClick={closeDrawer}
          title="Close drawer"
          type="button"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <label className="block">
          <span className={labelClass}>Node label</span>
          <input
            className={fieldClass}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                label: event.target.value,
              }))
            }
            placeholder="Welcome Message"
            value={draft.label}
          />
          <FieldError message={errors.label} />
        </label>

        {node.data.nodeType === "START" ? (
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Trigger type</span>
              <select
                className={fieldClass}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    triggerType: event.target.value,
                  }))
                }
                value={draft.triggerType ?? "KEYWORD"}
              >
                <option value="KEYWORD">Keyword</option>
                <option value="DEFAULT">Default</option>
                <option value="TEMPLATE_REPLY">Template reply</option>
                <option value="BUTTON_REPLY">Button reply</option>
                <option value="WEBHOOK">Webhook</option>
                <option value="MANUAL">Manual</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Keywords</span>
              <textarea
                className={`${fieldClass} min-h-28 resize-y`}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    keywords: parseKeywords(event.target.value),
                  }))
                }
                placeholder="hi&#10;hello&#10;start"
                value={Array.isArray(draft.keywords) ? draft.keywords.join("\n") : ""}
              />
            </label>
          </div>
        ) : null}

        {node.data.nodeType === "TEMPLATE_TRIGGER" ? (
          <TemplateTriggerNodeForm
            draft={draft}
            errors={errors}
            setDraft={setDraft}
          />
        ) : null}

        {node.data.nodeType === "SEND_MESSAGE" ? (
          <MessageNodeForm draft={draft} errors={errors} setDraft={setDraft} />
        ) : null}

        {node.data.nodeType === "QUICK_REPLY" ? (
          <QuickReplyNodeForm
            draft={draft}
            errors={errors}
            setDraft={setDraft}
          />
        ) : null}

        {node.data.nodeType === "LIST_MESSAGE" ? (
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Body text</span>
              <textarea
                className={`${fieldClass} min-h-28 resize-y`}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    bodyText: event.target.value,
                  }))
                }
                placeholder="Please choose from the list below."
                value={draft.bodyText ?? ""}
              />
              <FieldError message={errors.bodyText} />
            </label>

            <label className="block">
              <span className={labelClass}>Button text</span>
              <input
                className={fieldClass}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    buttonText: event.target.value,
                  }))
                }
                placeholder="View options"
                value={draft.buttonText ?? ""}
              />
              <FieldError message={errors.buttonText} />
            </label>

            <label className="block">
              <span className={labelClass}>Sections JSON</span>
              <textarea
                className={`${fieldClass} min-h-40 resize-y font-mono`}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sections: event.target.value,
                  }))
                }
                placeholder='[{"id":"main","title":"Main options","items":[{"id":"sales","title":"Sales"}]}]'
                value={stringifyArray(draft.sections)}
              />
            </label>
          </div>
        ) : null}

        {node.data.nodeType === "CONDITION" ? (
          <ConditionNodeForm draft={draft} errors={errors} setDraft={setDraft} />
        ) : null}

        {node.data.nodeType === "SEND_TEMPLATE" ? (
          <TemplateNodeForm draft={draft} errors={errors} setDraft={setDraft} />
        ) : null}

        {node.data.nodeType === "WAIT_FOR_REPLY" ? (
          <WaitForReplyNodeForm
            draft={draft}
            errors={errors}
            setDraft={setDraft}
          />
        ) : null}

        {node.data.nodeType === "BUTTON_REPLY_ROUTER" ? (
          <ButtonReplyRouterNodeForm
            currentNodeId={node.id}
            draft={draft}
            errors={errors}
            nodes={nodes}
            setDraft={setDraft}
          />
        ) : null}

        {node.data.nodeType === "API_CALL" ? (
          <ApiNodeForm draft={draft} errors={errors} setDraft={setDraft} />
        ) : null}

        {node.data.nodeType === "HUMAN_HANDOFF" ? (
          <HandoffNodeForm draft={draft} errors={errors} setDraft={setDraft} />
        ) : null}

        {node.data.nodeType === "ADD_TAG" || node.data.nodeType === "REMOVE_TAG" ? (
          <label className="block">
            <span className={labelClass}>Tag name</span>
            <input
              className={fieldClass}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  tagName: event.target.value,
                }))
              }
              placeholder="lead"
              value={draft.tagName ?? ""}
            />
            <FieldError message={errors.tagName} />
          </label>
        ) : null}

        {node.data.nodeType === "UPDATE_CONTACT_FIELD" ? (
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Field name</span>
              <input
                className={fieldClass}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    fieldName: event.target.value,
                  }))
                }
                placeholder="lead_stage"
                value={draft.fieldName ?? ""}
              />
              <FieldError message={errors.fieldName} />
            </label>

            <label className="block">
              <span className={labelClass}>Field value</span>
              <input
                className={fieldClass}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    fieldValue: event.target.value,
                  }))
                }
                placeholder="new"
                value={draft.fieldValue ?? ""}
              />
              <FieldError message={errors.fieldValue} />
            </label>
          </div>
        ) : null}

        {node.data.nodeType === "DELAY" ? (
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Duration</span>
              <input
                className={fieldClass}
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    duration: Number(event.target.value),
                  }))
                }
                type="number"
                value={String(draft.duration ?? 5)}
              />
              <FieldError message={errors.duration} />
            </label>

            <label className="block">
              <span className={labelClass}>Unit</span>
              <select
                className={fieldClass}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    unit: event.target.value,
                  }))
                }
                value={draft.unit ?? "MINUTES"}
              >
                <option value="SECONDS">Seconds</option>
                <option value="MINUTES">Minutes</option>
                <option value="HOURS">Hours</option>
                <option value="DAYS">Days</option>
              </select>
            </label>
          </div>
        ) : null}

        {node.data.nodeType === "END" ? (
          <label className="block">
            <span className={labelClass}>End reason</span>
            <input
              className={fieldClass}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  endReason: event.target.value,
                }))
              }
              placeholder="Completed"
              value={draft.endReason ?? ""}
            />
          </label>
        ) : null}
      </div>

      <div className="border-t border-[#BFE9D0] bg-[#F8FCFA] p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className={actionButtonClass()}
            onClick={saveNode}
            type="button"
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </button>
          <button
            className={actionButtonClass("secondary")}
            onClick={() => onDuplicate(node.id)}
            type="button"
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </button>
        </div>
        <button
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          onClick={deleteNode}
          type="button"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Node
        </button>
      </div>
    </aside>
  );
}
