import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { subscribeDriversEvents } from "@/lib/realtime/drivers-bus";
import type { RealtimeDriversEvent } from "@/lib/realtime/drivers-events";

export const runtime = "nodejs";

function writeSse(controller: ReadableStreamDefaultController, event: string, data: any) {
  controller.enqueue(`event: ${event}\n`);
  controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || "";
  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId requerido" }), { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { consultantId: true, clientUserId: true },
  });
  if (!project) {
    return new Response(JSON.stringify({ error: "Empresa no encontrada" }), { status: 404 });
  }

  const isAdmin = user.role === "ADMIN_PMD" || user.role === "GESTOR";
  const isConsultant = user.role === "CONSULTANT" && project.consultantId === user.id;
  const isClient = (user.role === "CLIENT" || user.role === "CLIENT_VIEWER") && project.clientUserId === user.id;
  if (!isAdmin && !isConsultant && !isClient) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  const stream = new ReadableStream({
    start(controller) {
      writeSse(controller, "connected", { ts: Date.now() });

      const unsubscribe = subscribeDriversEvents((event: RealtimeDriversEvent) => {
        if (event.type === "drivers_inspection_changed") {
          if (event.payload.projectId !== projectId) return;
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

