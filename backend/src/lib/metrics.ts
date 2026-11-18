import client from 'prom-client';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'syncboard_' });

export const httpDuration = new client.Histogram({
  name: 'syncboard_http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const socketConnections = new client.Gauge({
  name: 'syncboard_socket_connections',
  help: 'Open Socket.IO connections on this instance',
  registers: [registry],
});

export const socketEvents = new client.Counter({
  name: 'syncboard_socket_events_total',
  help: 'Socket events handled, by event and outcome',
  labelNames: ['event', 'outcome'] as const,
  registers: [registry],
});

export const sceneElements = new client.Counter({
  name: 'syncboard_scene_elements_total',
  help: 'Scene elements received, by outcome',
  labelNames: ['outcome'] as const,
  registers: [registry],
});
