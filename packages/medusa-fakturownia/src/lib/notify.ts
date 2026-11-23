import { DEFAULT_STOREFRONT_URL } from '@cloud-house/medusa-accounts'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import type { InvoiceRow } from '../modules/fakturownia/service'
import type {
  InvoiceAlertEmailData,
  InvoiceAlertKind,
  InvoiceContact,
  InvoiceEmailData,
  InvoiceOrder,
} from '../types'
import { logPrefix, pluginOptions } from './plugin-options'

type Env = Record<string, string | undefined>

/** Storefront origin from `STOREFRONT_URL` (no trailing slash). */
const storefrontUrl = (env: Env) =>
  (env.STOREFRONT_URL || DEFAULT_STOREFRONT_URL).replace(/\/+$/, '')

/** Where replies to the invoice e-mail go: `EMAIL_REPLY_TO`, else the contact's `replyTo`, else its e-mail. */
const replyToFor = (env: Env, contact: InvoiceContact | null) =>
  env.EMAIL_REPLY_TO || contact?.replyTo || contact?.email || null

const contactOf = (container: MedusaContainer) =>
  pluginOptions(container).resolveContact?.(container) ?? Promise.resolve(null)

/** `Faktura-FV-12-11-2026.pdf` – the invoice number with `/` and spaces made file-safe. */
export function invoiceFilename(number: string): string {
  return `Faktura-${number.replace(/[^\w.-]+/g, '-')}.pdf`
}

/**
 * The customer's invoice e-mail with the PDF (spec 6c §5.5). The PDF goes in `attachments`,
 * which the Notification module hands to the provider but does not store. Throws when the
 * provider fails – the caller counts the attempt.
 */
export async function sendInvoiceEmail(
  container: MedusaContainer,
  row: InvoiceRow,
  order: InvoiceOrder,
  pdf: Buffer,
  idempotencyKey: string,
  env: Env = process.env,
): Promise<void> {
  const contact = await contactOf(container)
  const replyTo = replyToFor(env, contact)
  const shopUrl = storefrontUrl(env)
  const number = row.number ?? ''
  const data: InvoiceEmailData = {
    displayId: order.displayId,
    number,
    total: order.totalCents / 100,
    accountUrl: order.hasAccount
      ? `${shopUrl}${pluginOptions(container).accountOrderPath.replace(':id', order.id)}`
      : null,
    shopUrl,
    seller: contact?.seller ?? null,
    contact: {
      canReply: Boolean(replyTo),
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      hours: contact?.hours ?? null,
    },
  }
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: order.email as string,
    channel: 'email',
    template: 'invoice',
    data: data as unknown as Record<string, unknown>,
    provider_data: replyTo ? { reply_to: replyTo } : null,
    attachments: [
      {
        filename: invoiceFilename(number),
        content: pdf.toString('base64'),
        content_type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
    idempotency_key: idempotencyKey,
    resource_type: 'order',
    resource_id: order.id,
    trigger_type: 'invoice.issued',
  })
}

/**
 * One alert to the shop's contact address (spec 6c §5.6). Returns whether it went out – without
 * the address (store settings without a contact e-mail) only the error log knows. `keySuffix` sets apart alerts
 * of one order and kind at the same moment (the credit notes of two returns in one pass).
 */
export async function sendInvoiceAlert(
  container: MedusaContainer,
  order: Pick<InvoiceOrder, 'id' | 'displayId'>,
  kind: InvoiceAlertKind,
  message: string,
  now: Date,
  keySuffix?: string,
  env: Env = process.env,
): Promise<boolean> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const contact = await contactOf(container)
  if (!contact?.email) {
    logger.error(
      `${logPrefix(container)} Faktura do zamówienia #${order.displayId} wymaga uwagi (${kind}): ${message} – brak e-maila kontaktowego sklepu, alert nie wyszedł.`,
    )
    return false
  }
  const adminBase = env.MEDUSA_ADMIN_URL?.trim().replace(/\/+$/, '')
  const data: InvoiceAlertEmailData = {
    displayId: order.displayId,
    orderId: order.id,
    kind,
    message,
    adminUrl: adminBase ? `${adminBase}/orders/${order.id}` : null,
    shopUrl: storefrontUrl(env),
  }
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: contact.email,
    channel: 'email',
    template: 'invoice-alert',
    data: data as unknown as Record<string, unknown>,
    idempotency_key: `invoice-alert:${order.id}:${kind}:${now.getTime()}${keySuffix ? `:${keySuffix}` : ''}`,
    resource_type: 'order',
    resource_id: order.id,
    trigger_type: 'invoice.alert',
  })
  return true
}
