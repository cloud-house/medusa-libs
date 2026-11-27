/** Minimal customer password length – the only password rule (spec 5a §3.10). */
export const PASSWORD_MIN_LENGTH = 8

export type OrderStatusKey =
  | 'awaiting_payment'
  | 'placed'
  | 'shipped'
  | 'delivered'
  | 'canceled'
  | 'refunded'

export interface OrderStatusInput {
  /** Medusa `order.status`. */
  status: string
  /** Computed Medusa `payment_status`. */
  payment_status: string
  /** Computed Medusa `fulfillment_status`. */
  fulfillment_status: string
}

const REFUNDED = new Set(['refunded', 'partially_refunded'])
const SHIPPED = new Set(['shipped', 'partially_shipped', 'partially_delivered'])
const AWAITING_PAYMENT = new Set(['not_paid', 'awaiting', 'requires_action'])

/** One status per order, rules in order: canceled → refunded → delivered → shipped → awaiting payment → placed. */
export function orderStatus({
  status,
  payment_status,
  fulfillment_status,
}: OrderStatusInput): OrderStatusKey {
  if (status === 'canceled') return 'canceled'
  if (REFUNDED.has(payment_status)) return 'refunded'
  if (fulfillment_status === 'delivered') return 'delivered'
  if (SHIPPED.has(fulfillment_status)) return 'shipped'
  if (AWAITING_PAYMENT.has(payment_status)) return 'awaiting_payment'
  return 'placed'
}

export const ORDER_STATUS_LABELS: Record<OrderStatusKey, string> = {
  awaiting_payment: 'Czeka na płatność',
  placed: 'Przyjęte',
  shipped: 'Wysłane',
  delivered: 'Dostarczone',
  canceled: 'Anulowane',
  refunded: 'Zwrot pieniędzy',
}

export function orderStatusTone(key: OrderStatusKey): 'success' | 'progress' | 'muted' {
  if (key === 'delivered') return 'success'
  if (key === 'canceled' || key === 'refunded') return 'muted'
  return 'progress'
}
