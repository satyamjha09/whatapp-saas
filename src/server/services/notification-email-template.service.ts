import { toAbsoluteAppUrl } from "@/server/utils/app-url";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function severityColor(severity: string) {
  if (severity === "ERROR") return "#dc2626";
  if (severity === "WARNING") return "#d97706";
  if (severity === "SUCCESS") return "#16a34a";

  return "#2563eb";
}

export function buildNotificationEmailContent({
  title,
  message,
  severity,
  type,
  actionHref,
}: {
  title: string;
  message: string;
  severity: string;
  type: string;
  actionHref?: string | null;
}) {
  const absoluteActionUrl = toAbsoluteAppUrl(actionHref);

  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeSeverity = escapeHtml(severity);
  const safeType = escapeHtml(type);
  const color = severityColor(severity);

  const text = [
    title,
    "",
    message,
    "",
    `Type: ${type}`,
    `Severity: ${severity}`,
    "",
    absoluteActionUrl ? `Open: ${absoluteActionUrl}` : "",
    "",
    "metawhat",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#f3f4f6;padding:24px;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;background:#111827;color:#ffffff;">
        <div style="font-size:18px;font-weight:700;">metawhat</div>
        <div style="margin-top:4px;font-size:13px;color:#d1d5db;">Workspace alert</div>
      </div>

      <div style="padding:24px;">
        <div style="display:inline-block;background:${color};color:#ffffff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;letter-spacing:.02em;">
          ${safeSeverity}
        </div>

        <div style="display:inline-block;margin-left:8px;background:#f3f4f6;color:#374151;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;letter-spacing:.02em;">
          ${safeType}
        </div>

        <h1 style="margin:20px 0 8px;font-size:24px;line-height:1.3;color:#111827;">
          ${safeTitle}
        </h1>

        <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.6;">
          ${safeMessage}
        </p>

        ${
          absoluteActionUrl
            ? `
              <div style="margin-top:24px;">
                <a href="${escapeHtml(
                  absoluteActionUrl,
                )}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:700;">
                  Open in metawhat
                </a>
              </div>
            `
            : ""
        }
      </div>

      <div style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;">
        You received this email because notification email alerts are enabled for your workspace preferences.
      </div>
    </div>
  </body>
</html>
`;

  return {
    text,
    html,
    absoluteActionUrl,
  };
}
