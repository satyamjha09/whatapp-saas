import { getSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";

export default async function MaintenanceModeBanner() {
  const maintenanceMode = await getSystemMaintenanceMode();

  if (!maintenanceMode.enabled) {
    return null;
  }

  return (
    <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-3 text-sm text-yellow-900">
      <strong>Maintenance mode is enabled.</strong>{" "}
      {maintenanceMode.message ?? "Some write actions may be unavailable."}
    </div>
  );
}
