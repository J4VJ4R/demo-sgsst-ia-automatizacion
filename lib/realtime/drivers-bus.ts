import { EventEmitter } from "node:events";
import type { RealtimeDriversEvent } from "@/lib/realtime/drivers-events";

type Bus = {
  emitter: EventEmitter;
};

declare global {
  var __pmdDriversBus: Bus | undefined;
}

function getGlobalBus(): Bus {
  if (!globalThis.__pmdDriversBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalThis.__pmdDriversBus = { emitter };
  }
  return globalThis.__pmdDriversBus;
}

export function publishDriversEvent(event: RealtimeDriversEvent) {
  const bus = getGlobalBus();
  bus.emitter.emit("event", event);
}

export function subscribeDriversEvents(listener: (event: RealtimeDriversEvent) => void) {
  const bus = getGlobalBus();
  bus.emitter.on("event", listener);
  return () => {
    bus.emitter.off("event", listener);
  };
}
