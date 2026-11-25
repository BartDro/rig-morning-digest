import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

type RunEntry = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntry(line: string): RunEntry | null {
  try {
    const value: unknown = JSON.parse(line);
    if (!isRecord(value)) return null;

    const { at, job, status, owner, error } = value;
    if (
      typeof at !== 'string' ||
      at.length === 0 ||
      typeof job !== 'string' ||
      job.length === 0 ||
      (status !== 'ok' && status !== 'retry' && status !== 'fail') ||
      (owner !== null && typeof owner !== 'string') ||
      (error !== undefined && typeof error !== 'string')
    ) {
      return null;
    }

    return {
      at,
      job,
      status,
      owner,
      ...(typeof error === 'string' ? { error } : {}),
    };
  } catch {
    return null;
  }
}

export function readNight(runsDir: string, night: string): NightDigest {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = contents === '' ? [] : contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  const jobs = new Map<string, DigestRow>();
  let malformedLines = 0;

  for (const line of lines) {
    const entry = parseEntry(line);
    if (!entry) {
      malformedLines += 1;
      continue;
    }

    const row = jobs.get(entry.job);
    if (!row) {
      jobs.set(entry.job, {
        job: entry.job,
        owner: entry.owner,
        runs: 1,
        retries: entry.status === 'retry' ? 1 : 0,
        lastStatus: entry.status,
        lastError: entry.error ?? null,
        firstAt: entry.at,
        lastAt: entry.at,
      });
      continue;
    }

    row.owner = entry.owner;
    row.runs += 1;
    if (entry.status === 'retry') row.retries += 1;
    row.lastStatus = entry.status;
    if (entry.error !== undefined) row.lastError = entry.error;
    row.lastAt = entry.at;
  }

  return { rows: [...jobs.values()], malformedLines };
}
