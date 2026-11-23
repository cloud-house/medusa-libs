import { resolve } from 'node:path'
import type { EmailsOptions } from './options'

/**
 * Sending options from the environment (`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`,
 * `EMAIL_PREVIEW_DIR`, `NODE_ENV`). E-mails go out through Resend only with a key and a sender;
 * otherwise the same rendering runs and the result lands in the log and in `previewDir`.
 * `previewDir` is `null` in production without `EMAIL_PREVIEW_DIR`: customer data stays off the
 * disk and the skipped e-mail fails its notification instead.
 */
export function emailEnv(
  env: Record<string, string | undefined>,
): Pick<EmailsOptions, 'apiKey' | 'from' | 'replyTo' | 'previewDir' | 'mode'> {
  const apiKey = env.RESEND_API_KEY || null
  const from = env.EMAIL_FROM || null
  return {
    apiKey,
    from,
    replyTo: env.EMAIL_REPLY_TO || null,
    previewDir:
      env.EMAIL_PREVIEW_DIR || (env.NODE_ENV === 'production' ? null : resolve('.emails')),
    mode: apiKey && from ? 'send' : 'preview',
  }
}

const NOT_SENT = 'e-maile z potwierdzeniem nie wychodzą do klientów (tylko podgląd).'

/** Startup warnings for the e-mail setup, each starting with `prefix` (usually the shop name). */
export function emailWarnings(env: Record<string, string | undefined>, prefix: string): string[] {
  const warnings: string[] = []
  if (!env.RESEND_API_KEY) warnings.push(`${prefix}: brak RESEND_API_KEY – ${NOT_SENT}`)
  else if (!env.EMAIL_FROM) warnings.push(`${prefix}: RESEND_API_KEY bez EMAIL_FROM – ${NOT_SENT}`)
  return warnings
}
