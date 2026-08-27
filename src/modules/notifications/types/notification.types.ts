export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationItem {
  id: string;
  notification_id: string;
  event_key: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  source_module: string;
  subject_type: string | null;
  subject_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListParams {
  page?: number;
  per_page?: number;
  unread?: boolean;
  severity?: NotificationSeverity;
}
