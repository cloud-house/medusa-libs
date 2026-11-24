import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { ReturnRow } from '../types'

type Row = Record<string, unknown>

/** Query fields of a Medusa return with its lines and the reason's code. */
export const RETURN_FIELDS = [
  'id',
  'display_id',
  'order_id',
  'status',
  'requested_at',
  'received_at',
  'no_notification',
  'items.item_id',
  'items.quantity',
  'items.received_quantity',
  'items.note',
  'items.reason.value',
]

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const rows = (value: unknown) => (Array.isArray(value) ? (value.filter(Boolean) as Row[]) : [])
const record = (value: unknown) => (value && typeof value === 'object' ? (value as Row) : {})
const date = (value: unknown) => (value ? new Date(value as string | Date) : null)

/** A `return` query row as a {@link ReturnRow}. */
export function toReturnRow(row: Row): ReturnRow {
  return {
    id: String(row.id),
    displayId: Number(row.display_id),
    orderId: String(row.order_id),
    status: String(row.status ?? ''),
    requestedAt: date(row.requested_at),
    receivedAt: date(row.received_at),
    noNotification: Boolean(row.no_notification),
    items: rows(row.items).map((item) => ({
      itemId: String(item.item_id),
      quantity: Number(item.quantity ?? 0),
      receivedQuantity: Number(item.received_quantity ?? 0),
      reason: text(record(item.reason).value),
      note: text(item.note),
    })),
  }
}

/** One return with its lines; `null` when there is no such return. */
export async function loadReturn(
  container: MedusaContainer,
  returnId: string,
): Promise<ReturnRow | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'return',
    fields: RETURN_FIELDS,
    filters: { id: returnId },
  })
  const [found] = data as Row[]
  return found ? toReturnRow(found) : null
}
