import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import type { ShipmentAlertEmailData, ShipmentAlertKind } from '../emails/types'
import { prefixedLogger } from './log'
import { furgonetkaOptions } from './plugin-options'
import { storefrontUrl } from './storefront-url'

export type { ShipmentAlertKind }

type Env = Record<string, string | undefined>

/** What an alert is about: an order, or – for the lost connection – nothing but the shop. */
export interface ShipmentAlertSubject {
  orderId: string | null
  displayId: number | null
  message: string
}

/** The shop's contact; a resolver that fails counts as no contact (the alert then goes to the log only). */
async function contactOf(container: MedusaContainer) {
  try {
    return (await furgonetkaOptions(container).resolveContact?.(container)) ?? null
  } catch {
    return null
  }
}

/** What the log says in place of an alert that cannot go out. */
function subjectLine(subject: ShipmentAlertSubject): string {
  if (subject.displayId) return `Przesyłka do zamówienia #${subject.displayId}`
  return subject.orderId ? `Przesyłka do zamówienia ${subject.orderId}` : 'Połączenie z Furgonetką'
}

/**
 * One alert to the shop's contact address (spec 6d §5.11). Returns whether it went out – without
 * the address (store settings without a contact e-mail) only the error log knows. Whether this problem was
 * alerted about already is the caller's to decide (`alerted_for`).
 */
export async function sendShipmentAlert(
  container: MedusaContainer,
  kind: ShipmentAlertKind,
  subject: ShipmentAlertSubject,
  now: Date,
  env: Env = process.env,
): Promise<boolean> {
  const logger = prefixedLogger(container)
  const contact = await contactOf(container)
  if (!contact?.email) {
    logger.error(
      `${subjectLine(subject)} wymaga uwagi (${kind}): ${subject.message} – brak e-maila kontaktowego sklepu, alert nie wyszedł.`,
    )
    return false
  }
  const adminBase = env.MEDUSA_ADMIN_URL?.trim().replace(/\/+$/, '')
  const adminPath = subject.orderId ? `/orders/${subject.orderId}` : '/settings/wysylka'
  const data: ShipmentAlertEmailData = {
    kind,
    displayId: subject.displayId,
    message: subject.message,
    adminUrl: adminBase ? `${adminBase}${adminPath}` : null,
    shopUrl: storefrontUrl(env),
  }
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: contact.email,
    channel: 'email',
    template: 'shipment-alert',
    data: data as unknown as Record<string, unknown>,
    idempotency_key: `shipment-alert:${subject.orderId ?? 'connection'}:${kind}:${now.getTime()}`,
    ...(subject.orderId ? { resource_type: 'order', resource_id: subject.orderId } : {}),
    trigger_type: 'shipment.alert',
  })
  return true
}
