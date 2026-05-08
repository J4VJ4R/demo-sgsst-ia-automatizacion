import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function HEAD() {
  try {
    const user = await getCurrentUser();
    return new NextResponse(null, { status: user ? 200 : 401 });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      console.log("Stream connection rejected: Unauthorized (No user found)");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Abort signal to stop the stream if client disconnects
    const signal = req.signal;

    console.log(`Stream connected for user: ${user.email} (${user.role})`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let lastCheck = new Date();

        // Send initial connection message
        controller.enqueue(encoder.encode("event: connected\ndata: connected\n\n"));

        // Keep the connection open for a specific duration (e.g., 50s for Vercel)
        // or until client disconnects.
        // We will loop.
        const maxDuration = 50 * 1000; 
        const startTime = Date.now();

        try {
          while (true) {
            if (signal.aborted) {
              console.log("Client disconnected (signal aborted)");
              try { controller.close(); } catch {}
              break;
            }

            if (Date.now() - startTime > maxDuration) {
              try { controller.close(); } catch {}
              break;
            }

            // Check for new notifications for this user
            // We look for notifications created AFTER lastCheck
            const notifications = await prisma.notification.findMany({
              where: {
                recipientId: user.id,
                createdAt: {
                  gt: lastCheck,
                },
              },
              select: {
                id: true,
                type: true,
                title: true,
                message: true,
              },
            });

            if (notifications.length > 0) {
              lastCheck = new Date(); // Update check time
              
              // Send event
              const data = JSON.stringify(notifications);
              controller.enqueue(encoder.encode(`event: notification\ndata: ${data}\n\n`));
            }

            // Sleep for 3 seconds
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (error) {
          console.error("Stream error inside loop:", error);
          // If controller is already closed, this might throw, so ignore
          try { controller.close(); } catch (e) {}
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Encoding": "none", // Prevent buffering
      },
    });
  } catch (error) {
    console.error("Stream GET handler error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
