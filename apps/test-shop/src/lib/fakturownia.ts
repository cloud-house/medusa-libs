import type { InvoiceOrder, ReturnRow } from '@cloud-house/medusa-fakturownia'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

const cents = (value: unknown) => Math.round(Number(value ?? 0) * 100)

interface OrderRow {
  id: string
  display_id: number
  email?: string | null
  total: number
  created_at: string
  canceled_at?: string | null
  items?: { id: string; title: string; quantity: number; unit_price: number; total: number }[]
  shipping_address?: {
    first_name?: string
    last_name?: string
    address_1?: string
    postal_code?: string
    city?: string
  } | null
  customer?: { has_account?: boolean } | null
}

/**
 * The test shop's `resolveOrder`: an order straight from the Order module, always paid (the test
 * shop has no checkout). A real shop reads its own checkout's amounts here.
 */
export async function resolveOrder(
  container: MedusaContainer,
  orderId: string,
): Promise<InvoiceOrder | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'email',
      'total',
      'created_at',
      'canceled_at',
      'items.id',
      'items.title',
      'items.quantity',
      'items.unit_price',
      'items.total',
      'shipping_address.*',
      'customer.has_account',
    ],
    filters: { id: orderId },
  })
  const order = data[0] as unknown as OrderRow | undefined
  if (!order) return null
  const address = order.shipping_address ?? {}
  return {
    id: order.id,
    displayId: order.display_id,
    email: order.email ?? null,
    totalCents: cents(order.total),
    createdAt: new Date(order.created_at),
    nip: null,
    billing: {
      firstName: address.first_name ?? '',
      lastName: address.last_name ?? '',
      company: null,
      address1: address.address_1 ?? '',
      address2: null,
      postalCode: address.postal_code ?? '',
      city: address.city ?? '',
    },
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      name: item.title,
      sku: null,
      quantity: Number(item.quantity),
      unitPriceCents: cents(item.unit_price),
      totalCents: cents(item.total),
      taxRate: 23,
    })),
    shipping: null,
    paid: true,
    paidAt: new Date(order.created_at),
    providerId: null,
    canceled: Boolean(order.canceled_at),
    hasAccount: Boolean(order.customer?.has_account),
    shopOrder: true,
  }
}

export const resolveReturnOrder = async () => null
export const resolveReturn = async (): Promise<ReturnRow | null> => null
