export function getAppBaseUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";

  return rawUrl.replace(/\/$/, "");
}

export function toAbsoluteAppUrl(href?: string | null) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href).toString();
  } catch {
    const baseUrl = getAppBaseUrl();
    const safeHref = href.startsWith("/") ? href : `/${href}`;

    return `${baseUrl}${safeHref}`;
  }
}
