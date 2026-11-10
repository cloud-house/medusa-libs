import { model } from '@medusajs/framework/utils'

/**
 * Newsletter sign-up – proof of consent. Only the shop's forms create entries (footer, home page,
 * account registration, checkout) and nobody edits them; deleting one is a GDPR request.
 */
export const NewsletterSubscriber = model
  .define('newsletter_subscriber', {
    id: model.id({ prefix: 'nsub' }).primaryKey(),
    email: model.text(),
    consent_text: model.text(),
    consent_at: model.dateTime(),
    source: model.enum(['footer', 'home', 'register', 'checkout']),
  })
  .indexes([{ on: ['email'], unique: true, where: 'deleted_at IS NULL' }])
