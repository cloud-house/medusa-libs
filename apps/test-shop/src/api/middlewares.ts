import { authenticate, defineMiddlewares } from '@medusajs/framework/http'

// The shop's own entry for its own route; the plugin's middlewares are merged with these.
export default defineMiddlewares({
  routes: [
    {
      matcher: '/store/account/orders/:id',
      method: 'GET',
      middlewares: [authenticate('customer', ['session', 'bearer'])],
    },
  ],
})
