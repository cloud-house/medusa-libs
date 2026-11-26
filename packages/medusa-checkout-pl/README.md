# @cloud-house/medusa-checkout-pl

Polish checkout backend for Medusa 2: Stripe (card, BLIK, Przelewy24) configuration, shipping rates and delivery options, the parcel locker rule from parcel classes, the last check before the payment, the order view for the confirmation page, the delivery review flag and the order confirmation e-mail. No tables and no migrations – the module only holds the options.

```sh
pnpm add @cloud-house/medusa-checkout-pl
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`. Peers: `@medusajs/framework` and `@medusajs/medusa` `~2.21.2`, `@cloud-house/medusa-furgonetka`, `@cloud-house/medusa-accounts`, `@cloud-house/medusa-emails`.

## Setup

```ts
// medusa-config.ts
import { checkoutEmailTemplates } from '@cloud-house/medusa-checkout-pl'
import { paymentModules } from '@cloud-house/medusa-checkout-pl/payments'

export default defineConfig({
  modules: [
    ...paymentModules(process.env), // Stripe only when STRIPE_API_KEY is set
    {
      resolve: '@medusajs/medusa/notification',
      options: { providers: [{ resolve: '@cloud-house/medusa-emails/providers/resend', id: 'resend',
        options: { channels: ['email'], templates: [...checkoutEmailTemplates /* , … */] } }] },
    },
  ],
  plugins: [
    { resolve: '@cloud-house/medusa-checkout-pl', options: { resolveContact } },
  ],
})
```

`resolveContact(container)` returns `{ email, phone, hours, seller }` (any may be `null`) or `null`.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `resolveContact` | – (required) | contact data of the e-mail footer |
| `variantLabels(container, variantIds)` | none | variant id → label shown in the e-mail (default: the variant title) |
| `groupLines(items)` | every line alone | groups order lines (`{ line, upgrades }`) in the e-mail |
| `deliveryCodes` | `kurier-inpost`, `paczkomat-inpost`, `kurier-dpd` | `shipping_option_type.code` of the InPost courier, the locker and the courier bulky items go by |
| `deliveryOrder` | InPost courier, courier, locker | order of the options at checkout |
| `blockReasons.locker` / `.inpostCourier` | „`<product>` nie mieści się w paczkomacie.” / „… wysyłamy tylko kurierem DPD.” | customer-facing reason a method is closed |
| `texts` | Polish | `lockerBlocked`, `lockerMissing`, `courierBlocked` of the checkout check |
| `deliveryReviewNotes` | Polish | notes of the order e-mail for a reviewed delivery (`board_to_parcel_locker`, `bulky_with_inpost_courier`); the storefront's confirmation page has its own copy |
| `currency` | `pln` | currency of the shop's region |
| `storefrontUrlEnv`, `replyToEnv` | `STOREFRONT_URL`, `EMAIL_REPLY_TO` | env variables of the e-mail |
| `logPrefix` | `[Checkout]` | prefix of the log lines |

Errors at start-up: `checkout_pl_missing_option`, `checkout_pl_invalid_option`.

## What it adds

- `GET /store/shipping-rates`, `GET /store/carts/:id/delivery-options`, `POST /store/carts/:id/checkout-check` (always 200: `{ ok: true }` or `{ ok: false, field: 'delivery' | 'items', message }`), `GET /store/checkout/orders/:id?cart_id=` (the full order only with the cart it came from, otherwise `{ id, display_id }`), and a guard on `GET /store/orders/:id` (a guest order stays private).
- Workflow hooks: `addShippingMethodToCartWorkflow` (a bulky item cannot go to a locker or the InPost courier; the locker may be saved before the point is picked) and a stock check on adding, changing and completing a cart (no backorders).
- Subscribers on `order.placed`: the confirmation e-mail (`order-placed`, idempotency key `order-placed:<id>`) and the `metadata.delivery_review` flag.

## The parcel rule

Every product with a parcel class (declared in `medusa-furgonetka`, `parcelClasses`) is „bulky”: it closes the InPost courier and the parcel locker. Without `medusa-furgonetka` registered nothing is bulky.

## Metadata conventions

Written by the storefront checkout, read here: `order.metadata.nip`, `customer_note`, `create_account` (`'tak'`), `delivery_review`; the delivery method's `data.parcel_locker` and `data.parcel_locker_label`; line `metadata.upgrade_of` and `replaces` (used by `groupLines`/the e-mail).

## Exports

Root: options and module (`CHECKOUT_PL_MODULE`), `checkoutEmailTemplates`, `orderPlacedData` (demo data for previews), `toOrderPlacedEmailData`, `loadOrderPlacedEmail`, `loadOrderSummary`, `saleAmounts`, `paidTotal`, `PAID_STATUSES`, `listShippingRates`, `adjustmentCodes`. `@cloud-house/medusa-checkout-pl/payments`: `paymentModules(env, { asyncPaymentMethodTypes })` (default `['blik', 'p24']`, `[]` for the EU), `regionPaymentProviders` – this entry has no Medusa imports. The root entry loads `@medusajs/medusa/core-flows` (order summary and the furgonetka plugin), which is fine in `medusa-config.ts` but not free: import `/payments` when only the payment config is needed.
