import { timingSafeEqual } from 'node:crypto'
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { NEWSLETTER_ERROR_CODES } from '../../../errors'
import { newsletterOptions } from '../../../lib/plugin-options'

/**
 * Only the storefront's server writes sign-ups (it rate-limits the forms per IP); the shared
 * secret keeps anyone else from calling the route directly. Header and env come from the plugin
 * options (`storefrontSecret`).
 */
export function storefrontOnly(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const { storefrontSecret, messages } = newsletterOptions(req.scope)
  const secret = process.env[storefrontSecret.env]
  const header = req.headers[storefrontSecret.header]
  const given = Buffer.from(Array.isArray(header) ? (header[0] ?? '') : (header ?? ''))
  const expected = Buffer.from(secret ?? '')
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    res.status(401).json({
      code: NEWSLETTER_ERROR_CODES.storefrontSecretInvalid,
      message: messages.unauthorized,
    })
    return
  }
  next()
}
