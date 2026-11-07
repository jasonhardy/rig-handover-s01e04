import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('digest routes', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  function app() {
    return createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    });
  }

  const night = '2026-10-28';

  it('returns the same sorted jobs in the page and JSON', async () => {
    writeFileSync(join(runsDir, `${night}.jsonl`), [
      JSON.stringify({ at: '2026-10-29T02:00:00+01:00', job: 'z/last', status: 'ok', owner: 'rook' }),
      JSON.stringify({ at: '2026-10-29T01:00:00+01:00', job: 'a/first', status: 'retry', owner: null, error: 'busy' }),
      '',
    ].join('\n'));

    const page = await app().request(`/digest/${night}`);
    const json = await app().request(`/api/digest/${night}`);
    const html = await page.text();
    const rows = await json.json() as Array<{ job: string }>;

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(['a/first', 'z/last']);
    expect(html.indexOf('a/first')).toBeLessThan(html.indexOf('z/last'));
    expect(html).toContain('—');
  });

  it('returns 404 for a night with no file', async () => {
    expect((await app().request(`/digest/${night}`)).status).toBe(404);
    expect((await app().request(`/api/digest/${night}`)).status).toBe(404);
  });

  it('renders an empty night and returns an empty JSON array', async () => {
    writeFileSync(join(runsDir, `${night}.jsonl`), '');

    const page = await app().request(`/digest/${night}`);
    const json = await app().request(`/api/digest/${night}`);

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual([]);
  });

  it('skips a bad line while both routes keep the valid job', async () => {
    writeFileSync(join(runsDir, `${night}.jsonl`), [
      JSON.stringify({ at: '2026-10-29T03:00:00+01:00', job: 'kept', status: 'fail', owner: 'rook', error: 'down' }),
      '{bad JSON',
      '',
    ].join('\n'));

    const page = await app().request(`/digest/${night}`);
    const json = await app().request(`/api/digest/${night}`);
    const html = await page.text();
    const rows = await json.json() as Array<{ job: string }>;

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(html).toContain('1 bad line skipped');
    expect(html).toContain('kept');
    expect(rows.map((row) => row.job)).toEqual(['kept']);
  });
});
