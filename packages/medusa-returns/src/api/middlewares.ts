import { closedRoutes } from '@cloud-house/medusa-accounts'
import { authenticate, defineMiddlewares, validateAndTransformBody } from '@medusajs/framework/http'
import { StoreAccountReturn, StoreReturnClaim, StoreReturnLookup } from './store/returns/validators'

/** Routes of a signed-in customer (session or bearer token). */
const CUSTOMER_AUTH = authenticate('customer', ['session', 'bearer'])

export default defineMiddlewares({
  routes: [
    {
      // Medusa's own return route skips the window, the quantities and the guest check; returns go
      // through `/store/returns/claim` and `/store/account/orders/:id/return`. No `method`: this is
      // a prefix match, but `closedRoutes` closes the exact path only.
      matcher: '/store/returns',
      middlewares: [closedRoutes(['/store/returns'])],
    },
    {
      matcher: '/store/account/orders/:id/return',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountReturn)],
    },
    {
      // No sign-in: a guest gives the order number and the e-mail.
      matcher: '/store/returns/lookup',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreReturnLookup)],
    },
    {
      matcher: '/store/returns/claim',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreReturnClaim)],
    },
  ],
})
