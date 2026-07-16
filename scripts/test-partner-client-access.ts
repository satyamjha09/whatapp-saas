import {
  isPartnerClientGrantUsable,
  isPartnerClientSessionUsable,
} from "../src/server/services/partner-client-access.service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

assert(
  isPartnerClientGrantUsable({
    active: true,
    permissions: ["CLIENT_VIEW", "CLIENT_SUPPORT"],
  }),
  "Active grant with CLIENT_VIEW should be usable.",
);

assert(
  !isPartnerClientGrantUsable({
    active: false,
    permissions: ["CLIENT_VIEW"],
  }),
  "Inactive grant should not be usable.",
);

assert(
  !isPartnerClientGrantUsable({
    active: true,
    expiresAt: past,
    permissions: ["CLIENT_VIEW"],
  }),
  "Expired grant should not be usable.",
);

assert(
  !isPartnerClientGrantUsable({
    active: true,
    permissions: ["CLIENT_SUPPORT"],
  }),
  "Grant without CLIENT_VIEW should not pass client view checks.",
);

assert(
  isPartnerClientSessionUsable({
    expiresAt: future,
    permissions: ["CLIENT_VIEW"],
  }),
  "Live session with CLIENT_VIEW should be usable.",
);

assert(
  !isPartnerClientSessionUsable({
    endedAt: new Date(),
    expiresAt: future,
    permissions: ["CLIENT_VIEW"],
  }),
  "Ended session should not be usable.",
);

assert(
  !isPartnerClientSessionUsable({
    expiresAt: past,
    permissions: ["CLIENT_VIEW"],
  }),
  "Expired session should not be usable.",
);

console.log("Partner client access checks passed.");
