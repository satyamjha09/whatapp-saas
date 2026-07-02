"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import type { AutomationFlowNode } from "@/components/automation-builder/node-renderer";
import type {
  ButtonReplyRoute,
  NodeFormProps,
} from "@/components/automation-builder/types";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>
  ) : null;
}

function asRoutes(value: unknown): ButtonReplyRoute[] {
  return Array.isArray(value)
    ? value.filter(
        (route): route is ButtonReplyRoute =>
          Boolean(route) &&
          typeof route === "object" &&
          "buttonId" in route &&
          "buttonLabel" in route,
      )
    : [];
}

function routesFromNode(node: AutomationFlowNode | undefined): ButtonReplyRoute[] {
  if (!node) return [];

  if (node.data.nodeType === "QUICK_REPLY" && Array.isArray(node.data.buttons)) {
    return node.data.buttons.map((button) => ({
      buttonId: button.id,
      buttonLabel: button.label,
    }));
  }

  if (node.data.nodeType === "LIST_MESSAGE" && Array.isArray(node.data.sections)) {
    return node.data.sections.flatMap((section) =>
      section.items.map((item) => ({
        buttonId: item.id,
        buttonLabel: item.title,
      })),
    );
  }

  return [];
}

function updateRoute(
  routes: ButtonReplyRoute[],
  index: number,
  patch: Partial<ButtonReplyRoute>,
) {
  return routes.map((route, routeIndex) =>
    routeIndex === index ? { ...route, ...patch } : route,
  );
}

export default function ButtonReplyRouterNodeForm({
  currentNodeId,
  draft,
  errors,
  nodes,
  setDraft,
}: NodeFormProps & {
  currentNodeId: string;
  nodes: AutomationFlowNode[];
}) {
  const sourceOptions = nodes.filter(
    (node) =>
      node.id !== currentNodeId &&
      ["QUICK_REPLY", "LIST_MESSAGE", "SEND_TEMPLATE"].includes(
        node.data.nodeType,
      ),
  );
  const routes = asRoutes(draft.routes);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Source node</span>
        <select
          className={fieldClass}
          onChange={(event) => {
            const sourceNode = nodes.find(
              (node) => node.id === event.target.value,
            );
            const generatedRoutes = routesFromNode(sourceNode);

            setDraft((current) => ({
              ...current,
              routes:
                generatedRoutes.length > 0
                  ? generatedRoutes
                  : asRoutes(current.routes),
              sourceNodeId: event.target.value,
            }));
          }}
          value={draft.sourceNodeId ?? ""}
        >
          <option value="">Choose source node</option>
          {sourceOptions.map((node) => (
            <option key={node.id} value={node.id}>
              {node.data.label} ({node.data.nodeType})
            </option>
          ))}
        </select>
        <FieldError message={errors.sourceNodeId} />
      </label>

      <div className="rounded-xl border border-[#BFE9D0] bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#081B3A]">Routes</p>
            <p className="mt-1 text-xs text-[#526173]">
              One output handle is created for each route.
            </p>
          </div>
          <button
            className="inline-flex items-center rounded-lg bg-[#E7F8EF] px-2.5 py-2 text-xs font-bold text-[#128C7E]"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                routes: [
                  ...asRoutes(current.routes),
                  {
                    buttonId: `button_${routes.length + 1}`,
                    buttonLabel: `Button ${routes.length + 1}`,
                  },
                ],
              }))
            }
            type="button"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {routes.length === 0 ? (
          <p className="rounded-lg bg-[#F8FCFA] p-3 text-xs text-[#526173]">
            Choose a source with buttons or add routes manually.
          </p>
        ) : (
          <div className="space-y-3">
            {routes.map((route, index) => (
              <div
                className="grid gap-3 rounded-lg border border-[#E7F8EF] bg-[#F8FCFA] p-3"
                key={`${route.buttonId}-${index}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
                    route:{route.buttonId || index + 1}
                  </p>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        routes: asRoutes(current.routes).filter(
                          (_route, routeIndex) => routeIndex !== index,
                        ),
                      }))
                    }
                    title="Remove route"
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <label className="block">
                  <span className={labelClass}>Button ID</span>
                  <input
                    className={fieldClass}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        routes: updateRoute(asRoutes(current.routes), index, {
                          buttonId: event.target.value,
                        }),
                      }))
                    }
                    value={route.buttonId}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>Button label</span>
                  <input
                    className={fieldClass}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        routes: updateRoute(asRoutes(current.routes), index, {
                          buttonLabel: event.target.value,
                        }),
                      }))
                    }
                    value={route.buttonLabel}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
        <FieldError message={errors.routes} />
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3">
        <input
          checked={draft.fallbackEnabled !== false}
          className="h-4 w-4 rounded border-[#BFE9D0] text-[#128C7E]"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              fallbackEnabled: event.target.checked,
            }))
          }
          type="checkbox"
        />
        <span>
          <span className="block text-sm font-bold text-[#081B3A]">
            Enable fallback path
          </span>
          <span className="mt-1 block text-xs text-[#526173]">
            Adds a fallback output handle for unmatched replies.
          </span>
        </span>
      </label>
    </div>
  );
}
