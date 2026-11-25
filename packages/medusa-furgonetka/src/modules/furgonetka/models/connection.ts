import { model } from '@medusajs/framework/utils'

/**
 * The shop's connection to its Furgonetka account (OAuth, spec 6d §5.1) – a single row. Furgonetka
 * does not say when the refresh token expires (about 3 months), so only the access token has a date.
 */
export const FurgonetkaConnection = model.define('furgonetka_connection', {
  id: model.id({ prefix: 'fgc' }).primaryKey(),
  state: model.enum(['connected', 'disconnected']).default('disconnected'),
  /** A description of the account (company or owner e-mail). */
  account: model.text().nullable(),
  access_token: model.text().nullable(),
  refresh_token: model.text().nullable(),
  access_expires_at: model.dateTime().nullable(),
  connected_at: model.dateTime().nullable(),
  /** The CSRF `state` of the OAuth round trip that is under way, valid for 10 minutes. */
  oauth_state: model.text().nullable(),
  oauth_state_expires_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
  /** The problem the shop was already alerted about. */
  alerted_for: model.text().nullable(),
})
