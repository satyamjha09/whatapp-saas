import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  getTemplateMediaAssets,
  TemplateMediaAssetError,
  uploadTemplateMediaAsset,
  type TemplateHeaderMediaType,
} from "@/server/services/template-media-asset.service";

function isTemplateHeaderMediaType(value: unknown): value is TemplateHeaderMediaType {
  return value === "IMAGE" || value === "VIDEO" || value === "DOCUMENT";
}

export async function GET(request: Request) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      permission: "TEMPLATE_SYNC",
      request,
      workspace,
    });

    const assets = await getTemplateMediaAssets(workspace.membership.companyId);

    return NextResponse.json({
      assets,
      ok: true,
    });
  } catch (error) {
    return createRoutePermissionErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      permission: "TEMPLATE_SYNC",
      request,
      workspace,
    });

    const formData = await request.formData();
    const file = formData.get("file");
    const mediaType = formData.get("mediaType");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          code: "TEMPLATE_MEDIA_FILE_REQUIRED",
          message: "Upload a media file.",
          ok: false,
        },
        { status: 400 },
      );
    }

    if (!isTemplateHeaderMediaType(mediaType)) {
      return NextResponse.json(
        {
          code: "TEMPLATE_MEDIA_TYPE_INVALID",
          message: "Media type must be IMAGE, VIDEO, or DOCUMENT.",
          ok: false,
        },
        { status: 400 },
      );
    }

    const asset = await uploadTemplateMediaAsset({
      actorUserId: workspace.user.id,
      buffer: Buffer.from(await file.arrayBuffer()),
      companyId: workspace.membership.companyId,
      fileName: file.name,
      mediaType,
      mimeType: file.type,
    });

    return NextResponse.json({
      asset,
      ok: true,
    });
  } catch (error) {
    if (error instanceof TemplateMediaAssetError) {
      return NextResponse.json(
        {
          code: "TEMPLATE_MEDIA_UPLOAD_ERROR",
          message: error.message,
          ok: false,
        },
        { status: error.status },
      );
    }

    return createRoutePermissionErrorResponse(error);
  }
}
