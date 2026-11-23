import { model } from '@medusajs/framework/utils'

/**
 * The invoice of one order in Fakturownia (spec 6c §5.2–§5.7). `problem_since` and
 * `next_attempt_at` belong to the step that keeps failing now – issuing, sending to KSeF or the
 * e-mail (the steps run one after another); a step that works clears both.
 */
export const Invoice = model.define('invoice', {
  id: model.id({ prefix: 'inv' }).primaryKey(),
  order_id: model.text().unique(),
  status: model
    .enum(['waiting', 'issuing', 'issued', 'review', 'failed', 'skipped'])
    .default('waiting'),
  skip_reason: model.enum(['canceled', 'unpaid']).nullable(),
  buyer_kind: model.enum(['company', 'person']).nullable(),
  fakturownia_id: model.text().nullable(),
  number: model.text().nullable(),
  /** Invoice total minus order total in grosze when they differ (status `review`). */
  difference_cents: model.number().nullable(),
  ksef: model.enum(['none', 'pending', 'sent', 'ok', 'offline', 'error']).default('none'),
  ksef_number: model.text().nullable(),
  ksef_error: model.text().nullable(),
  attempts: model.number().default(0),
  problem_since: model.dateTime().nullable(),
  next_attempt_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
  error_kind: model.enum(['transient', 'permanent']).nullable(),
  email_sent_at: model.dateTime().nullable(),
  email_attempts: model.number().default(0),
  email_error: model.text().nullable(),
  /** The problem the shop was already alerted about (`issue`, `ksef`, `total`, `email`). */
  alerted_for: model.text().nullable(),
})
