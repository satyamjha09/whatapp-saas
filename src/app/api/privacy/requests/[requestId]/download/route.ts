import fs from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  getPrivacyExportDir,
  getPrivacyRequest,
} from "@/server/services/privacy-center.service";
import { createAuditLog } from "@/server/services/audit.service";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

function isInsideExportDir(filePath: string) {
  const relativePath = path.relative(getPrivacyExportDir(), path.resolve(filePath));
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

export async function GET(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { requestId } = await context.params;
  const privacyRequest = await getPrivacyRequest({
    companyId: workspace.membership.companyId,
    requestId,
  });

  if (!privacyRequest?.exportFilePath || !privacyRequest.exportFileName) {
    return NextResponse.json(
      { ok: false, message: "Export file not available" },
      { status: 404 },
    );
  }

  if (privacyRequest.exportExpiresAt && privacyRequest.exportExpiresAt < new Date()) {
    return NextResponse.json(
      { ok: false, message: "Export file has expired" },
      { status: 410 },
    );
  }

  if (!isInsideExportDir(privacyRequest.exportFilePath)) {
    return NextResponse.json(
      { ok: false, message: "Export file path is invalid" },
      { status: 400 },
    );
  }

  const file = await fs.readFile(privacyRequest.exportFilePath);

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "privacy.export_downloaded",
    entityType: "PrivacyRequest",
    entityId: requestId,
  });

  return new Response(file, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${path.basename(
        privacyRequest.exportFileName,
      )}"`,
    },
  });
}
