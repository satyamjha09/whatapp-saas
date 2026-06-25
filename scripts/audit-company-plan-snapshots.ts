import "dotenv/config";
import {
  getCompanyPlanSnapshotMismatches,
  syncCompanyBillingSnapshotFromPlanAssignment,
} from "@/server/services/company-plan-assignment.service";

const shouldFix = process.argv.includes("--fix");

async function main() {
  const mismatches = await getCompanyPlanSnapshotMismatches({ limit: 1000 });

  console.log("");
  console.log("Company Plan Snapshot Audit");
  console.log("===========================");
  console.log("");

  if (mismatches.length === 0) {
    console.log("OK all Company billing snapshots match current plan assignments.");
    return;
  }

  for (const item of mismatches) {
    console.log(`REVIEW ${item.companyName} (${item.companyId})`);
    console.log(`   assignment: ${item.assignmentId}`);
    console.log(`   plan: ${item.planCode} / ${item.status}`);
    for (const mismatch of item.mismatches) {
      console.log(
        `   ${mismatch.field}: expected=${mismatch.expected ?? "null"} actual=${mismatch.actual ?? "null"}`,
      );
    }

    if (shouldFix) {
      await syncCompanyBillingSnapshotFromPlanAssignment(item.companyId);
      console.log("   fixed: Company billing snapshot synchronized");
    }

    console.log("");
  }

  if (!shouldFix) {
    console.error(
      `${mismatches.length} company billing snapshot(s) differ from current plan assignments.`,
    );
    console.error("Run npm run audit:company-plan-snapshots -- --fix to repair.");
    process.exitCode = 1;
  }
}

void main();
