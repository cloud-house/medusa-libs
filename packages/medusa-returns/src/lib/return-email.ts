import { returnReasonLabel } from '@cloud-house/commerce-rules'
import { DEFAULT_STOREFRONT_URL } from '@cloud-house/medusa-accounts'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type {
  ReturnAlertEmailData,
  ReturnEmailLine,
  ReturnRequestedEmailData,
} from '../emails/types'
import type { ReturnContact, ReturnOrder, ReturnRow } from '../types'
import { logPrefix, returnsOptions } from './plugin-options'
import { readContact, returnPolicyOf } from './policy'
import { loadReturn } from './return-row'

type Env = Record<string, string | undefined>

/** Storefront origin from `STOREFRONT_URL` (no trailing slash). */
const storefrontUrl = (env: Env) =>
  (env.STOREFRONT_URL || DEFAULT_STOREFRONT_URL).replace(/\/+$/, '')

/** Where replies go: `EMAIL_REPLY_TO`, else the contact's `replyTo`, else its e-mail. */
const replyToFor = (env: Env, contact: ReturnContact | null) =>
  env.EMAIL_REPLY_TO || contact?.replyTo || contact?.email || null

export interface ReturnEmails {
  /** The „we have your return” e-mail; `null` – no e-mail on the order or a silenced return. */
  customer: { to: string; data: ReturnRequestedEmailData; replyTo: string | null } | null
  /** The alert for the shop; `null` – the shop has no contact e-mail. */
  staff: { to: string; data: ReturnAlertEmailData } | null
}

const NONE: ReturnEmails = { customer: null, staff: null }

/** The lines of a return as the e-mails show them: the order item's name and the reason's label. */
function emailLines(order: ReturnOrder, row: ReturnRow): ReturnEmailLine[] {
  return row.items.map((line) => {
    const item = order.items.find((candidate) => candidate.id === line.itemId)
    return {
      name: item?.title ?? 'Produkt',
      variant: item?.variant ?? null,
      quantity: line.quantity,
      reason: returnReasonLabel(line.reason),
    }
  })
}

/** Whether the order's customer has an account – then the e-mail links the order there. */
async function hasAccount(container: MedusaContainer, orderId: string): Promise<boolean> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order',
    fields: ['id', 'customer.has_account'],
    filters: { id: orderId },
  })
  const [order] = data as unknown as { customer?: { has_account?: boolean } | null }[]
  return Boolean(order?.customer?.has_account)
}

/**
 * Everything the two e-mails about a new return need (spec 6e-b §5.5). Both are `null` for an
 * order not placed in the shop (entered in the admin) and for a return of another order or an
 * unknown one. A return created with `no_notification` (by the staff in the admin) is silent
 * towards the customer but still alerts the shop. The alert needs the shop's contact e-mail from
 * the CMS – without it only the error log knows.
 */
export async function loadReturnEmails(
  container: MedusaContainer,
  orderId: string,
  returnId: string,
  env: Env,
): Promise<ReturnEmails> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const [order, row] = await Promise.all([
    returnsOptions(container).resolveOrder(container, orderId),
    loadReturn(container, returnId),
  ])
  if (!order?.shopOrder || !row || row.orderId !== order.id) return NONE

  const { labelPath, accountOrderPath } = returnsOptions(container)
  const contact = await readContact(container)
  if (!contact) {
    logger.warn(
      `${logPrefix(container)} Zwrot #${row.displayId} – kontakt sklepu niedostępny, e-mail wyjdzie bez danych kontaktowych.`,
    )
  }
  const items = emailLines(order, row)
  const shopUrl = storefrontUrl(env)

  let customer: ReturnEmails['customer'] = null
  if (order.email && !row.noNotification) {
    const replyTo = replyToFor(env, contact)
    customer = {
      to: order.email,
      replyTo,
      data: {
        displayId: order.displayId,
        returnNumber: row.displayId,
        items,
        address: returnPolicyOf(contact).address,
        labelUrl: `${shopUrl}${labelPath.replace(':displayId', String(order.displayId))}`,
        accountUrl: (await hasAccount(container, order.id))
          ? `${shopUrl}${accountOrderPath.replace(':id', order.id)}`
          : null,
        shopUrl,
        contact: {
          canReply: Boolean(replyTo),
          email: contact?.email ?? null,
          phone: contact?.phone ?? null,
          hours: contact?.hours ?? null,
        },
        seller: contact?.seller ?? null,
      },
    }
  }

  let staff: ReturnEmails['staff'] = null
  if (contact?.email) {
    const adminBase = env.MEDUSA_ADMIN_URL?.trim().replace(/\/+$/, '')
    staff = {
      to: contact.email,
      data: {
        displayId: order.displayId,
        returnNumber: row.displayId,
        orderId: order.id,
        email: order.email,
        items,
        note: row.items.find((line) => line.note)?.note ?? null,
        adminUrl: adminBase ? `${adminBase}/orders/${order.id}` : null,
        shopUrl,
      },
    }
  } else {
    logger.error(
      `${logPrefix(container)} Zwrot #${row.displayId} zamówienia #${order.displayId} – brak e-maila kontaktowego sklepu, alert nie wyszedł.`,
    )
  }

  return { customer, staff }
}
