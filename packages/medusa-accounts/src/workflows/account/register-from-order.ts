import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils'
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { updateOrdersStep } from '@medusajs/medusa/core-flows'
import { registeredCustomerByEmail } from '../../lib/account'
import { accountError } from '../../lib/account-error'
import { registerCustomerWorkflow } from './register-customer'

export interface RegisterFromOrderInput {
  orderId: string
  cartId: string
  password: string
}

/** Only the browser that placed the order (its cart id) may turn it into an account. */
export const orderForAccountStep = createStep(
  'order-for-account',
  async ({ orderId, cartId }: RegisterFromOrderInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: links } = await query.graph({
      entity: 'order_cart',
      fields: ['order_id'],
      filters: { order_id: orderId, cart_id: cartId },
    })
    if (!links.length) throw accountError(container, MedusaError.Types.NOT_FOUND, 'orderNotFound')
    const [order] = await container
      .resolve(Modules.ORDER)
      .listOrders({ id: orderId }, { select: ['id', 'email'], relations: ['shipping_address'] })
    if (!order?.email) throw accountError(container, MedusaError.Types.NOT_FOUND, 'orderNotFound')
    if (await registeredCustomerByEmail(container, order.email)) {
      throw accountError(container, MedusaError.Types.DUPLICATE_ERROR, 'duplicateAccount')
    }
    const address = order.shipping_address
    return new StepResponse({
      email: order.email.toLowerCase(),
      first_name: address?.first_name ?? '',
      last_name: address?.last_name ?? '',
      phone: address?.phone ?? '',
    })
  },
)

/** „Create an account – just set a password” on the confirmation page. */
export const registerFromOrderWorkflow = createWorkflow(
  'register-from-order',
  (input: RegisterFromOrderInput) => {
    const person = orderForAccountStep(input)
    const account = registerCustomerWorkflow.runAsStep({
      input: transform({ person, input }, ({ person, input }) => ({
        ...person,
        password: input.password,
      })),
    })
    updateOrdersStep(
      transform({ account, input }, ({ account, input }) => ({
        selector: { id: input.orderId },
        update: { customer_id: account.customerId },
      })),
    )
    return new WorkflowResponse(
      transform({ account, person }, ({ account, person }) => ({
        customerId: account.customerId,
        email: person.email,
      })),
    )
  },
)
