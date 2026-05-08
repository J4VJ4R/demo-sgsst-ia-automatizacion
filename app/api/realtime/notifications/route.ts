import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth-actions";
import { subscribeNotificationsEvents } from "@/lib/realtime/notifications-bus";
import type { RealtimeNotificationEvent } from "@/lib/realtime/notifications-events";

export const runtime = "nodejs";

function writeSse(controller: ReadableStreamDefaultController, event: string, data: any) {
  controller.enqueue(`event: ${event}\n`);
  controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const stream = new ReadableStream({
    start(controller) {
      writeSse(controller, "connected", { ts: Date.now() });

      const unsubscribe = subscribeNotificationsEvents((event: RealtimeNotificationEvent) => {
        if (event.type === "notification_created") {
          if (event.payload.recipientId !== user.id) return;
        }
        writeSse(controller, event.type, event.payload);
      });

      const pingInterval = setInterval(() => {
        writeSse(controller, "ping", { ts: Date.now() });
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
        }
      });
    },
    cancel(reason) {
      void reason;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

