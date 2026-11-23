const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Retries of a failing step (spec 6c §5.6): every 15 minutes for an hour, then hourly to 24 h. */
export const RETRY_FIRST_HOUR_MS = 15 * MINUTE
export const RETRY_LATER_MS = HOUR
export const GIVE_UP_AFTER_MS = 24 * HOUR
/**
 * A slot is set from the start of the pass that failed; the job's next pass may start a little
 * earlier than that and must not leave the retry for the pass after it.
 */
export const RETRY_SLACK_MS = MINUTE
/** Transient failures alert the shop after an hour. */
export const ALERT_AFTER_MS = HOUR
/** A placed order still unpaid after a week is skipped (spec 6c §5.2). */
export const UNPAID_SKIP_AFTER_MS = 7 * 24 * HOUR
/** An `issuing` row this old was left by a crash – the next pass takes it again. */
export const STALE_ISSUING_MS = 10 * MINUTE

/** When to try a failing step again; `null` once the try would fall past 24 hours. */
export function nextAttemptAt(problemSince: Date, now: Date): Date | null {
  const elapsed = now.getTime() - problemSince.getTime()
  const next = now.getTime() + (elapsed < HOUR ? RETRY_FIRST_HOUR_MS : RETRY_LATER_MS)
  return next - problemSince.getTime() > GIVE_UP_AFTER_MS ? null : new Date(next)
}

/** The latest slot a pass started at `now` takes. */
export const dueBy = (now: Date) => new Date(now.getTime() + RETRY_SLACK_MS)

/** Whether a retry slot has come; never without a slot (retries gave up). */
export function attemptDue(nextAttempt: Date | null, now: Date): boolean {
  return nextAttempt !== null && nextAttempt.getTime() <= dueBy(now).getTime()
}

export function alertDue(problemSince: Date, now: Date): boolean {
  return now.getTime() - problemSince.getTime() >= ALERT_AFTER_MS
}
