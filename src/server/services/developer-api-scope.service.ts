import type { DeveloperApiScope } from "@/server/config/developer-api-scopes";

export function assertDeveloperApiScope({
  scopes,
  requiredScope,
}: {
  scopes: string[];
  requiredScope: DeveloperApiScope;
}) {
  if (!scopes.includes(requiredScope)) {
    throw new Error(`API key is missing required scope: ${requiredScope}`);
  }
}

export function hasDeveloperApiScope({
  scopes,
  requiredScope,
}: {
  scopes: string[];
  requiredScope: DeveloperApiScope;
}) {
  return scopes.includes(requiredScope);
}
