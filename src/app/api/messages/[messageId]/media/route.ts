import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";

type MediaMetadata = {
  messageType: "MEDIA";
  mediaType: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO" | "STICKER";
  mediaUrl?: string | null;
  mediaId?: string | null;
  mediaName?: string | null;
};

function getMediaMetadata(metadata: unknown): MediaMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const mediaType = String(record.mediaType);

  if (
    record.messageType !== "MEDIA" ||
    !["IMAGE", "DOCUMENT", "VIDEO", "AUDIO", "STICKER"].includes(mediaType)
  ) {
    return null;
  }

  return {
    messageType: "MEDIA",
    mediaType: mediaType as MediaMetadata["mediaType"],
    mediaUrl: typeof record.mediaUrl === "string" ? record.mediaUrl : null,
    mediaId: typeof record.mediaId === "string" ? record.mediaId : null,
    mediaName: typeof record.mediaName === "string" ? record.mediaName : null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const context = await getCurrentWorkspaceContext();

  if (!context?.membership) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { messageId } = await params;
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      companyId: context.membership.companyId,
    },
    select: {
      metadata: true,
    },
  });

  const media = getMediaMetadata(message?.metadata);

  if (!media) {
    return NextResponse.json({ message: "Media not found" }, { status: 404 });
  }

  let mediaUrl = media.mediaUrl ?? null;
  let contentType = "application/octet-stream";

  if (media.mediaId) {
    const accessToken = await getWhatsAppAccessToken({
      companyId: context.membership.companyId,
    });
    const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${media.mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const mediaInfo = await mediaInfoResponse.json();

    if (!mediaInfoResponse.ok || typeof mediaInfo?.url !== "string") {
      return NextResponse.json(
        { message: mediaInfo?.error?.message ?? "Unable to fetch media" },
        { status: 502 },
      );
    }

    const resolvedMediaUrl = mediaInfo.url as string;
    mediaUrl = resolvedMediaUrl;
    if (typeof mediaInfo.mime_type === "string") {
      contentType = mediaInfo.mime_type;
    }

    const mediaResponse = await fetch(resolvedMediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mediaResponse.ok) {
      return NextResponse.json(
        { message: "Unable to download media" },
        { status: 502 },
      );
    }

    return new Response(await mediaResponse.arrayBuffer(), {
      headers: {
        "Content-Type":
          mediaResponse.headers.get("content-type") ?? contentType,
        "Content-Disposition": `inline; filename="${media.mediaName ?? "media"}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  if (!mediaUrl) {
    return NextResponse.json({ message: "Media URL not found" }, { status: 404 });
  }

  return NextResponse.redirect(mediaUrl);
}
