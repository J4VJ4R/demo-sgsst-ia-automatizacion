export type RealtimeNotificationEvent =
  | {
      type: "notification_created";
      payload: RealtimeNotificationPayload;
    }
  | {
      type: "ping";
      payload: { ts: number };
    };

export type RealtimeNotificationPayload = {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  category: string | null;
  functionalArea: string | null;
  createdAt: string;
  activityId: string | null;
};

