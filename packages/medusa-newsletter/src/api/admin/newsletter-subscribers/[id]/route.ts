import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { NEWSLETTER_MODULE } from '../../../../modules/newsletter'
import type NewsletterModuleService from '../../../../modules/newsletter/service'

/** GDPR request: removes the sign-up (the contact at the e-mail provider is removed in its panel). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const newsletter: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE)
  await newsletter.deleteNewsletterSubscribers(req.params.id as string)
  res.json({ id: req.params.id, object: 'newsletter_subscriber', deleted: true })
}
