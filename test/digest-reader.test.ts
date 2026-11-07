import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('run log reader', () => {
  it('aggregates the fixture and counts its bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest?.rows.find((row) => row.job === 'digest/render')?.owner).toBeNull();
    expect(digest?.rows.find((row) => row.job === 'fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest?.rows.find((row) => row.job === 'notes/backup')?.lastStatus).toBe('fail');
  });

  it('distinguishes missing, empty and malformed nights', () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-reader-'));
    try {
      expect(readNight(runsDir, '2026-10-28')).toBeNull();
      writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
      expect(readNight(runsDir, '2026-10-28')).toEqual({
        night: '2026-10-28',
        rows: [],
        badLines: 0,
      });
      writeFileSync(join(runsDir, '2026-10-28.jsonl'), 'not JSON\n');
      expect(readNight(runsDir, '2026-10-28')?.badLines).toBe(1);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });
});
