import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

const populatedNight = [
  '{"at":"2026-10-28T07:00:00+01:00","job":"fixtures/refresh","status":"retry","owner":"fixture-owner","error":"temporary failure"}',
  '{"at":"2026-10-28T07:01:00+01:00","job":"digest/render","status":"ok","owner":"digest-owner"}',
  '{"at":"2026-10-28T07:02:00+01:00","job":"fixtures/refresh","status":"retry","owner":"fixture-owner","error":"temporary failure"}',
  '{"at":"2026-10-28T07:03:00+01:00","job":"notes/backup","status":"fail","owner":null,"error":"disk full"}',
  '{"at":"2026-10-28T07:04:00+01:00","job":"fixtures/refresh","status":"retry","owner":"fixture-owner","error":"temporary failure"}',
  '{"at":"2026-10-28T07:05:00+01:00","job":"fixtures/refresh","status":"ok","owner":"fixture-owner"}',
  '{"at":"2026-10-28T07:06:00+01:00","job":"lane/sync","status":"ok","owner":"lane-owner"}',
].join('\n');

describe('digest routes', () => {
  let runsDir = '';

  beforeEach(() => {
    runsDir = mkdtempSync(join(process.cwd(), 'test', '.digest-runs-'));
  });

  afterEach(() => {
    if (runsDir) rmSync(runsDir, { recursive: true, force: true });
    runsDir = '';
  });

  function createTestApp() {
    return createApp({ ...config, runsDir });
  }

  function writeNight(night: string, contents: string) {
    writeFileSync(join(runsDir, `${night}.jsonl`), contents);
  }

  it('renders populated rows sorted by job and marks failed or frequently retried jobs', async () => {
    writeNight('2026-10-28', populatedNight);

    const response = await createTestApp().request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>rig · digest · 2026-10-28</title>');
    expect(html.indexOf('digest/render')).toBeLessThan(html.indexOf('fixtures/refresh'));
    expect(html.indexOf('fixtures/refresh')).toBeLessThan(html.indexOf('lane/sync'));
    expect(html).toMatch(/<tr class="warn">[\s\S]*?fixtures\/refresh[\s\S]*?<\/tr>/);
    expect(html).toMatch(/<tr class="warn">[\s\S]*?notes\/backup[\s\S]*?<\/tr>/);
  });

  it('returns populated JSON rows in the same job order as the page', async () => {
    writeNight('2026-10-28', populatedNight);

    const app = createTestApp();
    const [jsonResponse, pageResponse] = await Promise.all([
      app.request('/api/digest/2026-10-28'),
      app.request('/digest/2026-10-28'),
    ]);
    const rows = (await jsonResponse.json()) as Array<{ job: string }>;
    const html = await pageResponse.text();
    const pageJobs = [...html.matchAll(/<tr(?: class="[^"]*")?><td>([^<]*)<\/td>/g)].map(
      (match) => match[1] ?? '',
    );
    const jsonJobs = rows.map((row) => row.job);

    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.headers.get('content-type')).toContain('application/json');
    expect(pageResponse.status).toBe(200);
    expect(jsonJobs).toEqual(pageJobs);
    expect(jsonJobs).toEqual([...jsonJobs].sort((a, b) => a.localeCompare(b)));
    expect(rows).toEqual([
      {
        job: 'digest/render',
        owner: 'digest-owner',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T07:01:00+01:00',
        lastAt: '2026-10-28T07:01:00+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'fixture-owner',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: 'temporary failure',
        firstAt: '2026-10-28T07:00:00+01:00',
        lastAt: '2026-10-28T07:05:00+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'lane-owner',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T07:06:00+01:00',
        lastAt: '2026-10-28T07:06:00+01:00',
      },
      {
        job: 'notes/backup',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'disk full',
        firstAt: '2026-10-28T07:03:00+01:00',
        lastAt: '2026-10-28T07:03:00+01:00',
      },
    ]);
  });

  it('returns 404 for a night with no file on both routes', async () => {
    const app = createTestApp();
    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2030-01-01'),
      app.request('/api/digest/2030-01-01'),
    ]);

    expect(pageResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('renders the empty state and returns no JSON rows for an empty file', async () => {
    writeNight('2030-01-02', '');

    const app = createTestApp();
    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2030-01-02'),
      app.request('/api/digest/2030-01-02'),
    ]);
    const html = await pageResponse.text();

    expect(pageResponse.status).toBe(200);
    expect(html).toContain('<p class="mute">nothing ran</p>');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toEqual([]);
  });

  it('ignores malformed JSONL lines while serving valid rows on both routes', async () => {
    writeNight(
      '2030-01-03',
      [
        '{"at":"2030-01-03T08:00:00+01:00","job":"valid/job","status":"ok","owner":null}',
        '{"at":"2030-01-03T08:01:00+01:00","job":',
      ].join('\n'),
    );

    const app = createTestApp();
    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2030-01-03'),
      app.request('/api/digest/2030-01-03'),
    ]);
    const html = await pageResponse.text();

    expect(pageResponse.status).toBe(200);
    expect(html).toContain('valid/job');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toEqual([
      {
        job: 'valid/job',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2030-01-03T08:00:00+01:00',
        lastAt: '2030-01-03T08:00:00+01:00',
      },
    ]);
  });
});
