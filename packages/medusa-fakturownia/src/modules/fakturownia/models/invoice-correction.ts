import { model } from '@medusajs/framework/utils'

/**
 * The credit note of one received return in Fakturownia (spec 6e-b, D3–D5). One row per return
 * (unique `return_id`) keeps a repeated event, the job and a retry from making a second note.
 * `items` and `includes_shipping` describe the note as sent – set when an attempt goes out and kept
 * for its retries, final once the row is `issued`. `problem_since`/`next_attempt_at` belong to a
 * failing attempt, as on the invoice row.
 */
export const InvoiceCorrection = model.define('invoice_correction', {
  id: model.id({ prefix: 'invcor' }).primaryKey(),
  return_id: model.text().unique(),
  order_id: model.text().index(),
  status: model.enum(['waiting', 'issuing', 'issued', 'attention', 'failed']).default('waiting'),
  /** Why the note waits for a person or for the invoice (status `attention`). */
  attention_reason: model.enum(['no_invoice', 'invoice_not_ready', 'partial_receipt']).nullable(),
  /** `[{ item_id, quantity }]` – the returned pieces the note covers. */
  items: model.json().nullable(),
  includes_shipping: model.boolean().default(false),
  fakturownia_id: model.text().nullable(),
  number: model.text().nullable(),
  /** Gross total of the note in grosze – negative. */
  total_cents: model.number().nullable(),
  attempts: model.number().default(0),
  problem_since: model.dateTime().nullable(),
  next_attempt_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
  error_kind: model.enum(['transient', 'permanent']).nullable(),
  /** The problem the shop was already alerted about (`correction:issue`, `correction:<reason>`). */
  alerted_for: model.text().nullable(),
})
