"use client";

import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import TemplatePreviewCard from "@/components/automation-builder/template-preview-card";
import TemplateSelectorModal, {
  type AutomationTemplateOption,
} from "@/components/automation-builder/template-selector-modal";
import TemplateVariableMappingEditor from "@/components/automation-builder/template-variable-mapping-editor";
import type {
  NodeFormProps,
  TemplateVariableMapping,
} from "@/components/automation-builder/types";
import { buildTemplatePreview } from "@/lib/automation-builder/template-preview";
import type {
  TemplateButtonVariableMetadataItem,
  TemplateVariableMetadata,
  TemplateVariableMetadataItem,
} from "@/lib/automation-builder/template-variables";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

function asMappings(value: unknown): TemplateVariableMapping[] {
  return Array.isArray(value)
    ? value.filter(
        (mapping): mapping is TemplateVariableMapping =>
          Boolean(mapping) &&
          typeof mapping === "object" &&
          "variableName" in mapping &&
          "sourceType" in mapping &&
          "sourceValue" in mapping,
      )
    : [];
}

function buildMappings(
  variables: TemplateVariableMetadataItem[],
  component: TemplateVariableMapping["component"],
  current: TemplateVariableMapping[],
) {
  return variables.map((variable) => {
    const existing = current.find(
      (mapping) =>
        mapping.component === component &&
        mapping.variableName === variable.variableName &&
        mapping.index === variable.index,
    );

    return (
      existing ?? {
        component,
        index: variable.index,
        sourceType: "STATIC" as const,
        sourceValue: "",
        variableName: variable.variableName,
      }
    );
  });
}

function buildButtonMappings(
  variables: TemplateButtonVariableMetadataItem[],
  current: TemplateVariableMapping[],
) {
  return variables.map((variable) => {
    const existing = current.find(
      (mapping) =>
        mapping.component === "BUTTON" &&
        mapping.variableName === variable.variableName &&
        mapping.index === variable.index,
    );

    return (
      existing ?? {
        component: "BUTTON" as const,
        index: variable.index,
        sourceType: "STATIC" as const,
        sourceValue: "",
        variableName: variable.variableName,
      }
    );
  });
}

function allMappings(draft: NodeFormProps["draft"]) {
  return [
    ...asMappings(draft.headerVariableMappings),
    ...asMappings(draft.bodyVariableMappings),
    ...asMappings(draft.buttonVariableMappings),
  ];
}

export default function SendTemplateNodeForm({
  draft,
  errors,
  setDraft,
}: NodeFormProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [template, setTemplate] = useState<AutomationTemplateOption | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    if (!draft.templateId || template?.id === draft.templateId) return;

    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) setLoadingTemplate(true);
    });

    fetch(`/api/automation/templates/${draft.templateId}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as {
          template?: AutomationTemplateOption;
        };
        return data.template ?? null;
      })
      .then((loadedTemplate) => {
        if (!loadedTemplate) return;

        setTemplate(loadedTemplate);
        setDraft((current) => ({
          ...current,
          category: loadedTemplate.category,
          headerType: loadedTemplate.variableMetadata.headerType,
          languageCode: loadedTemplate.languageCode,
          templateName: loadedTemplate.name,
          templateStatus: loadedTemplate.status,
        }));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTemplate(false);
      });

    return () => controller.abort();
  }, [draft.templateId, setDraft, template?.id]);

  const mappings = useMemo(() => allMappings(draft), [draft]);
  const preview = useMemo(() => {
    if (!template) return null;
    return buildTemplatePreview(template, mappings, draft.mediaUrl);
  }, [draft.mediaUrl, mappings, template]);

  function applySelectedTemplate(selectedTemplate: AutomationTemplateOption) {
    const metadata: TemplateVariableMetadata = selectedTemplate.variableMetadata;

    setTemplate(selectedTemplate);
    setDraft((current) => ({
      ...current,
      bodyVariableMappings: buildMappings(
        metadata.body,
        "BODY",
        asMappings(current.bodyVariableMappings),
      ),
      buttonVariableMappings: buildButtonMappings(
        metadata.buttons,
        asMappings(current.buttonVariableMappings),
      ),
      category: selectedTemplate.category,
      headerType: metadata.headerType,
      headerVariableMappings: buildMappings(
        metadata.header,
        "HEADER",
        asMappings(current.headerVariableMappings),
      ),
      languageCode: selectedTemplate.languageCode,
      mediaUrl: metadata.mediaRequired ? current.mediaUrl ?? "" : current.mediaUrl,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      templateStatus: selectedTemplate.status,
    }));
  }

  const headerType = draft.headerType ?? template?.variableMetadata.headerType ?? "NONE";
  const needsMediaUrl = ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#081B3A]">
              {draft.templateName || draft.templateId || "No template selected"}
            </p>
            <p className="mt-1 text-xs text-[#526173]">
              {draft.category || "Select an approved WhatsApp template"}
            </p>
          </div>
          <button
            className="inline-flex shrink-0 items-center rounded-xl bg-[#128C7E] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#075E54]"
            onClick={() => setSelectorOpen(true)}
            type="button"
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Select
          </button>
        </div>
        {loadingTemplate ? (
          <p className="mt-3 text-xs text-[#526173]">Loading template details...</p>
        ) : null}
        <FieldError message={errors.templateId} />
      </div>

      <label className="block">
        <span className={labelClass}>Language code</span>
        <input
          className={fieldClass}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              languageCode: event.target.value,
            }))
          }
          placeholder="en_US"
          value={draft.languageCode ?? "en_US"}
        />
        <FieldError message={errors.languageCode} />
      </label>

      {preview ? (
        <TemplatePreviewCard preview={preview} />
      ) : (
        <div className="rounded-xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-4 text-sm leading-6 text-[#526173]">
          Select a template to see preview and required variables.
        </div>
      )}

      <TemplateVariableMappingEditor
        component="HEADER"
        mappings={asMappings(draft.headerVariableMappings)}
        onChange={(headerVariableMappings) =>
          setDraft((current) => ({ ...current, headerVariableMappings }))
        }
        title="Header variables"
      />

      <TemplateVariableMappingEditor
        component="BODY"
        mappings={asMappings(draft.bodyVariableMappings)}
        onChange={(bodyVariableMappings) =>
          setDraft((current) => ({ ...current, bodyVariableMappings }))
        }
        title="Body variables"
      />

      <TemplateVariableMappingEditor
        component="BUTTON"
        mappings={asMappings(draft.buttonVariableMappings)}
        onChange={(buttonVariableMappings) =>
          setDraft((current) => ({ ...current, buttonVariableMappings }))
        }
        title="Button variables"
      />

      {needsMediaUrl ? (
        <label className="block">
          <span className={labelClass}>{headerType} media URL</span>
          <input
            className={fieldClass}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                mediaUrl: event.target.value,
              }))
            }
            placeholder="https://cdn.example.com/header-image.jpg"
            value={draft.mediaUrl ?? ""}
          />
          <FieldError message={errors.mediaUrl} />
        </label>
      ) : null}

      <label className="block">
        <span className={labelClass}>Fallback message</span>
        <textarea
          className={`${fieldClass} min-h-24 resize-y`}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              fallbackMessage: event.target.value,
            }))
          }
          placeholder="If the template cannot be sent, send this text later during runtime."
          value={draft.fallbackMessage ?? ""}
        />
        <FieldError message={errors.fallbackMessage} />
      </label>

      <TemplateSelectorModal
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={applySelectedTemplate}
      />
    </div>
  );
}
