"use client";

import { useMemo } from "react";
import {
  getUserAutomationPermissions,
  type AutomationPermissionName,
} from "@/lib/automation-permissions";

type UseAutomationPermissionsProps = {
  userRole?: string;
  approvalRequired?: boolean;
};

export function useAutomationPermissions({
  userRole = "MEMBER",
  approvalRequired = false,
}: UseAutomationPermissionsProps) {
  const permissions = useMemo(() => {
    return getUserAutomationPermissions(userRole, approvalRequired);
  }, [userRole, approvalRequired]);

  const canEdit = permissions["automation.flow.edit"];
  const canPublish = permissions["automation.flow.publish"];
  const canRequestPublish = permissions["automation.flow.request_publish"];
  const canApprove = permissions["automation.flow.approve_publish"];
  const canTest = permissions["automation.flow.test"];
  const canViewAnalytics = permissions["automation.analytics.view"];
  const canViewExecutions = permissions["automation.execution.view"];

  return {
    permissions,
    canEdit,
    canPublish,
    canRequestPublish,
    canApprove,
    canTest,
    canViewAnalytics,
    canViewExecutions,
  };
}

type PermissionGuardProps = {
  userRole?: string;
  approvalRequired?: boolean;
  permission: AutomationPermissionName;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function PermissionGuard({
  userRole = "MEMBER",
  approvalRequired = false,
  permission,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { permissions } = useAutomationPermissions({ userRole, approvalRequired });

  if (!permissions[permission]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
