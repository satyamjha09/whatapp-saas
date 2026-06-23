import "dotenv/config";
import { getProductionEnvAudit } from "@/server/services/production-env-audit.service";

const audit = getProductionEnvAudit();

console.log("");
console.log("TallyKonnect Production Doctor");
console.log("================================");
console.log("");

for (const item of audit.items) {
  const icon =
    item.severity === "PASS" ? "✅" : item.severity === "WARNING" ? "⚠️" : "❌";

  console.log(`${icon} ${item.title}`);
  console.log(`   ${item.message}`);
  console.log("");
}

console.log("Summary");
console.log("-------");
console.log(`Passed:   ${audit.passedCount}`);
console.log(`Warnings: ${audit.warningCount}`);
console.log(`Failed:   ${audit.failedCount}`);
console.log("");

if (!audit.isHealthy) {
  console.error("Production doctor failed. Fix the failed items before deploy.");
  process.exit(1);
}

console.log("Production doctor passed.");
