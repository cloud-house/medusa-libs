# @cloud-house/next-commerce

Storefront logic for a Next.js 16 shop on Medusa 2 in Poland – part 1: cart, checkout, newsletter. Pure functions and flows, no React components and no server actions: the shop calls them from its own thin `'use server'` files (server actions inside `node_modules` are a risk in Next 16).

```sh
pnpm add @cloud-house/next-commerce @medusajs/js-sdk
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`. Peers: `@medusajs/types` (`~2.21.2`), `@stripe/stripe-js` (optional, for the Stripe adapter). Backend counterparts: `@cloud-house/medusa-checkout-pl` (delivery options, checkout check, order view), `@cloud-house/medusa-newsletter`.

## `@cloud-house/next-commerce/cart`

- `CartClient` (the `client.fetch` of the JS SDK), `CART_FIELDS`, `retrieveCart` (a missing or completed cart is `null`).
- `addToCartFlow(client, { cartId, regionId, items, addItems? })` – creates a cart when there is none or it went stale (404, closed) and retries once; returns the cart id for the cookie. `addItems` defaults to `addLineItems` (`POST /store/carts/:id/line-items` per item); a shop may pass a route that adds all items or none.
- `updateItem`, `removeItems`, `applyCodeFlow` (retries an upper-case code, checks the code really applied, re-saves the delivery), `removePromotionCode`, `saveShippingMethod`, `refreshShippingMethod`, `cartErrorMessage` (Polish messages for the customer), `validateQuantity`, `validateLineId`, `validateLineQuantity`.
- `toCartView(cart, { freeShippingThreshold, variants?, groupLines?, href?, hiddenSize? })` – lines (bundle and code discounts apart), codes, totals, free-shipping progress. `toLineView`, `groupLines`, `variantLabel`.

| View option | Default | Meaning |
| --- | --- | --- |
| `groupLines(items)` | every line alone | `{ line, upgrades }` groups (e.g. upgrades under their board) |
| `href(handle, { color, size })` | `/products/<handle>` | link of a line |
| `hiddenSize` | none | a size value never shown (e.g. `Standard`) |

## `@cloud-house/next-commerce/checkout`

- Form: `CheckoutForm`, `emptyCheckoutForm`, `validateCheckout` (Polish postal code and phone, NIP and company for an invoice, billing address, parcel locker with a mobile number, terms, customer note), `parseCheckoutForm` (anything from the browser → form or `null`), `toCartUpdate`, `formFromCart`, `prefillFromAccount`.
- Flow: `submitCheckoutFlow(client, cart, form, now, { subscribeNewsletter?, signedIn?, logPrefix? })` – form → cart details → delivery → `checkout-check` → Stripe payment session; `placeOrderFlow`.
- Medusa calls: `CHECKOUT_FIELDS`, `retrieveCheckoutCart`, `fetchDeliveryOptions`, `setShippingMethod`, `runCheckoutCheck`, `fetchPaymentProviders`, `paymentAvailability`, `createPaymentSession`, `completeCart`, `fetchOrderSummary`, `fetchOrderPage`.
- `toOrderView(order, variants, viewOptions?)`, `createStripePayments(...)`, `resolvePaymentReturn(...)`.

Cart metadata written by `toCartUpdate` (read by `medusa-checkout-pl`): `nip`, `customer_note`, `create_account`, `terms_accepted_at`; the delivery method keeps `parcel_locker` and `parcel_locker_label`.

## `@cloud-house/next-commerce/newsletter`

- `subscribe(form, ip, deps)` – honeypot and repeated sign-ups end with the same thanks; rate limit; consent required; the consent text is stored with the sign-up.
- `createNewsletterDeps({ fetch, secretHeader, secret, provider, allow, consentText, logPrefix? })` – deps for `/store/newsletter-subscribers` of `medusa-newsletter`.
- `resendNewsletterProvider(env, client?, logPrefix?)` (`NEWSLETTER_API_KEY`, `NEWSLETTER_AUDIENCE_ID`), `fakeNewsletterProvider()`, `normalizeEmail`, `redactedError` (no e-mail addresses in logs), `NEWSLETTER_MESSAGES`.

## Example: a thin server action in the shop

```ts
'use server'
import { addToCartFlow, cartErrorMessage } from '@cloud-house/next-commerce/cart'

export async function addToCart(input: { variantId: string; quantity: number }) {
  try {
    const { cartId } = await addToCartFlow(cartClient(), {
      cartId: await getCartId(),
      regionId,
      items: [{ variant_id: input.variantId, quantity: input.quantity }],
    })
    await setCartId(cartId)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: cartErrorMessage(error) }
  }
}
```
