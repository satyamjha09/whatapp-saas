import assert from "node:assert/strict";
import { calculatePartnerBillingTotals } from "../src/server/services/partner-billing.service";

function run() {
  const taxable = calculatePartnerBillingTotals({
    subtotalPaise: 100_00,
    taxBasisPoints: 1800,
  });

  assert.equal(taxable.subtotalPaise, 100_00);
  assert.equal(taxable.taxPaise, 18_00);
  assert.equal(taxable.totalPaise, 118_00);

  const noTax = calculatePartnerBillingTotals({
    subtotalPaise: 999_00,
    taxBasisPoints: 0,
  });

  assert.equal(noTax.taxPaise, 0);
  assert.equal(noTax.totalPaise, 999_00);

  assert.throws(
    () =>
      calculatePartnerBillingTotals({
        subtotalPaise: -1,
        taxBasisPoints: 0,
      }),
    /Subtotal amount is invalid/,
  );

  assert.throws(
    () =>
      calculatePartnerBillingTotals({
        subtotalPaise: 100_00,
        taxBasisPoints: -1,
      }),
    /Tax basis points are invalid/,
  );

  console.log("Partner billing tests passed");
}

run();
