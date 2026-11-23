import { authenticate, defineMiddlewares } from '@medusajs/framework/http'

/** Routes of a signed-in customer (session or bearer token). */
const CUSTOMER_AUTH = authenticate('customer', ['session', 'bearer'])

export default defineMiddlewares({
  routes: [
    { matcher: '/store/account/orders/:id/invoice', method: 'GET', middlewares: [CUSTOMER_AUTH] },
  ],
})
