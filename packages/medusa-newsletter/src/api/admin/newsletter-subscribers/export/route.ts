import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { subscribersCsv } from '../../../../lib/subscribers-csv'
import { NEWSLETTER_MODULE } from '../../../../modules/newsletter'
import type NewsletterModuleService from '../../../../modules/newsletter/service'

/** Every sign-up as CSV (import at the e-mail provider), oldest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const newsletter: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE)
  const rows = await newsletter.listNewsletterSubscribers(
    {},
    { order: { consent_at: 'ASC' }, take: null },
  )
  const date = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="newsletter-${date}.csv"`)
  res.send(
    subscribersCsv(
      rows.map((row) => ({
        email: row.email,
        consentAt: new Date(row.consent_at).toISOString(),
        source: row.source,
        consentText: row.consent_text,
      })),
      newsletter.getOptions().messages.csvColumns,
    ),
  )
}
