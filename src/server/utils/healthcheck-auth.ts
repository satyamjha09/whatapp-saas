import { headers } from "next/headers";

export async function assertHealthcheckToken() {
  const expectedToken = process.env.HEALTHCHECK_TOKEN;

  if (!expectedToken) {
    throw new Error("HEALTHCHECK_TOKEN is not configured");
  }

  const requestHeaders = await headers();

  const headerToken = requestHeaders.get("x-healthcheck-token");
  const authHeader = requestHeaders.get("authorization");

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  const providedToken = headerToken ?? bearerToken;

  if (!providedToken || providedToken !== expectedToken) {
    throw new Error("Invalid healthcheck token");
  }
}
