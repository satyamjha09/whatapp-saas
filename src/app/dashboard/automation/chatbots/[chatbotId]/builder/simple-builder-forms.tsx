"use client";

import { useActionState, useMemo, useState } from "react";
import { GitBranch, Plus, Send } from "lucide-react";
import Link from "next/link";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import {
  createChatbotEdgeAction,
  createChatbotNodeAction,
  createChatbotTriggerAction,
  startChatbotWhatsAppTestAction,
  updateChatbotFallbackAction,
  type ChatbotActionState,
} from "../../actions";

type SimpleNode = {
  id: string;
  name: string;
  type: string;
};

const nodeTypes = [
  {
    description: "Send plain WhatsApp text.",
    label: "Message",
    value: "MESSAGE",
  },
  {
    description: "Ask user to choose one of up to 3 buttons.",
    label: "Quick Reply Buttons",
    value: "QUICK_REPLY",
  },
  {
    description: "Show a WhatsApp list menu with up to 10 rows.",
    label: "List Menu",
    value: "LIST_MENU",
  },
  {
    description: "Send an image, video, or document header with buttons.",
    label: "Media + Buttons",
    value: "MEDIA_BUTTONS",
  },
  {
    description: "Ask and save the user's answer.",
    label: "Question",
    value: "QUESTION",
  },
  {
    description: "Branch using a saved answer or last reply.",
    label: "Condition",
    value: "CONDITION",
  },
  {
    description: "Call an external API and save the response.",
    label: "API Call",
    value: "API_CALL",
  },
  {
    description: "Show a product card with a product link.",
    label: "Catalog Product Card",
    value: "CATALOG_PRODUCT_CARD",
  },
  {
    description: "Send a payment link with a CTA button.",
    label: "Payment Link",
    value: "PAYMENT_LINK",
  },
  {
    description: "Lookup invoice details from a Tally endpoint.",
    label: "Tally Invoice Lookup",
    value: "TALLY_INVOICE_LOOKUP",
  },
  {
    description: "Lookup ledger balance from a Tally endpoint.",
    label: "Tally Ledger Balance",
    value: "TALLY_LEDGER_BALANCE",
  },
  {
    description: "Save collected answers to a Google Sheet webhook.",
    label: "Google Sheet Save",
    value: "GOOGLE_SHEET_SAVE",
  },
  {
    description: "Post the conversation context to a webhook.",
    label: "Webhook",
    value: "WEBHOOK",
  },
  {
    description: "Generate or fallback to a smart reply.",
    label: "AI Reply",
    value: "AI_REPLY",
  },
  {
    description: "Hand the conversation to a human.",
    label: "Assign Agent",
    value: "ASSIGN_AGENT",
  },
];

const initialState: ChatbotActionState = {};

function errorText(
  state: ChatbotActionState,
  field: string,
) {
  return state.errors?.[field]?.[0] ?? null;
}

function Feedback({ state }: { state: ChatbotActionState }) {
  if (!state.message) return null;

  return (
    <p
      className={[
        "rounded-xl border px-4 py-3 text-sm",
        state.ok
          ? "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]"
          : "border-rose-200 bg-rose-50 text-rose-700",
      ].join(" ")}
    >
      {state.message}
    </p>
  );
}

export function ChatbotNodeCreateForm({
  chatbotId,
}: {
  chatbotId: string;
}) {
  const [type, setType] = useState("MESSAGE");
  const [state, formAction, isPending] = useActionState(
    createChatbotNodeAction,
    initialState,
  );
  const selected = useMemo(
    () => nodeTypes.find((item) => item.value === type) ?? nodeTypes[0],
    [type],
  );
  const needsBody = [
    "MESSAGE",
    "QUICK_REPLY",
    "LIST_MENU",
    "MEDIA_BUTTONS",
    "QUESTION",
    "ASSIGN_AGENT",
  ].includes(type);
  const needsButtons = type === "QUICK_REPLY" || type === "MEDIA_BUTTONS";
  const needsFallback =
    type === "QUICK_REPLY" || type === "LIST_MENU" || type === "MEDIA_BUTTONS";
  const isApiLike = type === "API_CALL" || type === "WEBHOOK";
  const isTally =
    type === "TALLY_INVOICE_LOOKUP" || type === "TALLY_LEDGER_BALANCE";

  return (
    <form action={formAction} className="space-y-4">
      <input name="chatbotId" type="hidden" value={chatbotId} />

      <div>
        <label className={labelClass} htmlFor="nodeType">
          Node type
        </label>
        <select
          className={fieldClass}
          id="nodeType"
          name="type"
          onChange={(event) => setType(event.target.value)}
          value={type}
        >
          {nodeTypes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <p className={helperTextClass}>{selected.description}</p>
        {errorText(state, "type") ? (
          <p className="mt-2 text-xs text-rose-700">
            {errorText(state, "type")}
          </p>
        ) : null}
      </div>

      <div>
        <label className={labelClass} htmlFor="chatbotNodeLabel">
          Node name
        </label>
        <input
          className={fieldClass}
          id="chatbotNodeLabel"
          maxLength={80}
          name="name"
          placeholder={`${selected.label} node`}
          required
        />
        {errorText(state, "name") ? (
          <p className="mt-2 text-xs text-rose-700">
            {errorText(state, "name")}
          </p>
        ) : null}
      </div>

      {needsBody ? (
        <div>
          <label className={labelClass} htmlFor="nodeBody">
            {type === "ASSIGN_AGENT" ? "Agent note" : "Message text"}
          </label>
          <textarea
            className={`${fieldClass} min-h-24`}
            id="nodeBody"
            maxLength={4096}
            name="body"
            placeholder={
              type === "ASSIGN_AGENT"
                ? "Customer asked for human support."
                : "Hi, how can we help you today?"
            }
            required={type !== "ASSIGN_AGENT"}
          />
          {errorText(state, "body") ? (
            <p className="mt-2 text-xs text-rose-700">
              {errorText(state, "body")}
            </p>
          ) : null}
        </div>
      ) : null}

      {needsButtons ? (
        <div>
          <label className={labelClass} htmlFor="nodeButtons">
            Buttons
          </label>
          <input
            className={fieldClass}
            id="nodeButtons"
            maxLength={500}
            name="buttons"
            placeholder="Sales, Support, Agent"
            required
          />
          <p className={helperTextClass}>
            Comma-separated, max 3 buttons. Each button should be short.
          </p>
          {errorText(state, "buttons") ? (
            <p className="mt-2 text-xs text-rose-700">
              {errorText(state, "buttons")}
            </p>
          ) : null}
        </div>
      ) : null}

      {type === "LIST_MENU" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Header</span>
              <input
                className={fieldClass}
                maxLength={60}
                name="header"
                placeholder="Choose one option"
              />
            </label>
            <label>
              <span className={labelClass}>List button</span>
              <input
                className={fieldClass}
                maxLength={20}
                name="primaryButton"
                placeholder="View options"
                required
              />
            </label>
          </div>
          <div>
            <label className={labelClass} htmlFor="listRows">
              List rows
            </label>
            <textarea
              className={`${fieldClass} min-h-28`}
              id="listRows"
              maxLength={2000}
              name="listRows"
              placeholder={"Sales|Talk to sales team\nSupport|Get customer support\nAgent|Talk to a person"}
              required
            />
            <p className={helperTextClass}>
              One row per line. Use Title|Description. Max 10 rows.
            </p>
            {errorText(state, "listRows") ? (
              <p className="mt-2 text-xs text-rose-700">
                {errorText(state, "listRows")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {type === "MEDIA_BUTTONS" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Media type</span>
              <select className={fieldClass} name="mediaType" required>
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
                <option value="DOCUMENT">Document</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Media name</span>
              <input
                className={fieldClass}
                maxLength={255}
                name="mediaName"
                placeholder="catalog.pdf"
              />
            </label>
          </div>
          <label>
            <span className={labelClass}>Public media URL</span>
            <input
              className={fieldClass}
              name="mediaUrl"
              placeholder="https://example.com/product.jpg"
              type="url"
            />
          </label>
          <label>
            <span className={labelClass}>Meta media ID</span>
            <input
              className={fieldClass}
              maxLength={200}
              name="mediaId"
              placeholder="Optional if you use a URL"
            />
          </label>
          {errorText(state, "mediaUrl") ? (
            <p className="text-xs text-rose-700">
              {errorText(state, "mediaUrl")}
            </p>
          ) : null}
        </div>
      ) : null}

      {(type === "LIST_MENU" || type === "MEDIA_BUTTONS") ? (
        <div>
          <label className={labelClass} htmlFor="nodeFooter">
            Footer
          </label>
          <input
            className={fieldClass}
            id="nodeFooter"
            maxLength={60}
            name="footer"
            placeholder="Powered by metawhat"
          />
        </div>
      ) : null}

      {needsFallback ? (
        <div>
          <label className={labelClass} htmlFor="nodeFallback">
            Fallback message
          </label>
          <textarea
            className={`${fieldClass} min-h-20`}
            id="nodeFallback"
            maxLength={1024}
            name="fallbackMessage"
            placeholder="Please choose one of the available options."
          />
          <p className={helperTextClass}>
            Used when the customer replies with something that does not match this node.
          </p>
        </div>
      ) : null}

      {type === "QUESTION" || type === "CONDITION" ? (
        <div>
          <label className={labelClass} htmlFor="questionField">
            Saved field
          </label>
          <input
            className={fieldClass}
            id="questionField"
            maxLength={60}
            name="questionField"
            placeholder={type === "QUESTION" ? "customer_need" : "customer_need"}
          />
          <p className={helperTextClass}>
            Use letters, numbers, and underscores. Example: customer_need.
          </p>
          {errorText(state, "questionField") ? (
            <p className="mt-2 text-xs text-rose-700">
              {errorText(state, "questionField")}
            </p>
          ) : null}
        </div>
      ) : null}

      {isApiLike ? (
        <div className="space-y-4 rounded-xl border border-[#BFE9D0] p-4">
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <label>
              <span className={labelClass}>Method</span>
              <select className={fieldClass} name="apiMethod">
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Endpoint URL</span>
              <input
                className={fieldClass}
                name={type === "WEBHOOK" ? "webhookUrl" : "apiUrl"}
                placeholder="https://example.com/webhook"
                required
                type="url"
              />
            </label>
          </div>
          {type === "WEBHOOK" ? (
            <label>
              <span className={labelClass}>Webhook secret</span>
              <input
                className={fieldClass}
                maxLength={200}
                name="webhookSecret"
                placeholder="Optional shared secret"
              />
            </label>
          ) : null}
          <label>
            <span className={labelClass}>Headers JSON</span>
            <textarea
              className={`${fieldClass} min-h-20`}
              maxLength={2000}
              name="apiHeaders"
              placeholder='{"Authorization":"Bearer token"}'
            />
          </label>
          <label>
            <span className={labelClass}>Body JSON/template</span>
            <textarea
              className={`${fieldClass} min-h-24`}
              maxLength={4000}
              name="apiBody"
              placeholder='{"phone":"{{last_reply}}","answers":"{{answers}}"}'
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Save response as</span>
              <input
                className={fieldClass}
                maxLength={60}
                name="responseField"
                placeholder="api_result"
              />
            </label>
            <label>
              <span className={labelClass}>Success message</span>
              <input
                className={fieldClass}
                maxLength={1024}
                name="successMessage"
                placeholder="Done, details updated."
              />
            </label>
          </div>
        </div>
      ) : null}

      {type === "GOOGLE_SHEET_SAVE" ? (
        <div className="space-y-4 rounded-xl border border-[#BFE9D0] p-4">
          <label>
            <span className={labelClass}>Google Sheet webhook URL</span>
            <input
              className={fieldClass}
              name="sheetWebhookUrl"
              placeholder="https://script.google.com/macros/s/..."
              required
              type="url"
            />
          </label>
          <label>
            <span className={labelClass}>Payload JSON/template</span>
            <textarea
              className={`${fieldClass} min-h-24`}
              maxLength={4000}
              name="sheetPayload"
              placeholder='{"name":"{{customer_name}}","need":"{{customer_need}}"}'
            />
          </label>
          <label>
            <span className={labelClass}>Success message</span>
            <input
              className={fieldClass}
              maxLength={1024}
              name="successMessage"
              placeholder="Saved to Google Sheet."
            />
          </label>
        </div>
      ) : null}

      {isTally ? (
        <div className="space-y-4 rounded-xl border border-[#BFE9D0] p-4">
          <label>
            <span className={labelClass}>Tally endpoint URL</span>
            <input
              className={fieldClass}
              name="tallyEndpointUrl"
              placeholder="https://example.com/tally/lookup"
              required
              type="url"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Search field</span>
              <input
                className={fieldClass}
                maxLength={80}
                name="tallySearchField"
                placeholder="last_reply"
              />
            </label>
            <label>
              <span className={labelClass}>Save response as</span>
              <input
                className={fieldClass}
                maxLength={60}
                name="responseField"
                placeholder={
                  type === "TALLY_INVOICE_LOOKUP"
                    ? "tally_invoice"
                    : "tally_ledger_balance"
                }
              />
            </label>
          </div>
          <label>
            <span className={labelClass}>Success message</span>
            <input
              className={fieldClass}
              maxLength={1024}
              name="successMessage"
              placeholder="Tally details found."
            />
          </label>
        </div>
      ) : null}

      {type === "CATALOG_PRODUCT_CARD" ? (
        <div className="space-y-4 rounded-xl border border-[#BFE9D0] p-4">
          <label>
            <span className={labelClass}>Product title</span>
            <input
              className={fieldClass}
              maxLength={120}
              name="productTitle"
              placeholder="Premium plan"
              required
            />
          </label>
          <label>
            <span className={labelClass}>Description</span>
            <textarea
              className={`${fieldClass} min-h-20`}
              maxLength={500}
              name="productDescription"
              placeholder="Best for growing businesses."
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Product URL</span>
              <input
                className={fieldClass}
                name="productUrl"
                placeholder="https://example.com/product"
                type="url"
              />
            </label>
            <label>
              <span className={labelClass}>Image URL</span>
              <input
                className={fieldClass}
                name="productImageUrl"
                placeholder="https://example.com/product.jpg"
                type="url"
              />
            </label>
          </div>
          <label>
            <span className={labelClass}>Retailer/Product ID</span>
            <input
              className={fieldClass}
              maxLength={120}
              name="productRetailerId"
              placeholder="SKU-001"
            />
          </label>
        </div>
      ) : null}

      {type === "PAYMENT_LINK" ? (
        <div className="space-y-4 rounded-xl border border-[#BFE9D0] p-4">
          <label>
            <span className={labelClass}>Payment link URL</span>
            <input
              className={fieldClass}
              name="paymentLinkUrl"
              placeholder="https://payments.example.com/pay/..."
              required
              type="url"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Amount</span>
              <input
                className={fieldClass}
                maxLength={40}
                name="paymentAmount"
                placeholder="INR 999"
              />
            </label>
            <label>
              <span className={labelClass}>Button text</span>
              <input
                className={fieldClass}
                maxLength={20}
                name="primaryButton"
                placeholder="Pay now"
              />
            </label>
          </div>
          <label>
            <span className={labelClass}>Description</span>
            <textarea
              className={`${fieldClass} min-h-20`}
              maxLength={500}
              name="paymentDescription"
              placeholder="Complete payment to confirm your order."
            />
          </label>
        </div>
      ) : null}

      {type === "AI_REPLY" ? (
        <div className="space-y-4 rounded-xl border border-[#BFE9D0] p-4">
          <label>
            <span className={labelClass}>AI prompt</span>
            <textarea
              className={`${fieldClass} min-h-28`}
              maxLength={4000}
              name="aiPrompt"
              placeholder="Answer using the customer answers and keep it short."
              required
            />
          </label>
          <label>
            <span className={labelClass}>Fallback reply</span>
            <textarea
              className={`${fieldClass} min-h-20`}
              maxLength={1024}
              name="aiFallback"
              placeholder="Thanks, our team will reply shortly."
            />
          </label>
          <label>
            <span className={labelClass}>Save reply as</span>
            <input
              className={fieldClass}
              maxLength={60}
              name="responseField"
              placeholder="ai_reply"
            />
          </label>
        </div>
      ) : null}

      {type === "CONDITION" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Operator</span>
            <select className={fieldClass} name="conditionOperator">
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="exists">Exists</option>
              <option value="not_equals">Not equals</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Value</span>
            <input
              className={fieldClass}
              maxLength={200}
              name="conditionValue"
              placeholder="sales"
            />
          </label>
        </div>
      ) : null}

      {type === "ASSIGN_AGENT" ? (
        <div>
          <label className={labelClass} htmlFor="assignTo">
            Assign to
          </label>
          <input
            className={fieldClass}
            id="assignTo"
            maxLength={120}
            name="assignTo"
            placeholder="Sales team"
          />
        </div>
      ) : null}

      <Feedback state={state} />

      <button className={actionButtonClass()} disabled={isPending} type="submit">
        <Plus className="mr-2 h-4 w-4" />
        {isPending ? "Adding..." : "Add node"}
      </button>
    </form>
  );
}

const triggerTypes = [
  {
    description: "Start when the message contains a keyword.",
    label: "Keyword",
    value: "KEYWORD",
  },
  {
    description: "Start when a reply matches a regular expression.",
    label: "Regex",
    value: "REGEX",
  },
  {
    description: "Start when the customer replies to a specific template.",
    label: "Template trigger",
    value: "TEMPLATE_MESSAGE",
  },
  {
    description: "Start on the first customer message if this chatbot has never run.",
    label: "Default welcome",
    value: "DEFAULT_WELCOME",
  },
  {
    description: "Start from click-to-WhatsApp ad payload text.",
    label: "Click-to-WhatsApp Ad",
    value: "CLICK_TO_WHATSAPP_AD",
  },
];

export function ChatbotTriggerCreateForm({
  chatbotId,
}: {
  chatbotId: string;
}) {
  const [type, setType] = useState("KEYWORD");
  const [state, formAction, isPending] = useActionState(
    createChatbotTriggerAction,
    initialState,
  );
  const selected = useMemo(
    () => triggerTypes.find((item) => item.value === type) ?? triggerTypes[0],
    [type],
  );
  const valueRequired = type !== "DEFAULT_WELCOME";

  return (
    <form action={formAction} className="space-y-4">
      <input name="chatbotId" type="hidden" value={chatbotId} />

      <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
        <label>
          <span className={labelClass}>Trigger type</span>
          <select
            className={fieldClass}
            name="type"
            onChange={(event) => setType(event.target.value)}
            value={type}
          >
            {triggerTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className={helperTextClass}>{selected.description}</p>
        </label>
        <label>
          <span className={labelClass}>Priority</span>
          <input
            className={fieldClass}
            defaultValue="100"
            max="999"
            min="1"
            name="priority"
            type="number"
          />
        </label>
      </div>

      <div>
        <label className={labelClass} htmlFor="triggerValue">
          Value
        </label>
        <input
          className={fieldClass}
          id="triggerValue"
          maxLength={240}
          name="value"
          placeholder={
            type === "TEMPLATE_MESSAGE"
              ? "hello_world or template id"
              : type === "REGEX"
                ? "^(hi|hello)$"
                : "hi"
          }
          required={valueRequired}
        />
        {errorText(state, "value") ? (
          <p className="mt-2 text-xs text-rose-700">
            {errorText(state, "value")}
          </p>
        ) : null}
      </div>

      <Feedback state={state} />

      <button className={actionButtonClass("secondary")} disabled={isPending} type="submit">
        <Plus className="mr-2 h-4 w-4" />
        {isPending ? "Adding..." : "Add trigger"}
      </button>
    </form>
  );
}

export function ChatbotFallbackForm({
  chatbotId,
  fallbackMessage,
}: {
  chatbotId: string;
  fallbackMessage?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    updateChatbotFallbackAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="chatbotId" type="hidden" value={chatbotId} />
      <div>
        <label className={labelClass} htmlFor="chatbotFallback">
          Fallback message
        </label>
        <textarea
          className={`${fieldClass} min-h-24`}
          defaultValue={fallbackMessage ?? ""}
          id="chatbotFallback"
          maxLength={1024}
          name="fallbackMessage"
          placeholder="Please choose one of the available options."
        />
        <p className={helperTextClass}>
          Used when an interactive node has no matching path.
        </p>
      </div>

      <Feedback state={state} />

      <button className={actionButtonClass("secondary")} disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save fallback"}
      </button>
    </form>
  );
}

export function ChatbotWhatsAppTestForm({
  chatbotId,
}: {
  chatbotId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    startChatbotWhatsAppTestAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="chatbotId" type="hidden" value={chatbotId} />

      <div className="grid gap-3 sm:grid-cols-[92px_1fr]">
        <label>
          <span className={labelClass}>Code</span>
          <input
            className={fieldClass}
            defaultValue="91"
            inputMode="numeric"
            name="countryCode"
            required
          />
        </label>
        <label>
          <span className={labelClass}>WhatsApp number</span>
          <input
            className={fieldClass}
            inputMode="numeric"
            name="phoneNumber"
            placeholder="8810386013"
            required
          />
        </label>
      </div>

      <label>
        <span className={labelClass}>Contact name</span>
        <input
          className={fieldClass}
          maxLength={100}
          name="name"
          placeholder="Test customer"
        />
      </label>

      <label>
        <span className={labelClass}>Test note</span>
        <input
          className={fieldClass}
          maxLength={240}
          name="testMessage"
          placeholder="dashboard_test"
        />
      </label>

      <Feedback state={state} />

      {state.ok && state.sessionId ? (
        <Link
          className={actionButtonClass("secondary")}
          href={`/dashboard/automation/chatbots/${chatbotId}/sessions/${state.sessionId}`}
        >
          View test logs
        </Link>
      ) : null}

      <button className={actionButtonClass()} disabled={isPending} type="submit">
        <Send className="mr-2 h-4 w-4" />
        {isPending ? "Starting..." : "Send WhatsApp test"}
      </button>
    </form>
  );
}

export function ChatbotEdgeCreateForm({
  chatbotId,
  nodes,
}: {
  chatbotId: string;
  nodes: SimpleNode[];
}) {
  const [state, formAction, isPending] = useActionState(
    createChatbotEdgeAction,
    initialState,
  );
  const canConnect = nodes.length >= 2;

  return (
    <form action={formAction} className="space-y-4">
      <input name="chatbotId" type="hidden" value={chatbotId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={labelClass}>From</span>
          <select className={fieldClass} disabled={!canConnect} name="sourceNodeId">
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name} ({node.type.replaceAll("_", " ")})
              </option>
            ))}
          </select>
          {errorText(state, "sourceNodeId") ? (
            <p className="mt-2 text-xs text-rose-700">
              {errorText(state, "sourceNodeId")}
            </p>
          ) : null}
        </label>

        <label>
          <span className={labelClass}>To</span>
          <select className={fieldClass} disabled={!canConnect} name="targetNodeId">
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name} ({node.type.replaceAll("_", " ")})
              </option>
            ))}
          </select>
          {errorText(state, "targetNodeId") ? (
            <p className="mt-2 text-xs text-rose-700">
              {errorText(state, "targetNodeId")}
            </p>
          ) : null}
        </label>
      </div>

      <div>
        <label className={labelClass} htmlFor="edgeLabel">
          Label
        </label>
        <input
          className={fieldClass}
          id="edgeLabel"
          maxLength={80}
          name="label"
          placeholder="Sales path"
        />
      </div>

      <Feedback state={state} />

      <button
        className={actionButtonClass("secondary")}
        disabled={isPending || !canConnect}
        type="submit"
      >
        <GitBranch className="mr-2 h-4 w-4" />
        {isPending ? "Connecting..." : "Connect nodes"}
      </button>
    </form>
  );
}
