import crypto from "node:crypto";

const placeholderValues = new Set([
  "your_cashfree_client_id",
  "your_cashfree_client_secret",
]);

export type CashfreeOrderResponse = {
  cf_order_id?: number | string;
  order_id?: string;
  order_amount?: number;
  order_currency?: string;
  order_status?: string;
  payment_session_id?: string;
  message?: string;
  type?: string;
};

export type CashfreePaymentResponse = {
  cf_payment_id?: number | string;
  order_id?: string;
  payment_status?: string;
  payment_amount?: number;
  payment_currency?: string;
  payment_message?: string;
};

export type CashfreeRefundResponse = {
  cf_refund_id?: number | string;
  refund_id?: string;
  order_id?: string;
  refund_amount?: number;
  refund_currency?: string;
  refund_status?: string;
  refund_note?: string;
  message?: string;
};

type CashfreeRefundApiResponse = CashfreeRefundResponse | CashfreeRefundResponse[];

export type CashfreeWebhookPayload = {
  type?: string;
  event_time?: string;
  data?: {
    order?: {
      order_id?: string;
      order_amount?: number;
      order_currency?: string;
      order_status?: string;
    };
    payment?: {
      cf_payment_id?: number | string;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
      payment_message?: string;
    };
  };
};

export function getCashfreeCredentials() {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret ||
    placeholderValues.has(clientId) ||
    placeholderValues.has(clientSecret)
  ) {
    throw new Error("Cashfree credentials are not configured");
  }

  return {
    clientId,
    clientSecret,
    apiVersion: process.env.CASHFREE_API_VERSION || "2025-01-01",
    env: process.env.CASHFREE_ENV === "sandbox" ? "sandbox" : "production",
  };
}

export function isCashfreeCheckoutConfigured() {
  try {
    getCashfreeCredentials();
    return true;
  } catch {
    return false;
  }
}

export function getCashfreeCheckoutMode() {
  return getCashfreeCredentials().env;
}

export function getCashfreeBaseUrl() {
  return getCashfreeCredentials().env === "sandbox"
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";
}

function cashfreeHeaders() {
  const { clientId, clientSecret, apiVersion } = getCashfreeCredentials();

  return {
    "Content-Type": "application/json",
    "x-api-version": apiVersion,
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
  };
}

function amountRupees(amountPaise: number) {
  return Number((amountPaise / 100).toFixed(2));
}

function cashfreeMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message) {
      return message;
    }
  }

  return fallback;
}

function normalizeCashfreeRefundResponse(
  data: CashfreeRefundApiResponse,
  refundId?: string,
) {
  if (!Array.isArray(data)) {
    return data;
  }

  return (
    data.find((refund) => refund.refund_id === refundId) ??
    data.find((refund) => String(refund.cf_refund_id ?? "") === refundId) ??
    data[0]
  );
}

export async function createCashfreeOrder({
  amountPaise,
  currency,
  customer,
  notifyUrl,
  orderId,
  returnUrl,
  tags,
}: {
  amountPaise: number;
  currency: string;
  customer: {
    id: string;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
  };
  notifyUrl?: string | null;
  orderId: string;
  returnUrl?: string | null;
  tags?: Record<string, string>;
}) {
  const response = await fetch(`${getCashfreeBaseUrl()}/pg/orders`, {
    method: "POST",
    headers: cashfreeHeaders(),
    body: JSON.stringify({
      order_id: orderId,
      order_amount: amountRupees(amountPaise),
      order_currency: currency,
      customer_details: {
        customer_id: customer.id,
        ...(customer.email ? { customer_email: customer.email } : {}),
        ...(customer.name ? { customer_name: customer.name } : {}),
        ...(customer.phone ? { customer_phone: customer.phone } : {}),
      },
      order_meta: {
        ...(returnUrl ? { return_url: returnUrl } : {}),
        ...(notifyUrl ? { notify_url: notifyUrl } : {}),
      },
      order_tags: tags,
    }),
  });
  const data = (await response.json()) as CashfreeOrderResponse;

  if (!response.ok) {
    throw new Error(data.message ?? "Unable to create Cashfree order");
  }

  if (
    !data.order_id ||
    !data.payment_session_id ||
    data.order_id !== orderId ||
    data.order_currency?.toUpperCase() !== currency.toUpperCase()
  ) {
    throw new Error("Cashfree returned an invalid order");
  }

  return data;
}

export async function fetchCashfreeOrder(orderId: string) {
  const response = await fetch(
    `${getCashfreeBaseUrl()}/pg/orders/${encodeURIComponent(orderId)}`,
    {
      headers: cashfreeHeaders(),
    },
  );
  const data = (await response.json()) as CashfreeOrderResponse;

  if (!response.ok) {
    throw new Error(data.message ?? "Unable to fetch Cashfree order");
  }

  return data;
}

export async function fetchCashfreePaymentsForOrder(orderId: string) {
  const response = await fetch(
    `${getCashfreeBaseUrl()}/pg/orders/${encodeURIComponent(orderId)}/payments`,
    {
      headers: cashfreeHeaders(),
    },
  );
  const data = (await response.json()) as CashfreePaymentResponse[] | {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      !Array.isArray(data) && data.message
        ? data.message
        : "Unable to fetch Cashfree payments",
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function createCashfreeRefund({
  amountPaise,
  note,
  orderId,
  refundId,
}: {
  amountPaise: number;
  note?: string | null;
  orderId: string;
  refundId: string;
}) {
  const response = await fetch(
    `${getCashfreeBaseUrl()}/pg/orders/${encodeURIComponent(orderId)}/refunds`,
    {
      method: "POST",
      headers: {
        ...cashfreeHeaders(),
        "x-idempotency-key": refundId,
      },
      body: JSON.stringify({
        refund_id: refundId,
        refund_amount: amountRupees(amountPaise),
        refund_note: note ?? undefined,
      }),
    },
  );
  const data = (await response.json()) as CashfreeRefundApiResponse;
  const refund = normalizeCashfreeRefundResponse(data, refundId);

  if (!response.ok) {
    throw new Error(cashfreeMessage(data, "Unable to create Cashfree refund"));
  }

  if (!refund?.refund_id && !refund?.cf_refund_id) {
    throw new Error("Cashfree returned an invalid refund");
  }

  return refund;
}

export async function fetchCashfreeRefund({
  orderId,
  refundId,
}: {
  orderId: string;
  refundId: string;
}) {
  const response = await fetch(
    `${getCashfreeBaseUrl()}/pg/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`,
    {
      headers: cashfreeHeaders(),
    },
  );
  const data = (await response.json()) as CashfreeRefundApiResponse;
  const refund = normalizeCashfreeRefundResponse(data, refundId);

  if (!response.ok) {
    throw new Error(cashfreeMessage(data, "Unable to fetch Cashfree refund"));
  }

  if (!refund?.refund_id && !refund?.cf_refund_id) {
    throw new Error("Cashfree returned an invalid refund");
  }

  return refund;
}

export async function getPaidCashfreePaymentForOrder(orderId: string) {
  const [order, payments] = await Promise.all([
    fetchCashfreeOrder(orderId),
    fetchCashfreePaymentsForOrder(orderId),
  ]);
  const paidPayment = payments.find(
    (payment) =>
      payment.order_id === orderId &&
      payment.payment_status?.toUpperCase() === "SUCCESS",
  );

  return {
    order,
    payment: paidPayment,
    isPaid:
      order.order_status?.toUpperCase() === "PAID" ||
      Boolean(paidPayment),
  };
}

export function extractCashfreePaymentFromWebhook(
  payload: CashfreeWebhookPayload,
) {
  const order = payload.data?.order;
  const payment = payload.data?.payment;

  return {
    eventType: payload.type ?? "unknown",
    orderId: order?.order_id,
    paymentId:
      payment?.cf_payment_id !== undefined
        ? String(payment.cf_payment_id)
        : undefined,
    amountPaise:
      payment?.payment_amount !== undefined
        ? Math.round(payment.payment_amount * 100)
        : order?.order_amount !== undefined
          ? Math.round(order.order_amount * 100)
          : undefined,
    currency: payment?.payment_currency ?? order?.order_currency,
    paymentStatus: payment?.payment_status,
    orderStatus: order?.order_status,
    failureReason: payment?.payment_message,
  };
}

export function verifyCashfreeWebhookSignature({
  rawBody,
  signatureHeader,
  timestampHeader,
}: {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
}) {
  const { clientSecret } = getCashfreeCredentials();

  if (!signatureHeader) {
    throw new Error("Missing x-webhook-signature header");
  }

  if (!timestampHeader) {
    throw new Error("Missing x-webhook-timestamp header");
  }

  const expected = crypto
    .createHmac("sha256", clientSecret)
    .update(`${timestampHeader}${rawBody}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function getCashfreeWebhookEventId({
  body,
  signature,
  timestamp,
}: {
  body: CashfreeWebhookPayload;
  signature?: string | null;
  timestamp?: string | null;
}) {
  const payment = body.data?.payment;
  const order = body.data?.order;
  const paymentId =
    payment?.cf_payment_id !== undefined ? String(payment.cf_payment_id) : "";

  return [
    body.type ?? "cashfree.webhook",
    order?.order_id ?? "",
    paymentId,
    body.event_time ?? timestamp ?? signature ?? "",
  ]
    .filter(Boolean)
    .join(":");
}
