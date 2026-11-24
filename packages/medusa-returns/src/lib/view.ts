import {
  type AccountReturn,
  isReturnEligible,
  isReturnReasonCode,
  RETURN_MESSAGES,
  type ReturnInfo,
  type ReturnQuantities,
  returnableQuantity,
  returnExpiredMessage,
  returnLastDay,
  returnStatusKey,
  returnWindowStart,
} from '@cloud-house/commerce-rules'
import type { ReturnOrder, ReturnRow } from '../types'

const quantity = (value: unknown) => Number(value ?? 0)

/**
 * The quantities of an order item from Medusa's `detail` (a missing number counts as 0). Every
 * number goes through `Number(…)` first: `returnableQuantity` gives NaN for a non-number.
 */
export function quantitiesOf(detail: unknown): ReturnQuantities {
  const row = (detail && typeof detail === 'object' ? detail : {}) as Record<string, unknown>
  return {
    quantity: quantity(row.quantity),
    shipped: quantity(row.shipped_quantity),
    requested: quantity(row.return_requested_quantity),
    received: quantity(row.return_received_quantity),
    dismissed: quantity(row.return_dismissed_quantity),
  }
}

/** A return as the customer sees it; `null` for the admin's draft (`open`). */
export function toAccountReturn(
  row: ReturnRow,
  order: Pick<ReturnOrder, 'items'>,
): AccountReturn | null {
  const status = returnStatusKey(row.status)
  if (!status) return null
  return {
    id: row.id,
    display_id: row.displayId,
    status,
    requested_at: row.requestedAt ? row.requestedAt.toISOString() : null,
    items: row.items.map((line) => {
      const item = order.items.find((candidate) => candidate.id === line.itemId)
      return {
        item_id: line.itemId,
        title: item?.title ?? 'Produkt',
        variant: item?.variant ?? null,
        quantity: line.quantity,
        reason: isReturnReasonCode(line.reason) ? line.reason : null,
      }
    }),
  }
}

/**
 * An order that was not placed in the shop (a converted admin draft) has no claim route – the
 * shop's claims answer 404 for it. A fixed text, so that it does not depend on the CMS settings.
 */
export const NOT_SHOP_ORDER_MESSAGE =
  'Zwrot tego zamówienia zgłoś e-mailem – adres znajdziesz na stronie „Dostawa i zwroty”.'

/**
 * What may be returned from the order now, and why not when it may not (spec 6e-b §5.2). The
 * reasons are checked in this order: canceled, not placed in the shop, nothing shipped, window
 * over, nothing left.
 */
export function toReturnInfo(order: ReturnOrder, days: number, now: Date): ReturnInfo {
  const start = returnWindowStart(order.fulfillments)
  const items = order.items.flatMap((item) => {
    const returnable = returnableQuantity(item.quantities)
    return returnable > 0
      ? [
          {
            id: item.id,
            title: item.title,
            variant: item.variant,
            thumbnail: item.thumbnail,
            returnable,
          },
        ]
      : []
  })

  let blocked: string | null = null
  if (order.canceled) blocked = RETURN_MESSAGES.canceled
  else if (!order.shopOrder) blocked = NOT_SHOP_ORDER_MESSAGE
  else if (!start) blocked = RETURN_MESSAGES.notShipped
  else if (!isReturnEligible({ start, days, now, canceled: false })) {
    blocked = returnExpiredMessage(days)
  } else if (items.length === 0) blocked = RETURN_MESSAGES.nothingLeft

  const returns = order.returns
    .flatMap((row) => {
      const entry = toAccountReturn(row, order)
      return entry ? [{ entry, at: row.requestedAt?.getTime() ?? 0 }] : []
    })
    .sort((a, b) => b.at - a.at || b.entry.display_id - a.entry.display_id)
    .map(({ entry }) => entry)

  return {
    eligible: blocked === null,
    blocked,
    window: start
      ? {
          source: start.source,
          started_at: start.at.toISOString(),
          last_day: returnLastDay(start.at, days),
          days,
        }
      : null,
    items,
    returns,
  }
}
