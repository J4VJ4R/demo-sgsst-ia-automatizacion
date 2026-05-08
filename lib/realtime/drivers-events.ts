export type RealtimeDriversEvent =
  | {
      type: "drivers_inspection_changed";
      payload: { projectId: string; ts: number };
    }
  | {
      type: "ping";
      payload: { ts: number };
    };

