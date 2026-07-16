import assert from "node:assert/strict";
import {
  assertRetailPriceMeetsFloor,
  buildPartnerSubscriptionPriceSnapshot,
  PartnerPricingError,
} from "../src/server/services/partner-pricing.service";

function testRetailFloor() {
  assert.doesNotThrow(() =>
    assertRetailPriceMeetsFloor({
      retailAmountPaise: 70000,
      minimumRetailPaise: 70000,
    }),
  );

  assert.throws(
    () =>
      assertRetailPriceMeetsFloor({
        retailAmountPaise: 69999,
        minimumRetailPaise: 70000,
      }),
    PartnerPricingError,
  );
}

function testSnapshot() {
  const snapshot = buildPartnerSubscriptionPriceSnapshot({
    priceBook: {
      id: "price_book_1",
      partnerCompanyId: "partner_1",
      name: "Default",
      currency: "INR",
    },
    priceBookItem: {
      id: "price_book_item_1",
      platformPlanCode: "GROWTH",
      wholesaleMonthlyPaise: 49900,
      minimumRetailPaise: 79900,
      suggestedRetailPaise: 99900,
      includedMessages: 1000,
      extraMessagePaise: 100,
    },
    retailAmountPaise: 99900,
  });

  assert.equal(snapshot.priceBookId, "price_book_1");
  assert.equal(snapshot.priceBookItemId, "price_book_item_1");
  assert.equal(snapshot.platformPlanCode, "GROWTH");
  assert.equal(snapshot.currency, "INR");
  assert.equal(snapshot.wholesaleMonthlyPaise, 49900);
  assert.equal(snapshot.minimumRetailPaise, 79900);
  assert.equal(snapshot.retailAmountPaise, 99900);
  assert.equal(snapshot.includedMessages, 1000);
  assert.ok(Date.parse(snapshot.capturedAt));
}

function testSnapshotRejectsBelowFloor() {
  assert.throws(
    () =>
      buildPartnerSubscriptionPriceSnapshot({
        priceBook: {
          id: "price_book_1",
          partnerCompanyId: "partner_1",
          name: "Default",
          currency: "INR",
        },
        priceBookItem: {
          id: "price_book_item_1",
          platformPlanCode: "BUSINESS",
          wholesaleMonthlyPaise: 99900,
          minimumRetailPaise: 149900,
          suggestedRetailPaise: null,
          includedMessages: null,
          extraMessagePaise: null,
        },
        retailAmountPaise: 149899,
      }),
    PartnerPricingError,
  );
}

testRetailFloor();
testSnapshot();
testSnapshotRejectsBelowFloor();

console.log("Partner pricing tests passed.");
