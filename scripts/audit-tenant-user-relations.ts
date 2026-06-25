import fs from "node:fs/promises";
import path from "node:path";

const SEARCH_DIRS = ["src"];
const RISKY_RELATIONS = [
  "assignedContacts",
  "inboxNotes",
  "privacyRequests",
] as const;
const USER_QUERY_PATTERN = /prisma\.user\.(findUnique|findFirst|findMany)[\s\S]*?(include|select)\s*:\s*\{[\s\S]*?(assignedContacts|inboxNotes|privacyRequests)\s*:/m;
const SAFE_SERVICE = path.join(
  "src",
  "server",
  "services",
  "tenant-user-relations.service.ts",
);

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "generated") return [];
        return walk(fullPath);
      }

      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
}

async function main() {
  const files = (
    await Promise.all(
      SEARCH_DIRS.map((dir) => walk(path.join(process.cwd(), dir))),
    )
  ).flat();

  const violations: Array<{ file: string; relation: string }> = [];

  for (const file of files) {
    const relativeFile = path.relative(process.cwd(), file);
    if (relativeFile === SAFE_SERVICE) continue;

    const content = await fs.readFile(file, "utf8");
    const match = USER_QUERY_PATTERN.exec(content);

    if (!match) continue;

    const relation = RISKY_RELATIONS.find((item) =>
      match[0].includes(`${item}:`),
    );

    violations.push({
      file: relativeFile,
      relation: relation ?? "unknown",
    });
  }

  console.log("");
  console.log("Tenant User Relation Audit");
  console.log("==========================");
  console.log("");

  if (violations.length === 0) {
    console.log("OK no unsafe User include/select tenant relations found.");
    return;
  }

  for (const violation of violations) {
    console.log(`REVIEW ${violation.file}`);
    console.log(`   relation: ${violation.relation}`);
    console.log(
      "   use companyId + userId scoped queries instead of User relation traversal",
    );
    console.log("");
  }

  process.exitCode = 1;
}

void main();
