"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeActivityPayload } from "@/lib/realtime/activities-events";

export type RealtimeConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export function useActivitiesRealtime(args: {
  enabled: boolean;
  onActivityCreated: (payload: RealtimeActivityPayload) => void;
  onActivityUpdated?: (payload: RealtimeActivityPayload) => void;
}) {
  const { enabled, onActivityCreated, onActivityUpdated } = args;
  const [state, setState] = useState<RealtimeConnectionState>(enabled ? "connecting" : "disconnected");
  const retryRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState("disconnected");
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    const connect = () => {
      setState(retryRef.current > 0 ? "reconnecting" : "connecting");
      esRef.current?.close();
      const es = new EventSource("/api/realtime/activities");
      esRef.current = es;

      const handleOpen = () => {
        retryRef.current = 0;
        setState("connected");
      };

      const scheduleReconnect = () => {
        if (reconnectTimerRef.current) return;
        const retry = Math.min(retryRef.current, 6);
        const delay = 500 * Math.pow(2, retry);
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          retryRef.current += 1;
          connect();
        }, delay);
      };

      es.addEventListener("open", handleOpen as any);
      es.addEventListener("connected", handleOpen as any);
      es.addEventListener("activity_created", (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data) as RealtimeActivityPayload;
          onActivityCreated(payload);
        } catch {
        }
      });
      es.addEventListener("activity_updated", (evt: MessageEvent) => {
        if (!onActivityUpdated) return;
        try {
          const payload = JSON.parse(evt.data) as RealtimeActivityPayload;
          onActivityUpdated(payload);
        } catch {
        }
      });
      es.addEventListener("error", () => {
        setState("reconnecting");
        es.close();
        scheduleReconnect();
      });
    };

    connect();
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled, onActivityCreated, onActivityUpdated]);

  return { state };
}
