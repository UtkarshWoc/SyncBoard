import { Router } from 'express';
import { env } from '../../config/env.js';
import { pingDB } from '../../config/db.js';
import { safeEqual } from '../../lib/crypto.js';
import { registry } from '../../lib/metrics.js';

export interface HealthDeps {
  /** Returns null when Redis isn't configured. */
  redisReady?: () => Promise<boolean | null>;
}

export function healthRouter(deps: HealthDeps = {}) {
  const router = Router();

  /** Liveness: the process is up. */
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
  });

  /** Readiness: dependencies are reachable. Load balancers should route on this. */
  router.get('/health/ready', async (_req, res) => {
    const [db, redis] = await Promise.all([pingDB(), deps.redisReady?.() ?? Promise.resolve(null)]);
    const ready = db && redis !== false;
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'unavailable',
      checks: { mongo: db ? 'up' : 'down', redis: redis === null ? 'not-configured' : redis ? 'up' : 'down' },
    });
  });

  return router;
}

/** Prometheus scrape endpoint. Requires METRICS_TOKEN; open only outside production. */
export function metricsRouter() {
  const router = Router();
  router.get('/metrics', async (req, res) => {
    if (env.METRICS_TOKEN) {
      const header = req.get('authorization') ?? '';
      if (!safeEqual(header, `Bearer ${env.METRICS_TOKEN}`)) {
        res.status(401).end();
        return;
      }
    } else if (env.isProd) {
      res.status(404).end();
      return;
    }
    res.set('Content-Type', registry.contentType).send(await registry.metrics());
  });
  return router;
}
