import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPublicMediaUrl } from "@/lib/whatsapp-template/media-url-policy";
import { createAuditLog } from "@/server/services/audit.service";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";

export type TemplateHeaderMediaType = "IMAGE" | "VIDEO" | "DOCUMENT";

export class TemplateMediaAssetError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TemplateMediaAssetError";
    this.status = status;
  }
}

const MEDIA_RULES: Record<
  TemplateHeaderMediaType,
  {
    extensions: string[];
    maxBytes: number;
    mimeTypes: string[];
  }
> = {
  DOCUMENT: {
    extensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"],
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "text/plain",
    ],
  },
  IMAGE: {
    extensions: [".jpg", ".jpeg", ".png"],
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png"],
  },
  VIDEO: {
    extensions: [".mp4", ".3gp"],
    maxBytes: 16 * 1024 * 1024,
    mimeTypes: ["video/mp4", "video/3gpp"],
  },
};

function getGraphBaseUrl() {
  const version = process.env.WHATSAPP_API_VERSION ?? "v25.0";
  return `https://graph.facebook.com/${version}`;
}

function getMetaAppId() {
  return (
    process.env.META_APP_ID ||
    process.env.NEXT_PUBLIC_META_APP_ID ||
    process.env.FACEBOOK_APP_ID ||
    process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ||
    ""
  ).trim();
}

function getPublicBaseUrl() {
  const value = (
    process.env.MEDIA_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    ""
  ).trim();

  if (!value) {
    throw new TemplateMediaAssetError(
      "MEDIA_PUBLIC_BASE_URL or NEXT_PUBLIC_APP_URL is required before uploading template media.",
      500,
    );
  }

  const normalized = value.replace(/\/+$/, "");
  assertPublicMediaUrl(`${normalized}/health`);

  return normalized;
}

function sanitizeFileName(value: string) {
  const extension = path.extname(value).toLowerCase();
  const name = path
    .basename(value, extension)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${name || "template-media"}${extension}`;
}

function validateMedia({
  fileName,
  mediaType,
  mimeType,
  sizeBytes,
}: {
  fileName: string;
  mediaType: TemplateHeaderMediaType;
  mimeType: string;
  sizeBytes: number;
}) {
  const rules = MEDIA_RULES[mediaType];
  const extension = path.extname(fileName).toLowerCase();

  if (!rules.mimeTypes.includes(mimeType)) {
    throw new TemplateMediaAssetError(
      `${mediaType.toLowerCase()} header does not support ${mimeType || "this file type"}.`,
    );
  }

  if (!rules.extensions.includes(extension)) {
    throw new TemplateMediaAssetError(
      `${mediaType.toLowerCase()} header does not support ${extension || "this file extension"}.`,
    );
  }

  if (sizeBytes <= 0) {
    throw new TemplateMediaAssetError("Uploaded media file is empty.");
  }

  if (sizeBytes > rules.maxBytes) {
    throw new TemplateMediaAssetError(
      `${mediaType.toLowerCase()} header file is too large. Maximum size is ${Math.round(
        rules.maxBytes / 1024 / 1024,
      )} MB.`,
    );
  }
}

async function uploadTemplateMediaToMeta({
  accessToken,
  buffer,
  fileName,
  mimeType,
}: {
  accessToken: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  const appId = getMetaAppId();

  if (!appId) {
    return {
      handle: null,
      raw: {
        skipped: true,
        reason: "META_APP_ID is not configured",
      },
    };
  }

  const uploadUrl = new URL(`${getGraphBaseUrl()}/${appId}/uploads`);
  uploadUrl.searchParams.set("file_name", fileName);
  uploadUrl.searchParams.set("file_length", String(buffer.length));
  uploadUrl.searchParams.set("file_type", mimeType);

  const sessionResponse = await fetch(uploadUrl, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
  });
  const sessionData = (await sessionResponse.json()) as {
    id?: string;
    error?: { message?: string };
  };

  if (!sessionResponse.ok || !sessionData.id) {
    throw new TemplateMediaAssetError(
      sessionData.error?.message ?? "Unable to create Meta media upload session.",
      502,
    );
  }

  const uploadBody = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;

  const uploadResponse = await fetch(`${getGraphBaseUrl()}/${sessionData.id}`, {
    body: uploadBody,
    cache: "no-store",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      "Content-Type": "application/octet-stream",
      file_offset: "0",
    },
    method: "POST",
  });
  const uploadData = (await uploadResponse.json()) as {
    h?: string;
    error?: { message?: string };
  };

  if (!uploadResponse.ok || !uploadData.h) {
    throw new TemplateMediaAssetError(
      uploadData.error?.message ?? "Unable to upload template media to Meta.",
      502,
    );
  }

  return {
    handle: uploadData.h,
    raw: {
      session: sessionData,
      upload: uploadData,
    },
  };
}

export async function uploadTemplateMediaAsset({
  actorUserId,
  buffer,
  companyId,
  fileName,
  mediaType,
  mimeType,
}: {
  actorUserId: string;
  buffer: Buffer;
  companyId: string;
  fileName: string;
  mediaType: TemplateHeaderMediaType;
  mimeType: string;
}) {
  validateMedia({
    fileName,
    mediaType,
    mimeType,
    sizeBytes: buffer.length,
  });

  const sanitizedFileName = sanitizeFileName(fileName);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const assetId = crypto.randomUUID();
  const storageKey = `uploads/template-media/${companyId}/${assetId}-${sanitizedFileName}`;
  const publicUrl = `${getPublicBaseUrl()}/${storageKey}`;

  assertPublicMediaUrl(publicUrl);

  const directory = path.join(process.cwd(), "public", "uploads", "template-media", companyId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${assetId}-${sanitizedFileName}`), buffer);

  let metaUpload: Awaited<ReturnType<typeof uploadTemplateMediaToMeta>> = {
    handle: null,
    raw: {
      skipped: true,
      reason: "WhatsApp access token is not configured",
    },
  };

  try {
    const accessToken = await getWhatsAppAccessToken({ companyId });
    metaUpload = await uploadTemplateMediaToMeta({
      accessToken,
      buffer,
      fileName: sanitizedFileName,
      mimeType,
    });
  } catch (error) {
    if (error instanceof TemplateMediaAssetError) throw error;

    metaUpload = {
      handle: null,
      raw: {
        skipped: true,
        reason: error instanceof Error ? error.message : "Meta upload skipped",
      },
    };
  }

  const asset = await prisma.templateMediaAsset.create({
    data: {
      companyId,
      fileName: sanitizedFileName,
      mediaType,
      metaHandle: metaUpload.handle,
      metaRaw: JSON.parse(JSON.stringify(metaUpload.raw)) as Prisma.InputJsonValue,
      mimeType,
      publicUrl,
      sha256,
      sizeBytes: buffer.length,
      storageKey,
      uploadedByUserId: actorUserId,
    },
  });

  await createAuditLog({
    action: "template_media.uploaded",
    actorUserId,
    companyId,
    entityId: asset.id,
    entityType: "TemplateMediaAsset",
    metadata: {
      fileName: asset.fileName,
      mediaType: asset.mediaType,
      metaReady: Boolean(asset.metaHandle),
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    },
  }).catch(() => undefined);

  return asset;
}

export async function getTemplateMediaAssets(companyId: string) {
  return prisma.templateMediaAsset.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    where: {
      companyId,
      status: "ACTIVE",
    },
  });
}

export async function getTemplateMediaAssetForCompany({
  companyId,
  mediaAssetId,
}: {
  companyId: string;
  mediaAssetId: string;
}) {
  return prisma.templateMediaAsset.findFirst({
    where: {
      companyId,
      id: mediaAssetId,
      status: "ACTIVE",
    },
  });
}
