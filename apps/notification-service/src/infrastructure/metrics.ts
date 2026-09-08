import { collectDefaultMetrics, Counter, Registry } from 'prom-client';
import type { MetricsExporter } from '../domain/ports/metrics-exporter';
import type { NotificationMetrics } from '../domain/ports/notification-metrics';

export const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: 'fiapx_notification_' });

const notificationsSentTotal = new Counter({
  name: 'notifications_sent_total',
  help: 'E-mails enviados',
  labelNames: ['kind'] as const,
  registers: [registry],
});

export const notificationMetrics: NotificationMetrics = {
  sent: (kind) => notificationsSentTotal.inc({ kind }),
};

export const metricsExporter: MetricsExporter = {
  contentType: registry.contentType,
  render: () => registry.metrics(),
};
