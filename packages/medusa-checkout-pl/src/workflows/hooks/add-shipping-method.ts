import { MedusaError } from '@medusajs/framework/utils'
import { addShippingMethodToCartWorkflow } from '@medusajs/medusa/core-flows'
import { inpostCourierProblem, lockerProblem, optionCodes } from '../../lib/checkout-check'
import { cartItems } from '../../lib/delivery-options'
import { checkoutPlOptions } from '../../lib/plugin-options'

type OptionInput = { id: string; data?: Record<string, unknown> }

/**
 * Bulky items go neither to the InPost courier nor to a parcel locker, and a parcel locker needs a
 * well-formed locker code (spec 3b §4.5, spec 6d §5.2). The parcel locker may be saved before the
 * point is picked – the shop shows the right price at once, and `checkout-check` asks for the
 * point (and a mobile number) before the payment.
 */
addShippingMethodToCartWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
  const { deliveryCodes, texts } = checkoutPlOptions(container)
  const options = (input.options ?? []) as OptionInput[]
  const codes = await optionCodes(
    container,
    options.map((option) => option.id),
  )
  const locker = options.find((option) => codes.get(option.id) === deliveryCodes.inpostLocker)
  const inpostCourier = options.find(
    (option) => codes.get(option.id) === deliveryCodes.inpostCourier,
  )
  if (!locker && !inpostCourier) return
  const { items } = await cartItems(container, cart.id)

  if (inpostCourier) {
    const problem = await inpostCourierProblem(container, items)
    if (problem) throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
  }
  if (locker) {
    const problem = await lockerProblem(container, items, locker.data)
    const notPickedYet = problem === texts.lockerMissing && !locker.data?.parcel_locker
    if (problem && !notPickedYet) throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
  }
})
