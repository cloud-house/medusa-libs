import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { NEWSLETTER_MODULE } from '../../../modules/newsletter'
import type NewsletterModuleService from '../../../modules/newsletter/service'

/** Sign-ups for the panel, newest first: `?q=` (part of the e-mail), `limit`, `offset`. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const newsletter: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE)
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const [subscribers, count] = await newsletter.listAndCountNewsletterSubscribers(
    q ? { email: { $ilike: `%${q}%` } } : {},
    { order: { consent_at: 'DESC' }, take: limit, skip: offset },
  )
  res.json({ subscribers, count, limit, offset })
}
