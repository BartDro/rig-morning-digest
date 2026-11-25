import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: join(process.cwd(), 'runs'),
};

describe('digest page', () => {
  it('renders rows sorted by job and marks failed or frequently retried jobs', async () => {
    const response = await createApp(config).request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>rig · digest · 2026-10-28</title>');
    expect(html.indexOf('digest/render')).toBeLessThan(html.indexOf('fixtures/refresh'));
    expect(html.indexOf('fixtures/refresh')).toBeLessThan(html.indexOf('lane/sync'));
    expect(html).toMatch(/<tr class="warn">[\s\S]*?fixtures\/refresh[\s\S]*?<\/tr>/);
    expect(html).toMatch(/<tr class="warn">[\s\S]*?notes\/backup[\s\S]*?<\/tr>/);
  });
});
