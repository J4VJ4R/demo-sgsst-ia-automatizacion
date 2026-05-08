"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function RealTimeListener() {
  const router = useRouter();

  useEffect(() => {
    // Check if EventSource is supported
    if (typeof EventSource === "undefined") {
      console.warn("EventSource is not supported in this browser.");
      return;
    }

    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout;
    let isMounted = true; // Track if the effect is still active

    const connect = async () => {
        // If unmounted before we even start, stop
        if (!isMounted) return;

        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }

        // Diagnostic check: Verify if we can access the endpoint
      const controller = new AbortController();
      let shouldConnect = true;

      try {
        const res = await fetch("/api/stream", {
          method: "HEAD",
          signal: controller.signal
        });
        
        if (!res.ok) {
           if (res.status === 401) {
             shouldConnect = false;
           } else {
             console.error(`RealTimeListener diagnostic failed: ${res.status}`);
             shouldConnect = false;
           }
        } 
        
        // Always abort the diagnostic fetch to close the connection
        controller.abort();
        
      } catch (e: any) {
        if (e.name !== 'AbortError') {
           console.error("RealTimeListener diagnostic error:", e);
           shouldConnect = false;
           if (isMounted) {
             retryTimeout = setTimeout(connect, 10000);
           }
        }
      }

      // If unmounted during the async fetch, stop here
      if (!isMounted) return;
      
      if (shouldConnect) {
        // Double check to ensure we don't have an existing connection
        if (eventSource) {
             // @ts-ignore
             eventSource.close();
        }

        eventSource = new EventSource("/api/stream");
        
        eventSource.onopen = () => {
          console.log("Real-time connection opened.");
        };

        eventSource.addEventListener("notification", (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (Array.isArray(data) && data.length > 0) {
              // Trigger refresh for Server Components
              router.refresh();
              
              // Dispatch event for Client Components (like NotificationBell)
              window.dispatchEvent(new CustomEvent("notification-update"));

              // Show toast for the latest one
              // Add a small delay or check to avoid duplicates if possible, 
              // but mostly the double-connection fix should solve it.
              const latest = data[0];
              if (latest && latest.id) {
                toast.dismiss(latest.id); // Dismiss previous toast with same ID if exists (optional)
                toast.info(latest.title, {
                  id: latest.id, // Use ID to prevent duplicates
                  description: latest.message,
                });
              }
            }
          } catch (error) {
            console.error("Error parsing notification event:", error);
          }
        });

        eventSource.onerror = (err) => {
          if (!isMounted) return;
          // EventSource error is generic. 
          // ReadyState 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
          
          // Only log if it's not a simple reconnection attempt (0)
          if (eventSource?.readyState !== 0) {
             console.error(`EventSource error. ReadyState: ${eventSource?.readyState}`);
          }
          
          if (eventSource) {
             eventSource.close();
          }
          eventSource = null;
          retryTimeout = setTimeout(connect, 5000);
        };
      }
      };

    connect();

    return () => {
      isMounted = false; // Mark as unmounted
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearTimeout(retryTimeout);
    };
  }, [router]);

  return null; // This component renders nothing
}
