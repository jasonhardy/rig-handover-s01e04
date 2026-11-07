export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  // One row per job, sorted by job for both HTML and JSON consumers.
  rows: DigestRow[];
  // Counts of valid run events, including earlier statuses for jobs that later succeeded.
  counts: Record<DigestStatus, number>;
  // Lines that could not be parsed or did not match the run-log shape.
  badLines: number;
};

// A missing night has no file; an empty night has a digest with no rows.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
