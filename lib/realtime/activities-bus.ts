import { EventEmitter } from "node:events";
import type { RealtimeActivityEvent } from "@/lib/realtime/activities-events";

type Bus = {
  emitter: EventEmitter;
};

function getGlobalBus(): Bus {
  const g = globalThis as any;
  if (!g.__pmdActivitiesBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    g.__pmdActivitiesBus = { emitter };
  }
  return g.__pmdActivitiesBus as Bus;
}

export function publishActivitiesEvent(event: RealtimeActivityEvent) {
  const bus = getGlobalBus();
  bus.emitter.emit("event", event);
}

export function subscribeActivitiesEvents(listener: (event: RealtimeActivityEvent) => void) {
  const bus = getGlobalBus();
  bus.emitter.on("event", listener);
  return () => {
    bus.emitter.off("event", listener);
  };
}

