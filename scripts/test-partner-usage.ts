import assert from "node:assert/strict";
import {
  calculateDailyPartnerUsageFinancials,
  getUtcDayRange,
} from "../src/server/services/partner-usage.service";

const { start, end } = getUtcDayRange("2026-07-16T18:30:00+05:30");
assert.equal(start.toISOString(), "2026-07-16T00:00:00.000Z");
assert.equal(end.toISOString(), "2026-07-17T00:00:00.000Z");

const financials = calculateDailyPartnerUsageFinancials({
  wholesaleAmountPaise: 3000,
  retailAmountPaise: 6000,
  walletDebitPaise: 200,
  currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-07-31T00:00:00.000Z"),
});

assert.equal(financials.platformCostPaise, 100);
assert.equal(financials.retailChargePaise, 400);
assert.equal(financials.grossMarginPaise, 300);
assert.equal(financials.marginBasisPoints, 7500);

console.log("Partner usage calculations passed");
