import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest, ReadNight } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (
    typeof event.at !== 'string' ||
    !Number.isFinite(Date.parse(event.at)) ||
    typeof event.job !== 'string' ||
    event.job.length === 0 ||
    (event.status !== 'ok' && event.status !== 'retry' && event.status !== 'fail') ||
    (typeof event.owner !== 'string' && event.owner !== null) ||
    (event.error !== undefined && typeof event.error !== 'string')
  ) return null;

  return event as RunEvent;
}

// Keep source timestamps unchanged for display, including their offsets.
export const readNight: ReadNight = (runsDir, night): NightDigest | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let source: string;
  try {
    source = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  const lines = source.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  for (const line of lines) {
    const event = parseEvent(line);
    if (!event) {
      badLines++;
      continue;
    }

    const current = rows.get(event.job);
    if (!current) {
      rows.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
      });
      continue;
    }

    current.runs++;
    if (event.status === 'retry') current.retries++;
    if (event.error !== undefined) current.lastError = event.error;
    if (Date.parse(event.at) < Date.parse(current.firstAt)) current.firstAt = event.at;
    if (Date.parse(event.at) >= Date.parse(current.lastAt)) {
      current.lastAt = event.at;
      current.lastStatus = event.status;
      current.owner = event.owner;
    }
  }

  return { night, rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)), badLines };
};
