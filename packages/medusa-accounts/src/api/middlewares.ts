import { authenticate, defineMiddlewares, validateAndTransformBody } from '@medusajs/framework/http'
import { closedRoutes, rejectCustomerMetadata, verificationDisabled } from './guards/body-guards'
import { rejectCustomerTokens, sessionGuard } from './guards/session-guard'
import {
  StoreAccountCart,
  StoreAccountConfirmEmail,
  StoreAccountDelete,
  StoreAccountEmpty,
  StoreAccountPassword,
  StoreAccountRegister,
  StoreAccountRegisterFromOrder,
  StoreAccountSetPassword,
} from './store/account/validators'

/** Routes of a signed-in customer (session or bearer token). */
const CUSTOMER_AUTH = authenticate('customer', ['session', 'bearer'])

export default defineMiddlewares({
  routes: [
    // Without `method` these entries run before Medusa validates the body. Medusa merges them with
    // the shop's own `middlewares.ts`, so `/store/account*` also guards the shop's own
    // `/store/account/*` routes (e.g. its orders).
    { matcher: '/store/customers/me*', middlewares: [sessionGuard] },
    { matcher: '/store/orders*', middlewares: [sessionGuard] },
    { matcher: '/store/account*', middlewares: [sessionGuard] },
    { matcher: '/store/carts/:id/customer', middlewares: [sessionGuard] },
    { matcher: '/store/customers', middlewares: [rejectCustomerMetadata] },
    { matcher: '/auth/verification/*', middlewares: [verificationDisabled] },
    { matcher: '/store/customers', middlewares: [closedRoutes(['/store/customers'])] },
    {
      matcher: '/auth/customer/emailpass/register',
      middlewares: [closedRoutes(['/auth/customer/emailpass/register'])],
    },
    { matcher: '/auth/token/refresh', method: 'POST', middlewares: [rejectCustomerTokens] },
    { matcher: '/auth/session', method: 'POST', middlewares: [rejectCustomerTokens] },
    {
      matcher: '/store/account/register',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreAccountRegister)],
    },
    {
      matcher: '/store/account/register-from-order',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreAccountRegisterFromOrder)],
    },
    {
      matcher: '/store/account/confirm-email',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountConfirmEmail)],
    },
    {
      matcher: '/store/account/email-confirmation',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountEmpty)],
    },
    {
      // No sign-in: an account from the checkout has no password yet; the e-mailed code is the access.
      matcher: '/store/account/set-password',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreAccountSetPassword)],
    },
    {
      matcher: '/store/account/password',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountPassword)],
    },
    {
      matcher: '/store/account/sessions/end-others',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountEmpty)],
    },
    {
      matcher: '/store/account/delete',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountDelete)],
    },
    { matcher: '/store/account/profile', method: 'GET', middlewares: [CUSTOMER_AUTH] },
    { matcher: '/store/account/cart', method: 'GET', middlewares: [CUSTOMER_AUTH] },
    {
      matcher: '/store/account/cart',
      method: 'POST',
      middlewares: [CUSTOMER_AUTH, validateAndTransformBody(StoreAccountCart)],
    },
  ],
})
