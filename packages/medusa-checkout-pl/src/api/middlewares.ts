import { authenticate, defineMiddlewares } from '@medusajs/framework/http'
import { guestOrderGuard } from '../lib/guard'

export default defineMiddlewares({
  routes: [
    {
      // Medusa serves `GET /store/orders/:id` to anyone with the id; a guest order stays private.
      matcher: '/store/orders/:id',
      method: 'GET',
      middlewares: [
        authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true }),
        guestOrderGuard,
      ],
    },
  ],
})
