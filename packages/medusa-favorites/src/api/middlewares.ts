import { authenticate, defineMiddlewares, validateAndTransformBody } from '@medusajs/framework/http'
import {
  StoreAccountFavorite,
  StoreAccountFavoritesMerge,
} from './store/account/favorites/validators'

/** Routes of a signed-in customer (session or bearer token). */
const CUSTOMER_AUTH = authenticate('customer', ['session', 'bearer'])

export default defineMiddlewares({
  routes: [
    { matcher: '/store/account/favorites', method: 'GET', middlewares: [CUSTOMER_AUTH] },
    {
      matcher: '/store/account/favorites',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountFavorite)],
    },
    {
      matcher: '/store/account/favorites/merge',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountFavoritesMerge)],
    },
    {
      matcher: '/store/account/favorites/:product_id',
      method: 'DELETE',
      middlewares: [CUSTOMER_AUTH],
    },
  ],
})
