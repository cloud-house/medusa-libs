# @cloud-house/medusa-furgonetka

Medusa 2 plugin: shipping through [Furgonetka](https://furgonetka.pl) – DPD, InPost courier and InPost
parcel lockers: shipments and labels, courier pickups, tracking (webhook plus a job every 15 minutes),
the „package on its way” e-mail, alerts to the shop team, the **„Do wysyłki”** queue, **Settings ›
Wysyłka** (connection and parcel templates) and the **„Wysyłka”** card on the admin order page.

The plugin is thin on purpose: it knows Furgonetka, shipments and parcels, **not the checkout or the
catalogue**. The shop tells it what an order looks like (`resolveOrder`), what its contact data is
(`resolveContact`) and which products are bulky (`parcelClasses`, `resolveParcelClasses`).

```sh
pnpm add --save-exact @cloud-house/medusa-furgonetka
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README) and, as
peers, `@cloud-house/medusa-emails` (the two e-mails) and `@cloud-house/medusa-accounts` (the account
link and the storefront address). Run `medusa db:migrate` – the module has three tables
(`furgonetka_connection`, `parcel_template`, `shipment`).

## Setup

```ts
// medusa-config.ts
import { furgonetkaEmailTemplates } from '@cloud-house/medusa-furgonetka'

plugins: [
  {
    resolve: '@cloud-house/medusa-furgonetka',
    options: {
      resolveOrder, // (container, orderId) => Promise<ShippingOrderSource | null>
      resolveContact, // (container) => Promise<ShopContact & { replyTo? } | null>
      parcelClasses: [
        { key: 'board', label: 'Board' }, // carriers default to ['dpd']
        { key: 'lamp', label: 'Lamp', carriers: ['dpd', 'inpost_courier'] },
      ],
    },
  },
],
// the two e-mails go into the `templates` of the medusa-emails provider
// templates: [...accountEmailTemplates, ...furgonetkaEmailTemplates]
```

Do not list the `furgonetka` module in `modules` yourself: the plugin registers it, and a shop entry
would win over the plugin's `options`. `furgonetkaWarnings(process.env, 'MyShop:')` returns start-up
warnings for a bad environment setup.

## Parcel classes (bulky items)

A **parcel class** is a kind of item that does not fit a parcel locker: a board, a sofa, a long
lamp. Every piece of a classed item gets **its own carton** (the template whose *purpose* is the class
key), the items without a class share one accessories carton, and only the carriers a class lists
take it (default: DPD only – the order is then blocked for the InPost courier and lockers).

* `parcelClasses` – the classes, in the order their cartons are planned. Keys: `[a-z0-9_]{1,40}`, not
  `accessories_locker` / `accessories_courier`, no repeats; at least one class.
* `resolveParcelClasses(container, productIds)` – product id → class key. **Default:** the key in
  `product.metadata.parcel_class` (set it in the admin „Metadata” section). A shop that keeps the flag
  elsewhere (its own table, a category tree) passes its own function. A key that is not declared in
  `parcelClasses` is ignored (the product counts as ordinary) and logged once.
* Parcel templates (Settings › Wysyłka) have a *purpose*: a class key or one of the two accessories
  purposes. Each purpose has exactly one template; seed them with `ensureParcelTemplates(container,
  templates)` (creates them only when the table is empty).

The plugin exports `parcelClassesOf(container, productIds)` so the shop's checkout (parcel locker,
InPost courier) can ask the same question.

## Environment

| Variable | Meaning |
|---|---|
| `FURGONETKA_URL` | API address (`https://api.furgonetka.pl`, the sandbox `https://api.sandbox.furgonetka.pl`). Not set: the shop ships by hand. `atrapa` selects the in-process fake (development and tests; ignored in production). |
| `FURGONETKA_CLIENT_ID`, `FURGONETKA_CLIENT_SECRET` | OAuth application of the shop (required with a real `FURGONETKA_URL`). |
| `FURGONETKA_WEBHOOK_TOKEN` | Salt of the webhook control sum; without it `POST /hooks/furgonetka` answers 404 and only the job reads the statuses. |
| `FURGONETKA_PICKUP_HOURS`, `FURGONETKA_PICKUP_TODAY_UNTIL` | Default pickup window `HH:MM-HH:MM` and the hour until which the default pickup is today. |
| `MEDUSA_ADMIN_URL`, `STOREFRONT_URL`, `EMAIL_REPLY_TO` | The OAuth return address, links in the e-mails and the reply-to. |

## Options

| Option | Default | |
|---|---|---|
| `resolveOrder` | – (required) | `ShippingOrderSource`: id, `displayId`, `email`, `customerName`, `shopOrder`, `paid`, `canceled`, `hasAccount`, `deliveryCode`, `lockerCode`/`lockerLabel`, `address`, `items` (`id`, `title`, `variant`, `quantity`, `productId`), `itemsTotalCents`, `fulfillments` |
| `parcelClasses` | – (required) | see above |
| `resolveParcelClasses` | `metadata.parcel_class` | see above |
| `resolveContact` | none | contact for the e-mails and alerts (may resolve to `null` or throw – the e-mail then goes without contact data) |
| `deliveryCodes` | `{ inpostCourier: 'kurier-inpost', inpostLocker: 'paczkomat-inpost' }` | `shipping_option_type.code` of the InPost delivery options; any other code means DPD |
| `senderName` | `Shop` | the sender's name when the warehouse address has no company |
| `stockLocationName` | the first location with an address | the warehouse the parcels leave from (address and phone needed) |
| `logPrefix` | `[Furgonetka]` | prefix of the log lines |
| `accountOrderPath` | `/account/orders/:id` | the order in the customer account (must contain `:id`) |

## Routes and job

`GET|POST /admin/furgonetka*` (connection, OAuth callback), `/admin/parcel-templates*`,
`/admin/shipping/{queue,shipments,labels,pickups}`, `/admin/orders/:id/shipment*` (the card),
`/admin/shipments/:id/{cancel,label,pickup,simulate}`, `POST /hooks/furgonetka` (public, checks the
control sum), the job `sync-shipments` (`*/15 * * * *`), subscribers `shipment.created` (the e-mail) and
`order.fulfillment_canceled` (cancels the package). `simulate` works only with the fake.

## Migrations

Three tables in one migration, plus `Migration20261125090000`, which drops the `check` that limited
`parcel_template.purpose` to four fixed values (the purpose is now a parcel class key). Existing rows
are not touched; the migration is safe to run on a shop that already uses the four old values.

## Not in the plugin

The checkout (delivery options, prices, the locker widget, customer-facing „boards go by DPD only”
texts), the shop's default parcel templates and their dimensions, the order view with the delivery
review, and the seed of the delivery options stay in the shop.

## License

MIT
