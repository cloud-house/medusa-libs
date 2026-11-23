import type { EmailContact } from '@cloud-house/medusa-emails'

/** Account e-mails: e-mail confirmation, password reset and set password – one button link each. */
export interface AccountEmailData {
  /** Recipient – names the preview file. */
  email: string
  firstName: string | null
  /** The link of the button: `<storefront><path>` with the code or the token in the query. */
  actionUrl: string
  contact: EmailContact
  seller: string | null
  shopUrl: string
  /** „Set password”: the order that created the account (`#display_id`), `null` – none known. */
  orderNumber?: number | null
}
