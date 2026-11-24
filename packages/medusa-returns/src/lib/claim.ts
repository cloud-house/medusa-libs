import {
  type AccountReturn,
  isReturnReasonCode,
  RETURN_MESSAGES,
  RETURN_OPTION_CODE,
  RETURN_REASONS,
  type ReturnClaimItemInput,
  type ReturnReasonCode,
} from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { createAndCompleteReturnOrderWorkflow } from '@medusajs/medusa/core-flows'
import { RETURNS_ERROR_CODES, returnsError } from '../errors'
import { logPrefix, returnsOptions } from './plugin-options'
import { loadReturnPolicy } from './policy'
import { loadReturn } from './return-row'
import { toAccountReturn, toReturnInfo } from './view'

const ERROR_TYPES = { 400: 'not_allowed', 404: 'not_found', 409: 'conflict' } as const

/** A claim that cannot be accepted – the message is Polish and goes to the customer as it is. */
export class ReturnClaimError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message)
    this.name = 'ReturnClaimError'
  }

  /** The `type` of the HTTP error body. */
  get type(): (typeof ERROR_TYPES)[400 | 404 | 409] {
    return ERROR_TYPES[this.status]
  }
}

/** The answer for a guest whose number or e-mail does not match – the same for both. */
export const GUEST_NOT_FOUND = {
  type: 'not_found',
  message: RETURN_MESSAGES.guestNotFound,
} as const

const NO_ORDER_MESSAGE = 'Nie znaleziono zamówienia.'
const LOCK_TIMEOUT_S = 30
/** How both locking providers (in-memory, Redis) end a wait that ran out. */
const LOCK_TIMED_OUT = 'Timed-out acquiring lock.'

/** Workflow and module errors may come as plain objects with `message`. */
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error)

/** The shipping option „Zwrot we własnym zakresie” that every return is created with. */
export async function returnOptionId(container: MedusaContainer): Promise<string> {
  const options = await container
    .resolve(Modules.FULFILLMENT)
    .listShippingOptions({}, { relations: ['type'], select: ['id'] })
  const found = options.find((option) => option.type?.code === RETURN_OPTION_CODE)
  if (!found) {
    throw returnsError(
      RETURNS_ERROR_CODES.noReturnOption,
      `the return shipping option "${RETURN_OPTION_CODE}" does not exist – create it (a shipping option whose type code is "${RETURN_OPTION_CODE}", see the plugin README, "Return shipping option").`,
    )
  }
  return found.id
}

/**
 * The stock location the return option ships back to. The workflow reads it for the return's
 * fulfillment but does not store it on the return unless it is given – and a return without a
 * location cannot be received in the admin ("Cannot receive the Return at location null").
 */
async function returnLocationId(container: MedusaContainer, optionId: string): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'shipping_option',
    fields: ['id', 'service_zone.fulfillment_set.location.id'],
    filters: { id: optionId },
  })
  const [option] = data as unknown as {
    service_zone?: { fulfillment_set?: { location?: { id?: string } | null } | null } | null
  }[]
  const locationId = option?.service_zone?.fulfillment_set?.location?.id
  if (!locationId) {
    throw returnsError(
      RETURNS_ERROR_CODES.noLocation,
      `the return shipping option "${RETURN_OPTION_CODE}" has no stock location – connect its fulfillment set to a stock location.`,
    )
  }
  return locationId
}

/** The ids of the Medusa return reasons by the code the storefront sends. */
export async function returnReasonIds(
  container: MedusaContainer,
): Promise<Map<ReturnReasonCode, string>> {
  const reasons = await container
    .resolve(Modules.ORDER)
    .listReturnReasons({ value: RETURN_REASONS.map((reason) => reason.id) })
  const ids = new Map<ReturnReasonCode, string>()
  for (const reason of reasons) {
    if (isReturnReasonCode(reason.value)) ids.set(reason.value, reason.id)
  }
  return ids
}

/**
 * The shop order a guest means by its number and e-mail (compared without case and spaces); `null`
 * for every other case – no such number, another e-mail, a draft or an order not placed in the
 * shop – so the caller can answer all of them alike.
 */
export async function findGuestOrder(
  container: MedusaContainer,
  displayId: number,
  email: string,
): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'order',
    fields: ['id', 'email', 'is_draft_order'],
    // The generated filter type takes a string, the column is a number.
    filters: { display_id: displayId } as never,
  })
  const [order] = data as unknown as {
    id: string
    email: string | null
    is_draft_order: boolean
  }[]
  const given = email.trim().toLowerCase()
  if (
    !order ||
    order.is_draft_order ||
    !order.email ||
    order.email.trim().toLowerCase() !== given
  ) {
    return null
  }
  const { data: links } = await query.graph({
    entity: 'order_cart',
    fields: ['cart_id'],
    filters: { order_id: order.id },
  })
  return links.length ? order.id : null
}

/** A line of a claim as it arrives: the reason is still any text – `claimReturn` checks the code. */
export type ReturnClaimLine = Omit<ReturnClaimItemInput, 'reason'> & { reason: string }

export interface ReturnClaimInput {
  orderId: string
  items: ReturnClaimLine[]
  note: string | null
}

/**
 * Creates the return of the customer's request (spec 6e-b §5.4). The rules are the backend's, not
 * Medusa's: the window, the quantities (Medusa would let a received piece be returned again) and
 * the reasons. One claim per order at a time, so two requests for the same piece cannot both pass.
 */
export async function claimReturn(
  container: MedusaContainer,
  input: ReturnClaimInput,
  now: Date = new Date(),
): Promise<AccountReturn> {
  try {
    return await container
      .resolve(Modules.LOCKING)
      .execute(`return-claim:${input.orderId}`, () => claimLocked(container, input, now), {
        timeout: LOCK_TIMEOUT_S,
      })
  } catch (error) {
    // Another claim kept the lock for the whole wait – it is saving this order's return.
    if (errorText(error) === LOCK_TIMED_OUT) throw new ReturnClaimError(RETURN_MESSAGES.busy, 409)
    throw error
  }
}

async function claimLocked(
  container: MedusaContainer,
  input: ReturnClaimInput,
  now: Date,
): Promise<AccountReturn> {
  const order = await returnsOptions(container).resolveOrder(container, input.orderId)
  if (!order?.shopOrder) throw new ReturnClaimError(NO_ORDER_MESSAGE, 404)
  const policy = await loadReturnPolicy(container)
  const info = toReturnInfo(order, policy.days, now)
  if (!info.eligible) throw new ReturnClaimError(info.blocked ?? RETURN_MESSAGES.nothingLeft)

  // Every line's reason must be a shop code; lines of one item add up (the first line's reason
  // stands), then no more than what is left may be asked for.
  const wanted = new Map<string, { quantity: number; reason: ReturnReasonCode }>()
  for (const line of input.items) {
    if (!isReturnReasonCode(line.reason)) throw new ReturnClaimError(RETURN_MESSAGES.reason)
    const known = wanted.get(line.id)
    wanted.set(line.id, {
      quantity: (known?.quantity ?? 0) + line.quantity,
      reason: known?.reason ?? line.reason,
    })
  }
  for (const [id, line] of wanted) {
    const left = info.items.find((item) => item.id === id)?.returnable ?? 0
    if (line.quantity > left) throw new ReturnClaimError(RETURN_MESSAGES.quantity)
  }

  const [optionId, reasonIds] = await Promise.all([
    returnOptionId(container),
    returnReasonIds(container),
  ])
  const locationId = await returnLocationId(container, optionId)
  const items = [...wanted].map(([id, line]) => {
    const reasonId = reasonIds.get(line.reason)
    if (!reasonId) {
      throw returnsError(
        RETURNS_ERROR_CODES.noReturnReason,
        `the return reason "${line.reason}" does not exist – run ensureReturnReasons(container) (see the plugin README).`,
      )
    }
    // The workflow ignores a note of the return itself, so the customer's goes on every line.
    return { id, quantity: line.quantity, reason_id: reasonId, note: input.note || undefined }
  })

  let created: { id: string }
  try {
    const { result } = await createAndCompleteReturnOrderWorkflow(container).run({
      input: {
        order_id: input.orderId,
        items,
        location_id: locationId,
        return_shipping: { option_id: optionId, price: 0 },
      },
    })
    created = result as unknown as { id: string }
  } catch (error) {
    // Medusa's own checks (quantities, reasons) – the customer sees the quantity hint.
    if ((error as { type?: unknown } | null)?.type === 'invalid_data') {
      throw new ReturnClaimError(RETURN_MESSAGES.quantity)
    }
    throw error
  }

  const saved = await loadReturn(container, created.id)
  const view = saved ? toAccountReturn(saved, order) : null
  if (!view) throw new Error(`${logPrefix(container)} Return ${created.id} was not saved.`)
  return view
}
