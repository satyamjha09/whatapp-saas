import net from "net";

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)
  ) {
    return null;
  }

  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

function isIpv4InCidr(ip: string, cidr: string) {
  const [rangeIp, prefixText] = cidr.split("/");
  const prefix = Number(prefixText);

  if (!rangeIp || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const ipNumber = ipv4ToNumber(ip);
  const rangeNumber = ipv4ToNumber(rangeIp);

  if (ipNumber === null || rangeNumber === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

  return (ipNumber & mask) === (rangeNumber & mask);
}

export function isValidIpAllowlistEntry(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return false;

  if (trimmed.includes("/")) {
    const [ip, prefix] = trimmed.split("/");

    return (
      net.isIP(ip) === 4 &&
      Number.isInteger(Number(prefix)) &&
      Number(prefix) >= 0 &&
      Number(prefix) <= 32
    );
  }

  return net.isIP(trimmed) !== 0;
}

export function isIpAllowed({
  requestIp,
  allowedIps,
}: {
  requestIp: string | null;
  allowedIps: string[];
}) {
  if (allowedIps.length === 0) {
    return true;
  }

  if (!requestIp) {
    return false;
  }

  return allowedIps.some((entry) => {
    const value = entry.trim();

    if (value === requestIp) {
      return true;
    }

    if (value.includes("/") && net.isIP(requestIp) === 4) {
      return isIpv4InCidr(requestIp, value);
    }

    return false;
  });
}
