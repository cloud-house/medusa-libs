import { defineMiddlewares } from '@medusajs/framework/http'
import { storefrontOnly } from './store/newsletter-subscribers/guard'
import { validateSubscribe } from './store/newsletter-subscribers/validators'

export default defineMiddlewares({
  routes: [
    { matcher: '/store/newsletter-subscribers', method: 'GET', middlewares: [storefrontOnly] },
    {
      matcher: '/store/newsletter-subscribers',
      method: 'POST',
      middlewares: [storefrontOnly, validateSubscribe],
    },
  ],
})
