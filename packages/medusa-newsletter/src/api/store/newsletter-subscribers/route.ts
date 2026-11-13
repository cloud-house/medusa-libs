import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { NEWSLETTER_ERROR_CODES } from '../../../errors'
import { NEWSLETTER_MODULE } from '../../../modules/newsletter'
import type NewsletterModuleService from '../../../modules/newsletter/service'
import type { StoreNewsletterSubscribeType } from './validators'

/** `?email=` – whether the address already signed up (the form says „already on the list”). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const email = String(req.query.email ?? '')
    .trim()
    .toLowerCase()
  const newsletter: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE)
  const [, count] = email
    ? await newsletter.listAndCountNewsletterSubscribers({ email }, { take: 1 })
    : [[], 0]
  res.json({ exists: count > 0 })
}

/**
 * 422 `newsletter_already_subscribed`. Sent directly: Medusa's error handler replaces the `code` of a
 * `DUPLICATE_ERROR` with `invalid_request_error`.
 */
function alreadySubscribed(res: MedusaResponse, message: string) {
  res.status(422).json({
    type: MedusaError.Types.DUPLICATE_ERROR,
    code: NEWSLETTER_ERROR_CODES.alreadySubscribed,
    message,
  })
}

/** A new sign-up; an address already on the list – 422 (`newsletter_already_subscribed`). */
export async function POST(req: MedusaRequest<StoreNewsletterSubscribeType>, res: MedusaResponse) {
  const newsletter: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE)
  const { messages } = newsletter.getOptions()
  const body = req.validatedBody
  const [, count] = await newsletter.listAndCountNewsletterSubscribers(
    { email: body.email },
    { take: 1 },
  )
  if (count > 0) return alreadySubscribed(res, messages.alreadySubscribed)
  try {
    const subscriber = await newsletter.createNewsletterSubscribers({
      email: body.email,
      consent_text: body.consent_text,
      consent_at: new Date(body.consent_at),
      source: body.source,
    })
    res.status(201).json({ subscriber: { id: subscriber.id, email: subscriber.email } })
  } catch (error) {
    // Two submissions at once: the unique index refused the second one.
    const [, again] = await newsletter.listAndCountNewsletterSubscribers(
      { email: body.email },
      { take: 1 },
    )
    if (again > 0) return alreadySubscribed(res, messages.alreadySubscribed)
    throw error
  }
}
