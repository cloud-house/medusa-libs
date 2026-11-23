import type { MedusaContainer } from '@medusajs/framework/types'
import type { EmailLocale, EmailMessages } from './messages'
import type { ResolvedEmailTheme } from './theme'

/** What a template returns; `name` is the file name (no extension) of the preview written when nothing is sent. */
export interface RenderedEmail {
  subject: string
  html: string
  text: string
  name: string
}

/** What the provider hands to a template next to the notification data. */
export interface RenderContext {
  theme: ResolvedEmailTheme
  messages: EmailMessages
  locale: EmailLocale
}

/** One e-mail the shop can send, picked by the notification's `template`. */
export interface EmailTemplate {
  name: string
  render(data: Record<string, unknown>, ctx: RenderContext): Promise<RenderedEmail>
}

/** The shop's contact data shown in the e-mails; any part may be `null`. */
export interface ShopContact {
  email: string | null
  phone: string | null
  hours: string | null
  seller: string | null
}

/** Reads the shop's current contact data (usually from the shop's settings or CMS). */
export type ContactResolver = (container: MedusaContainer) => Promise<ShopContact | null>
