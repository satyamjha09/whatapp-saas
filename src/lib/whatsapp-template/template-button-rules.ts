export const TEMPLATE_BUTTON_TYPES = [
  "QUICK_REPLY",
  "URL",
  "PHONE_NUMBER",
  "COPY_CODE",
  "FLOW",
  "VOICE_CALL",
  "CATALOG",
  "PAYMENT",
] as const;

export type TemplateButtonType = (typeof TEMPLATE_BUTTON_TYPES)[number];

export type TemplateButtonDraft = {
  id?: string;
  type: TemplateButtonType;
  text?: string;
  url?: string;
  phoneNumber?: string;
  phone_number?: string;
  copyCode?: string;
  couponCode?: string;
  example?: string;
  flowId?: string;
  flow_id?: string;
  flowAction?: "NAVIGATE" | "DATA_EXCHANGE";
  flow_action?: "NAVIGATE" | "DATA_EXCHANGE";
  navigateScreen?: string;
  navigate_screen?: string;
  paymentType?: string;
  paymentConfigId?: string;
};

export type TemplateButtonRuleIssue = {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
  index?: number;
};

export type TemplateButtonValidationInput = {
  templateType: string;
  templateCategory: string;
  buttons: unknown[];
};

export const MAX_TEMPLATE_BUTTONS = 10;
export const COLLAPSED_BUTTON_PREVIEW_LIMIT = 3;

export const BUTTON_TYPE_LABELS: Record<TemplateButtonType, string> = {
  CATALOG: "Catalog",
  COPY_CODE: "Copy code",
  FLOW: "Flow",
  PAYMENT: "Payment",
  PHONE_NUMBER: "Phone",
  QUICK_REPLY: "Quick reply",
  URL: "Website URL",
  VOICE_CALL: "Voice call",
};

const BUTTON_TYPE_ALIASES: Record<string, TemplateButtonType> = {
  CALL: "PHONE_NUMBER",
  CALL_PHONE_NUMBER: "PHONE_NUMBER",
  CATALOG: "CATALOG",
  COPY_CODE: "COPY_CODE",
  COPY_OFFER_CODE: "COPY_CODE",
  FLOW: "FLOW",
  ORDER_DETAILS: "PAYMENT",
  PAYMENT: "PAYMENT",
  PHONE: "PHONE_NUMBER",
  PHONE_NUMBER: "PHONE_NUMBER",
  QUICK_REPLY: "QUICK_REPLY",
  SPM: "CATALOG",
  URL: "URL",
  VOICE_CALL: "VOICE_CALL",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function issue(
  severity: TemplateButtonRuleIssue["severity"],
  code: string,
  message: string,
  index?: number,
): TemplateButtonRuleIssue {
  return {
    code,
    index,
    message,
    severity,
  };
}

export function normalizeTemplateButtonType(value: unknown): TemplateButtonType {
  const normalized = stringValue(value).toUpperCase();

  return BUTTON_TYPE_ALIASES[normalized] ?? "QUICK_REPLY";
}

export function readTemplateButtonDraft(value: unknown): TemplateButtonDraft {
  if (!isRecord(value)) {
    return {
      type: "QUICK_REPLY",
    };
  }

  const type = normalizeTemplateButtonType(value.type ?? value.sub_type);
  const phoneNumber =
    stringValue(value.phoneNumber) || stringValue(value.phone_number);
  const flowId = stringValue(value.flowId) || stringValue(value.flow_id);
  const copyCode =
    stringValue(value.copyCode) ||
    stringValue(value.couponCode) ||
    stringValue(value.example);

  return {
    copyCode,
    couponCode: copyCode,
    flowAction:
      stringValue(value.flowAction || value.flow_action).toUpperCase() ===
      "DATA_EXCHANGE"
        ? "DATA_EXCHANGE"
        : "NAVIGATE",
    flowId,
    id: stringValue(value.id) || undefined,
    navigateScreen:
      stringValue(value.navigateScreen) ||
      stringValue(value.navigate_screen) ||
      undefined,
    paymentConfigId: stringValue(value.paymentConfigId) || undefined,
    paymentType: stringValue(value.paymentType) || undefined,
    phoneNumber,
    text: stringValue(value.text || value.title),
    type,
    url: stringValue(value.url),
  };
}

function filledButtons(buttons: unknown[]) {
  return buttons
    .map(readTemplateButtonDraft)
    .filter((button) => {
      if (button.type === "COPY_CODE") {
        return Boolean(button.text || button.copyCode || button.couponCode);
      }

      if (button.type === "CATALOG" || button.type === "PAYMENT") {
        return Boolean(button.text || button.paymentConfigId || button.paymentType);
      }

      return Boolean(
        button.text ||
          button.url ||
          button.phoneNumber ||
          button.flowId ||
          button.copyCode,
      );
    });
}

function isQuickReply(button: TemplateButtonDraft) {
  return button.type === "QUICK_REPLY";
}

function hasContiguousQuickReplyGroup(buttons: TemplateButtonDraft[]) {
  const quickReplyIndexes = buttons
    .map((button, index) => (isQuickReply(button) ? index : -1))
    .filter((index) => index >= 0);

  if (quickReplyIndexes.length <= 1) return true;

  const first = quickReplyIndexes[0] ?? 0;
  const last = quickReplyIndexes[quickReplyIndexes.length - 1] ?? 0;
  const contiguous = buttons
    .slice(first, last + 1)
    .every((button) => isQuickReply(button));

  return contiguous && (first === 0 || last === buttons.length - 1);
}

function countButtons(
  buttons: TemplateButtonDraft[],
  predicate: (button: TemplateButtonDraft) => boolean,
) {
  return buttons.filter(predicate).length;
}

function validUrl(value: string) {
  try {
    const parsed = new URL(value);

    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isPaymentOrCommerceButton(button: TemplateButtonDraft) {
  return button.type === "PAYMENT" || button.type === "CATALOG";
}

export function validateTemplateButtons({
  buttons,
  templateCategory,
  templateType,
}: TemplateButtonValidationInput): TemplateButtonRuleIssue[] {
  const issues: TemplateButtonRuleIssue[] = [];
  const normalizedButtons = filledButtons(buttons);
  const normalizedTemplateType = templateType.toUpperCase();
  const normalizedCategory = templateCategory.toUpperCase();

  if (normalizedButtons.length > MAX_TEMPLATE_BUTTONS) {
    issues.push(
      issue(
        "ERROR",
        "BUTTON_TOTAL_LIMIT",
        `WhatsApp templates can have at most ${MAX_TEMPLATE_BUTTONS} buttons.`,
      ),
    );
  }

  normalizedButtons.forEach((button, index) => {
    if (button.type !== "COPY_CODE" && button.type !== "PAYMENT" && !button.text) {
      issues.push(
        issue(
          "ERROR",
          "BUTTON_TEXT_REQUIRED",
          `${BUTTON_TYPE_LABELS[button.type]} button needs button text.`,
          index,
        ),
      );
    }

    if (button.text && button.text.length > 25) {
      issues.push(
        issue(
          "ERROR",
          "BUTTON_TEXT_TOO_LONG",
          "Button text must be 25 characters or less.",
          index,
        ),
      );
    }

    if (button.type === "URL") {
      if (!button.url) {
        issues.push(
          issue("ERROR", "BUTTON_URL_REQUIRED", "Website URL button needs a URL.", index),
        );
      } else if (!validUrl(button.url)) {
        issues.push(
          issue("ERROR", "BUTTON_URL_INVALID", "Website URL button needs a valid URL.", index),
        );
      }
    }

    if (button.type === "PHONE_NUMBER" || button.type === "VOICE_CALL") {
      if (!button.phoneNumber) {
        issues.push(
          issue("ERROR", "BUTTON_PHONE_REQUIRED", "Call button needs a phone number.", index),
        );
      } else if (!/^\+[1-9]\d{7,14}$/.test(button.phoneNumber)) {
        issues.push(
          issue(
            "ERROR",
            "BUTTON_PHONE_INVALID",
            "Call button phone number must be in E.164 format, for example +918810386013.",
            index,
          ),
        );
      }
    }

    if (button.type === "COPY_CODE") {
      const code = button.copyCode || button.couponCode || button.example || "";

      if (!code) {
        issues.push(
          issue(
            "ERROR",
            "BUTTON_COPY_CODE_REQUIRED",
            "Copy code button needs a sample code.",
            index,
          ),
        );
      } else if (code.length > 15) {
        issues.push(
          issue(
            "ERROR",
            "BUTTON_COPY_CODE_TOO_LONG",
            "Copy code sample must be 15 characters or less.",
            index,
          ),
        );
      }
    }

    if (button.type === "FLOW" && !button.flowId) {
      issues.push(
        issue("ERROR", "BUTTON_FLOW_ID_REQUIRED", "Flow button needs a published Flow ID.", index),
      );
    }
  });

  if (normalizedCategory === "AUTHENTICATION") {
    if (normalizedButtons.length !== 1 || normalizedButtons[0]?.type !== "COPY_CODE") {
      issues.push(
        issue(
          "ERROR",
          "AUTHENTICATION_BUTTON_RULE",
          "Authentication templates must use a single copy-code button.",
        ),
      );
    }

    return issues;
  }

  if (normalizedTemplateType === "CAROUSEL") {
    return issues;
  }

  const quickReplyCount = countButtons(
    normalizedButtons,
    (button) => button.type === "QUICK_REPLY",
  );
  const urlCount = countButtons(normalizedButtons, (button) => button.type === "URL");
  const phoneCount = countButtons(
    normalizedButtons,
    (button) => button.type === "PHONE_NUMBER" || button.type === "VOICE_CALL",
  );
  const copyCodeCount = countButtons(
    normalizedButtons,
    (button) => button.type === "COPY_CODE",
  );
  const flowCount = countButtons(normalizedButtons, (button) => button.type === "FLOW");
  const commerceCount = countButtons(normalizedButtons, isPaymentOrCommerceButton);

  if (quickReplyCount > 10) {
    issues.push(
      issue("ERROR", "QUICK_REPLY_LIMIT", "A template can have at most 10 quick replies."),
    );
  }

  if (urlCount > 2) {
    issues.push(
      issue("ERROR", "URL_BUTTON_LIMIT", "A template can have at most 2 website URL buttons."),
    );
  }

  if (phoneCount > 1) {
    issues.push(
      issue("ERROR", "PHONE_BUTTON_LIMIT", "A template can have at most 1 call button."),
    );
  }

  if (copyCodeCount > 1) {
    issues.push(
      issue("ERROR", "COPY_CODE_LIMIT", "A template can have at most 1 copy-code button."),
    );
  }

  if (flowCount > 1) {
    issues.push(issue("ERROR", "FLOW_BUTTON_LIMIT", "A template can have at most 1 Flow button."));
  }

  if (commerceCount > 1) {
    issues.push(
      issue(
        "ERROR",
        "COMMERCE_BUTTON_LIMIT",
        "A template can have at most 1 commerce or payment button.",
      ),
    );
  }

  if (!hasContiguousQuickReplyGroup(normalizedButtons)) {
    issues.push(
      issue(
        "ERROR",
        "BUTTON_GROUPING_INVALID",
        "Quick reply buttons must stay together as one group before or after CTA buttons.",
      ),
    );
  }

  if (
    normalizedButtons.some((button) => button.type === "PAYMENT") &&
    normalizedTemplateType !== "PAYMENT"
  ) {
    issues.push(
      issue(
        "ERROR",
        "PAYMENT_BUTTON_TEMPLATE_TYPE",
        "Payment buttons require a payment template type.",
      ),
    );
  }

  if (
    normalizedButtons.some((button) => button.type === "CATALOG") &&
    normalizedTemplateType !== "CATALOG"
  ) {
    issues.push(
      issue(
        "ERROR",
        "CATALOG_BUTTON_TEMPLATE_TYPE",
        "Catalog buttons require a catalog template type.",
      ),
    );
  }

  return issues;
}

export function validateCarouselCardButtons(cards: unknown[]) {
  const issues: TemplateButtonRuleIssue[] = [];

  cards.forEach((card, cardIndex) => {
    if (!isRecord(card) || !Array.isArray(card.buttons)) return;

    const buttons = filledButtons(card.buttons);

    if (buttons.length > 2) {
      issues.push(
        issue(
          "ERROR",
          "CAROUSEL_CARD_BUTTON_LIMIT",
          `Carousel card ${cardIndex + 1} can have at most 2 buttons.`,
          cardIndex,
        ),
      );
    }

    buttons.forEach((button, buttonIndex) => {
      if (!["QUICK_REPLY", "URL", "PHONE_NUMBER"].includes(button.type)) {
        issues.push(
          issue(
            "ERROR",
            "CAROUSEL_BUTTON_TYPE_UNSUPPORTED",
            "Carousel card buttons currently support quick reply, website, and phone buttons.",
            buttonIndex,
          ),
        );
      }
    });
  });

  return issues;
}

export function buildMetaTemplateButton(button: unknown) {
  const draft = readTemplateButtonDraft(button);
  const text = draft.text?.trim();

  if (
    !text &&
    draft.type !== "COPY_CODE" &&
    draft.type !== "PAYMENT" &&
    draft.type !== "CATALOG"
  ) {
    return null;
  }

  if (draft.type === "URL") {
    return {
      text,
      type: "URL",
      url: draft.url?.trim(),
    };
  }

  if (draft.type === "PHONE_NUMBER") {
    return {
      phone_number: draft.phoneNumber?.trim(),
      text,
      type: "PHONE_NUMBER",
    };
  }

  if (draft.type === "VOICE_CALL") {
    return {
      phone_number: draft.phoneNumber?.trim(),
      text,
      type: "VOICE_CALL",
    };
  }

  if (draft.type === "COPY_CODE") {
    return {
      example: draft.copyCode || draft.couponCode || draft.example,
      type: "COPY_CODE",
    };
  }

  if (draft.type === "FLOW") {
    return {
      flow_action: draft.flowAction || draft.flow_action || "NAVIGATE",
      flow_id: draft.flowId || draft.flow_id,
      ...(draft.navigateScreen || draft.navigate_screen
        ? { navigate_screen: draft.navigateScreen || draft.navigate_screen }
        : {}),
      text,
      type: "FLOW",
    };
  }

  if (draft.type === "CATALOG") {
    return {
      text: text || "View catalog",
      type: "SPM",
    };
  }

  if (draft.type === "PAYMENT") {
    return {
      text: text || "Pay now",
      type: "ORDER_DETAILS",
    };
  }

  return {
    text,
    type: "QUICK_REPLY",
  };
}

export function splitButtonsForWhatsAppPreview(buttons: unknown[]) {
  const normalizedButtons = filledButtons(buttons);

  return {
    hidden: normalizedButtons.slice(COLLAPSED_BUTTON_PREVIEW_LIMIT),
    visible: normalizedButtons.slice(0, COLLAPSED_BUTTON_PREVIEW_LIMIT),
  };
}
