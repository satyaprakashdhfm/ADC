import fs from 'node:fs';
import path from 'node:path';
import { LOG_DIR } from '../utils/logger.js';

/*
 * Keeping the API log directory from filling the disk.
 *
 * utils/logger.ts appends one JSON line per outbound call to logs/<service>-<YYYY-MM-DD>.log, and
 * nothing has ever removed one. On Railway that directory is a mounted VOLUME, so it survives every
 * deploy and only ever grows. When a volume fills, writes fail — and the way this would surface is
 * the worst kind: not an alert, but appendFileSync throwing ENOSPC inside logApiCall, on the code
 * path that records what we sent to Razorpay and Delhivery. The integrations keep working and the
 * evidence of what they did quietly stops being written, which is exactly when you need it.
 *
 * TWO LIMITS, because either one alone has a hole:
 *
 *   Age  — a quiet month with size to spare would otherwise keep logs for ever.
 *   Size — a busy week can blow the budget well inside the retention window, and an age-only
 *          rule would happily watch the disk fill.
 *
 * Deleting is by whole file, oldest first. Files are already per-service per-day, so a day is the
 * natural unit — truncating or rewriting a file mid-way would mean racing the appends that
 * logApiCall is making into it.
 *
 * This trims history. It is not a substitute for Railway's own log viewer, which captures the
 * console summaries and is where you look for "what happened just now"; these files are the
 * full request/response bodies, for "what exactly did we send them last Tuesday".
 */

/** How long a day's log is worth keeping. Two weeks covers a dispute that surfaces a week late. */
const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS || 14);

/**
 * Total budget for the directory. Deliberately well under the volume so the sweep has room to act
 * before the disk itself is the thing enforcing the limit — at which point writes are already
 * failing and there is nothing graceful left to do.
 */
const MAX_BYTES = Number(process.env.LOG_MAX_BYTES || 512 * 1024 * 1024);

/** Once a day is often enough for a rule measured in days, and cheap enough not to think about. */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface LogFile { name: string; full: string; mtimeMs: number; size: number }

function listLogs(): LogFile[] {
  let names: string[];
  try {
    names = fs.readdirSync(LOG_DIR);
  } catch {
    return [];   // no directory yet — nothing has been logged
  }
  const files: LogFile[] = [];
  for (const name of names) {
    if (!name.endsWith('.log')) continue;
    const full = path.join(LOG_DIR, name);
    try {
      const st = fs.statSync(full);
      if (st.isFile()) files.push({ name, full, mtimeMs: st.mtimeMs, size: st.size });
    } catch {
      // Vanished between readdir and stat — a concurrent sweep, or the file being rotated. Skip it.
    }
  }
  return files;
}

function remove(file: LogFile, reason: string): boolean {
  try {
    fs.unlinkSync(file.full);
    console.log(`[LOGS] removed ${file.name} (${(file.size / 1048576).toFixed(1)} MB, ${reason})`);
    return true;
  } catch (e) {
    console.warn(`[LOGS] could not remove ${file.name}: ${(e as Error)?.message ?? e}`);
    return false;
  }
}

/**
 * One pass: drop anything past its age, then keep dropping the oldest until the directory is under
 * budget. Returns what it did, so a caller (or a test) can assert on it rather than read the log.
 *
 * Never throws. A retention sweep that can take the process down is a worse problem than the disk
 * usage it exists to prevent.
 */
export function sweepLogs(now = Date.now()): { removed: number; freedBytes: number; remainingBytes: number } {
  let removed = 0;
  let freed = 0;

  const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let files = listLogs();

  for (const f of files) {
    if (f.mtimeMs < cutoff && remove(f, `older than ${RETENTION_DAYS} days`)) {
      removed++; freed += f.size;
    }
  }

  // Re-list rather than filtering in memory: the age pass just changed what is on disk, and the
  // size decision has to be made against what is actually there.
  files = listLogs().sort((a, b) => a.mtimeMs - b.mtimeMs);   // oldest first
  let total = files.reduce((sum, f) => sum + f.size, 0);

  for (const f of files) {
    if (total <= MAX_BYTES) break;
    /* Never delete the file currently being appended to. Under the size rule the newest file can
       be reached — a single day that alone exceeds the budget — and removing it would delete the
       calls being written right now, while logApiCall holds no handle it could notice with. */
    if (f === files[files.length - 1]) break;
    if (remove(f, `over the ${(MAX_BYTES / 1048576).toFixed(0)} MB budget`)) {
      removed++; freed += f.size; total -= f.size;
    }
  }

  return { removed, freedBytes: freed, remainingBytes: total };
}

/**
 * Sweep on boot, then daily.
 *
 * On boot because a deploy is the one moment we know the process is healthy and nobody is mid-order,
 * and because a volume that filled while we were not running should be cleared before we start
 * writing to it again.
 *
 * unref() so an idle timer never holds the process open — the same reason the status poller does it.
 */
export function startLogRetention(): void {
  const run = () => {
    try {
      const { removed, remainingBytes } = sweepLogs();
      console.log(`[LOGS] retention: ${RETENTION_DAYS}d / ${(MAX_BYTES / 1048576).toFixed(0)} MB budget`
        + ` | removed ${removed} file(s) | ${(remainingBytes / 1048576).toFixed(1)} MB on disk`);
    } catch (e) {
      console.error(`[LOGS] retention sweep failed: ${(e as Error)?.message ?? e}`);
    }
  };
  run();
  setInterval(run, SWEEP_INTERVAL_MS).unref();
}
