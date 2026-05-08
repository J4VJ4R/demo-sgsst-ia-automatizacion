import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth-actions";
import { subscribeActivitiesEvents } from "@/lib/realtime/activities-bus";
import type { RealtimeActivityEvent } from "@/lib/realtime/activities-events";

export const runtime = "nodejs";

function writeSse(controller: ReadableStreamDefaultController, event: string, data: any) {
  controller.enqueue(`event: ${event}\n`);
  controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN_PMD" || user?.role === "GESTOR";
  const isConsultant = user?.role === "CONSULTANT";
  if (!user || (!isAdmin && !isConsultant)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const stream = new ReadableStream({
    start(controller) {
      writeSse(controller, "connected", { ts: Date.now() });

      const unsubscribe = subscribeActivitiesEvents((event: RealtimeActivityEvent) => {
        if (isConsultant) {
          if (event.type === "activity_created" || event.type === "activity_updated") {
            const consultantId = event.payload.project.consultantId || null;
            if (!consultantId || consultantId !== user.id) return;
          }
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
