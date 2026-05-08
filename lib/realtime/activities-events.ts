export type RealtimeActivityKind = "ACTIVITY" | "ACCIDENTALIDAD";

export type RealtimeActivityEvent =
  | {
      type: "activity_created";
      payload: RealtimeActivityPayload;
    }
  | {
      type: "activity_updated";
      payload: RealtimeActivityPayload;
    }
  | {
      type: "ping";
      payload: { ts: number };
    };

export type RealtimeActivityPayload = {
  kind: RealtimeActivityKind;
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  priority: string;
  dueDate?: string | null;
  returnedNote?: string | null;
  returnedAt?: string | null;
  project: {
    id: string;
    name: string;
    nit?: string | null;
    consultantId?: string | null;
  };
  assignedTo?: {
    name: string | null;
  } | null;
  documents?: {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
  }[];
};
