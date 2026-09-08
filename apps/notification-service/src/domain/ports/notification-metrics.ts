export type NotificationKind = 'success' | 'failure';

/** Counts e-mails that actually left, not events that arrived. */
export interface NotificationMetrics {
  sent(kind: NotificationKind): void;
}
