# @cloud-house/next-commerce

Storefront logic for a Next.js 16 shop on Medusa 2 in Poland: cart, checkout, newsletter, customer account, favourites, returns. Pure functions and flows, no React components and no server actions: the shop calls them from its own thin `'use server'` files (server actions inside `node_modules` are a risk in Next 16).

```sh
pnpm add @cloud-house/next-commerce @medusajs/js-sdk
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`. Peers: `@medusajs/types` (`~2.21.2`), `@stripe/stripe-js` (optional, for the Stripe adapter). Backend counterparts: `@cloud-house/medusa-checkout-pl` (delivery options, checkout check, order view), `@cloud-house/medusa-newsletter`, `@cloud-house/medusa-accounts`, `@cloud-house/medusa-favorites`, `@cloud-house/medusa-returns`, `@cloud-house/medusa-fakturownia` (see [Routes](#routes-the-entries-call)).

## `@cloud-house/next-commerce/cart`

- `CartClient` (the `client.fetch` of the JS SDK), `CART_FIELDS`, `retrieveCart` (a missing or completed cart is `null`).
- `addToCartFlow(client, { cartId, regionId, items, addItems? })` – creates a cart when there is none or it went stale (404, Medusa's 400 "already completed", or the Polish "Ten koszyk jest już zamknięty.") and retries once; any other error (e.g. not enough stock) is thrown without a new cart. Returns the cart id for the cookie. `addItems` defaults to `addLineItems` (`POST /store/carts/:id/line-items` per item – **not atomic**: when item N fails, items 1..N-1 stay in the cart); a shop that adds groups (a product with its add-ons) should pass a route that adds all items or none.
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

## `@cloud-house/next-commerce/account`

All calls take an `AccountClient` (`getSdk().client`) and, when signed in, the customer token; a 401 on an account route throws `SessionExpiredError` (`withToken`).

- Sign-in and registration: `login`, `register`, `registerFromOrder`, `setPasswordFromLink`, `requestPasswordReset`, `setNewPassword`, `resendConfirmation`, `confirmEmail`.
- Account: `profile`, `updateProfile`, `changePassword`, `endOtherSessions`, `deleteAccount`, `orders`, `order`, `invoicePdf`, `addresses`, `saveAddress`, `deleteAddress`, `toSavedAddress`, `attachCart`, `lastCart`.
- Forms (Polish messages in `ACCOUNT_MESSAGES`): `validateRegistration`, `validateAddressForm`, `validateProfileForm`, `passwordError`, `AccountFormState`.
- `addressesToSave(order, existing)` – „save my details” after an order; `syncCart(deps)` – the browser's cart joins the account on sign-in, otherwise the account's last open cart returns; `safeReturnPath(value, fallback = '/konto')` – only a path of this shop for `?powrot=`.

## `@cloud-house/next-commerce/favorites`

- Guest list in `localStorage`: `readLocalFavorites(storage, now?, key?)`, `writeLocalFavorites(storage, list, key?)` (default key `ulubione` – `DEFAULT_LOCAL_FAVORITES_KEY`; pass your shop's own key), `sanitizeFavorites`, `parseLocalFavorites`, `toggleLocal` (limit `FAVORITES_LIMIT` from `commerce-rules`).
- `syncFavoritesFlow(deps, local)` – on page start and session change: merge into the account, the account list, or (guest or expired session) the guest list without withdrawn products.
- Medusa calls: `accountFavorites`, `addAccountFavorite`, `removeAccountFavorite`, `mergeAccountFavorites`, `visibleProducts`; `FAVORITES_MESSAGES`, `FavoritesActions`.

## `@cloud-house/next-commerce/returns`

- Forms: `parseLookupForm(form, orderPrefix?)`, `orderNumber(value, orderPrefix?)` – „1001”, „#1001” and, with your order prefix (e.g. `ACME`, as `referencePrefix` of `medusa-furgonetka`), „ACME-1001”; `parseReturnForm(form, items)`, `checkReturnFormLocally(form)`, `RETURN_FORM_MESSAGES`.
- Label page: `labelOrderNumber(param)`, `labelHref(displayId)` → `/zwrot/etykieta?zamowienie=N`.
- Medusa calls: `lookupGuestOrder`, `claimGuestReturn`, `claimAccountReturn`.

## Routes the entries call

| Route | Provided by |
| --- | --- |
| `/auth/customer/emailpass*`, `/store/customers/me*` | Medusa core |
| `/store/account/{register,register-from-order,set-password,profile,password,sessions/end-others,delete,email-confirmation,confirm-email,cart}` | `medusa-accounts` |
| `/store/account/favorites*` | `medusa-favorites` |
| `/store/returns/{lookup,claim}`, `/store/account/orders/:id/return` | `medusa-returns` |
| `/store/account/orders/:id/invoice` | `medusa-fakturownia` |
| `GET /store/account/orders`, `GET /store/account/orders/:id`, `POST /store/catalog/visible` | **the shop's backend** (no kit plugin yet; response types `AccountOrdersResponse`, `AccountOrderResponse`, `VisibleProductsResponse` in `commerce-rules`) |

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
