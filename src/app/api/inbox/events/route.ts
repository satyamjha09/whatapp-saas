import { NextResponse } from "next/server";
import { getRedisConnection } from "@/lib/redis";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getInboxRealtimeChannel } from "@/server/realtime/inbox-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const context = await getCurrentWorkspaceContext();

  if (!context?.membership) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const companyId = context.membership.companyId;
  const channel = getInboxRealtimeChannel(companyId);
  const encoder = new TextEncoder();
  const redis = getRedisConnection().duplicate();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
      };

      redis.on("message", (_channel, payload) => {
        try {
          const parsed = JSON.parse(payload) as unknown;
          send("inbox", parsed);
        } catch {
          send("inbox", { type: "UNKNOWN", createdAt: new Date().toISOString() });
        }
      });

      redis.on("error", (error) => {
        send("error", {
          message: error.message,
          createdAt: new Date().toISOString(),
        });
      });

      await redis.subscribe(channel);

      send("ready", {
        type: "CONNECTED",
        companyId,
        createdAt: new Date().toISOString(),
      });

      heartbeat = setInterval(() => {
        send("heartbeat", {
          type: "HEARTBEAT",
          createdAt: new Date().toISOString(),
        });
      }, 25_000);
    },
    async cancel() {
      if (heartbeat) clearInterval(heartbeat);
      await redis.unsubscribe(channel).catch(() => undefined);
      redis.disconnect();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
