import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import { sortDigestRows } from './digest/sort.js';
import type { DigestRow } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function isNightSegment(night: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(night);
}

function readDigestRows(runsDir: string, night: string): DigestRow[] | undefined {
  try {
    return readNight(runsDir, night).rows;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!isNightSegment(night)) return c.notFound();

    const rows = readDigestRows(config.runsDir, night);
    if (!rows) return c.notFound();

    return c.json(sortDigestRows(rows));
  });

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!isNightSegment(night)) return c.notFound();

    const rows = readDigestRows(config.runsDir, night);
    if (!rows) return c.notFound();

    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage night={night} rows={rows} />
      </Layout>,
    );
  });

  return app;
}
