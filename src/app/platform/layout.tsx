import { PlatformShell } from "@/app/platform/platform-shell";
import { requirePlatformUser } from "@/server/tenant/tenant-context";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const platform = await requirePlatformUser();

  return (
    <PlatformShell
      permissions={platform.permissions}
      role={platform.platformRole}
      userEmail={platform.user.email}
    >
      {children}
    </PlatformShell>
  );
}
