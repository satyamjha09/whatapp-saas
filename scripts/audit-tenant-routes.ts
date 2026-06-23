import fs from "node:fs/promises";
import path from "node:path";

const API_DIR = path.join(process.cwd(), "src", "app", "api");
const REVIEWED_NON_TENANT_DYNAMIC_ROUTES = new Set([
  path.join("src", "app", "api", "invites", "[token]", "accept", "route.ts"),
]);

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, {
    withFileTypes: true,
  });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return walk(fullPath);
      }

      if (entry.isFile() && entry.name === "route.ts") {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
}

function isDynamicRoute(filePath: string) {
  return filePath.includes("[") && filePath.includes("]");
}

async function main() {
  const files = await walk(API_DIR);
  const riskyRoutes: Array<{
    file: string;
    hasTenantGuard: boolean;
    hasCompanyIdWhere: boolean;
  }> = [];

  for (const file of files.filter(isDynamicRoute)) {
    const content = await fs.readFile(file, "utf8");

    riskyRoutes.push({
      file: path.relative(process.cwd(), file),
      hasTenantGuard: content.includes("assertTenantEntityAccess"),
      hasCompanyIdWhere: content.includes("companyId"),
    });
  }

  console.log("");
  console.log("Tenant Route Audit");
  console.log("==================");
  console.log("");

  for (const route of riskyRoutes) {
    const isReviewedException = REVIEWED_NON_TENANT_DYNAMIC_ROUTES.has(route.file);
    const status =
      route.hasTenantGuard || route.hasCompanyIdWhere || isReviewedException
        ? "OK"
        : "REVIEW";

    console.log(`${status} ${route.file}`);
    console.log(`   tenant guard: ${route.hasTenantGuard ? "yes" : "no"}`);
    console.log(`   companyId check: ${route.hasCompanyIdWhere ? "yes" : "no"}`);
    if (isReviewedException) {
      console.log("   reviewed exception: non-tenant token route");
    }
    console.log("");
  }

  const unsafeRoutes = riskyRoutes.filter(
    (route) =>
      !route.hasTenantGuard &&
      !route.hasCompanyIdWhere &&
      !REVIEWED_NON_TENANT_DYNAMIC_ROUTES.has(route.file),
  );

  if (unsafeRoutes.length > 0) {
    console.warn(
      `${unsafeRoutes.length} dynamic API routes may need tenant guard review.`,
    );
    process.exitCode = 1;
  }
}

void main();
