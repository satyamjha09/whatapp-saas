import { getIncidentSummary } from "@/server/services/incident.service";

export async function getIncidentHealth() {
  return getIncidentSummary({});
}
