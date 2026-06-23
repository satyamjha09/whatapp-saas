type SecurityHeader = {
  name: string;
  value: string;
};

function isSecurityHeadersEnabled() {
  return process.env.SECURITY_HEADERS_ENABLED !== "false";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function parseCsv(value: string | undefined | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function getAppOrigin() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!appUrl) return null;
  try {
    return new URL(appUrl).origin;
  } catch {
    return null;
  }
}

function directive(name: string, values: string[]) {
  const cleanedValues = unique(values).filter(Boolean);
  if (cleanedValues.length === 0) {
    return name;
  }
  return `${name} ${cleanedValues.join(" ")}`;
}

export function buildContentSecurityPolicy() {
  const scriptSrc = [
    "'self'",
    /* Next.js/Clerk/Razorpay may need inline bootstrap scripts. Keep CSP in report-only first. Tighten later after checking reports. */
    "'unsafe-inline'",
    ...(isProduction() ? [] : ["'unsafe-eval'"]),
    "https://checkout.razorpay.com",
    "https://*.razorpay.com",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://connect.facebook.net",
    ...parseCsv(process.env.SECURITY_EXTRA_SCRIPT_SRC),
  ];

  const connectSrc = [
    "'self'",
    "https://api.clerk.com",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://api.razorpay.com",
    "https://*.razorpay.com",
    "https://graph.facebook.com",
    "https://www.facebook.com",
    ...parseCsv(process.env.SECURITY_EXTRA_CONNECT_SRC),
  ];

  const frameSrc = [
    "https://checkout.razorpay.com",
    "https://api.razorpay.com",
    "https://*.razorpay.com",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://www.facebook.com",
    ...parseCsv(process.env.SECURITY_EXTRA_FRAME_SRC),
  ];

  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://img.clerk.com",
    "https://images.clerk.dev",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://www.facebook.com",
    "https://graph.facebook.com",
    ...parseCsv(process.env.SECURITY_EXTRA_IMG_SRC),
  ];

  const directives = [
    directive("default-src", ["'self'"]),
    directive("base-uri", ["'self'"]),
    directive("object-src", ["'none'"]),
    directive("frame-ancestors", ["'none'"]),
    directive("form-action", ["'self'"]),
    directive("script-src", scriptSrc),
    directive("connect-src", connectSrc),
    directive("frame-src", frameSrc),
    directive("img-src", imgSrc),
    directive("font-src", ["'self'", "data:"]),
    directive("style-src", ["'self'", "'unsafe-inline'"]),
    directive("worker-src", ["'self'", "blob:"]),
    directive("manifest-src", ["'self'"]),
    ...(isProduction() ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

export function getSecurityHeaders(): SecurityHeader[] {
  if (!isSecurityHeadersEnabled()) {
    return [];
  }

  const csp = buildContentSecurityPolicy();
  const cspHeaderName =
    process.env.SECURITY_CSP_MODE === "enforce"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";

  const headers: SecurityHeader[] = [
    {
      name: cspHeaderName,
      value: csp,
    },
    {
      name: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      name: "X-Frame-Options",
      value: "DENY",
    },
    {
      name: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      name: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(self), fullscreen=(self)",
    },
    {
      name: "Cross-Origin-Opener-Policy",
      value: "same-origin-allow-popups",
    },
  ];

  if (isProduction() && process.env.SECURITY_HSTS_ENABLED !== "false") {
    headers.push({
      name: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  return headers;
}

export function setSecurityHeaders(headers: Headers) {
  for (const header of getSecurityHeaders()) {
    headers.set(header.name, header.value);
  }
}

export function getCorsPathPrefixes() {
  return parseCsv(process.env.PUBLIC_API_CORS_PATH_PREFIXES).length > 0
    ? parseCsv(process.env.PUBLIC_API_CORS_PATH_PREFIXES)
    : ["/api/public", "/api/v1"];
}

export function shouldApplyPublicApiCors(pathname: string) {
  return getCorsPathPrefixes().some((prefix) => pathname.startsWith(prefix));
}

export function getAllowedCorsOrigins() {
  return unique([
    ...parseCsv(process.env.PUBLIC_API_ALLOWED_ORIGINS),
    ...(getAppOrigin() ? [getAppOrigin()!] : []),
  ]);
}

export function getCorsHeadersForOrigin(origin: string | null) {
  if (!origin) {
    return {
      allowed: false,
      headers: {},
    };
  }

  const allowedOrigins = getAllowedCorsOrigins();
  const isAllowed = allowedOrigins.includes(origin);

  if (!isAllowed) {
    return {
      allowed: false,
      headers: {},
    };
  }

  return {
    allowed: true,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-API-Key, X-Requested-With",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  };
}

export function getSecurityHeaderSummary() {
  const headers = getSecurityHeaders();
  return {
    enabled: isSecurityHeadersEnabled(),
    cspMode:
      process.env.SECURITY_CSP_MODE === "enforce" ? "enforce" : "report-only",
    hstsEnabled: isProduction() && process.env.SECURITY_HSTS_ENABLED !== "false",
    corsPathPrefixes: getCorsPathPrefixes(),
    allowedCorsOrigins: getAllowedCorsOrigins(),
    headerCount: headers.length,
    headers: headers.map((header) => ({
      name: header.name,
      valuePreview:
        header.value.length > 160
          ? `${header.value.slice(0, 160)}...`
          : header.value,
    })),
  };
}
