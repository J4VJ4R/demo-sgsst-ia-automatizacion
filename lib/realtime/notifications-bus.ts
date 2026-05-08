import { EventEmitter } from "node:events";
import type { RealtimeNotificationEvent } from "@/lib/realtime/notifications-events";

type Bus = {
  emitter: EventEmitter;
};

function getGlobalBus(): Bus {
  const g = globalThis as unknown as { __pmdNotificationsBus?: Bus };
  if (!g.__pmdNotificationsBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    g.__pmdNotificationsBus = { emitter };
  }
  return g.__pmdNotificationsBus;
}

export function publishNotificationsEvent(event: RealtimeNotificationEvent) {
  const bus = getGlobalBus();
  bus.emitter.emit("event", event);
}

export function subscribeNotificationsEvents(listener: (event: RealtimeNotificationEvent) => void) {
  const bus = getGlobalBus();
  bus.emitter.on("event", listener);
  return () => {
    bus.emitter.off("event", listener);
  };
}
