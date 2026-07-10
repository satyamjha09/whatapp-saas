export type PublicUrlPolicyResult = {
  ok: boolean;
  reason?: string;
};

const BLOCKED_TUNNEL_HOSTS = [
  "ngrok-free.dev",
  "ngrok.io",
  "trycloudflare.com",
  "loca.lt",
  "localtunnel.me",
];

function isPrivateIPv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    first === 0
  );
}

export function validatePublicMediaUrl(value: string): PublicUrlPolicyResult {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "Media URL must be a valid absolute URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Media URL must use HTTPS." };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    isPrivateIPv4(hostname)
  ) {
    return { ok: false, reason: "Local and private media URLs are not allowed." };
  }

  if (BLOCKED_TUNNEL_HOSTS.some((blocked) => hostname.endsWith(blocked))) {
    return {
      ok: false,
      reason: "Temporary tunnel URLs are not allowed for Meta template review.",
    };
  }

  return { ok: true };
}

export function assertPublicMediaUrl(value: string) {
  const result = validatePublicMediaUrl(value);

  if (!result.ok) {
    throw new Error(result.reason ?? "Media URL is not allowed.");
  }
}
