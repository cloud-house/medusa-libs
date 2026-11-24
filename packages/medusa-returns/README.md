# @cloud-house/medusa-returns

Medusa 2 plugin: customer returns – a guest or a signed-in customer reports a return, the plugin
checks the window (from delivery), the quantities and the reasons, creates Medusa's own return and
sends two e-mails (a confirmation to the customer, an alert to the shop).

The plugin is thin on purpose: returns are Medusa's returns (no tables, no migrations), and the
plugin knows **not the shop's catalogue or CMS**. The shop tells it what an order looks like
(`resolveOrder`) and what its contact data and return rules are (`resolveContact`).

```sh
pnpm add --save-exact @cloud-house/medusa-returns
```

Requires `@cloud-house/commerce-rules` (installed with it), and as peers `@cloud-house/medusa-emails`
(the two e-mails) and `@cloud-house/medusa-accounts` (the customer's own order, closed routes).
`.npmrc`: `@cloud-house:registry=https://npm.pkg.github.com` (see the repo README).

## Setup

```ts
// medusa-config.ts
import { returnEmailTemplates } from '@cloud-house/medusa-returns'

plugins: [
  {
    resolve: '@cloud-house/medusa-returns',
    options: {
      resolveOrder, // (container, orderId) => Promise<ReturnOrder | null>
      resolveContact, // (container) => Promise<ReturnContact | null>
      labelPath: '/zwrot/etykieta?zamowienie=:displayId',
      accountOrderPath: '/konto/zamowienia/:id',
    },
  },
],
// the two e-mails go into the `templates` of the medusa-emails provider
// templates: [...accountEmailTemplates, ...returnEmailTemplates]
```

Do not list the `shopReturns` module in `modules` yourself: the plugin registers it (it only holds
the options).

## Return shipping option and reasons

Every return is created with a shipping option whose **type code is `zwrot-wlasny`**
(`RETURN_OPTION_CODE`), priced 0, in the shipping set connected to a stock location (the stock
location is where returns are received). The plugin does not create it – names of the shipping
set, region and provider are the shop's. Without it a claim fails with `returns_no_return_option`.

The reasons (`size`, `color`, `not_as_described`, `defect`, `mind_changed`) are Medusa return
reasons: call `ensureReturnReasons(container)` from the shop's seed or a migration script (it creates
only the missing ones). Without them a claim fails with `returns_no_return_reason`.

## Routes

| Route | Who | |
|---|---|---|
| `POST /store/returns/lookup` | guest | order number + e-mail → what may be returned (`ReturnInfo`) |
| `POST /store/returns/claim` | guest | creates the return; wrong number and wrong e-mail give the same 404 |
| `POST /store/account/orders/:id/return` | signed-in customer | creates the return of their own order |

Medusa's own `POST /store/returns` is closed (it skips the window and the quantities). Errors are
`{ type: 'not_allowed' | 'not_found' | 'conflict', message }` with a Polish `message`; one claim per
order at a time (a lock), a second concurrent claim gets 409.

## Options

| Option | Default | |
|---|---|---|
| `resolveOrder` | – (required) | `ReturnOrder`: `id`, `displayId`, `email`, `shopOrder` (placed in the shop, not a draft), `canceled`, `items` (`quantities`: quantity / shipped / requested / received / dismissed), `fulfillments` (shipped / delivered / canceled dates), `returns` |
| `resolveContact` | – (required) | `ReturnContact`: `email`, `phone`, `hours`, `seller`, `returnDays` (window, default 30), `returnAddress` (lines), `replyTo?`; may resolve to `null` or throw (30 days, e-mail without contact data) |
| `labelPath` | `/returns/label?order=:displayId` | the printable label page in the storefront |
| `accountOrderPath` | `/account/orders/:id` | the order in the customer account (must contain `:id`) |
| `logPrefix` | `[Returns]` | prefix of the log lines |

Environment: `STOREFRONT_URL` (links in the e-mails), `EMAIL_REPLY_TO` (reply-to; else the contact's
`replyTo`, else its e-mail), `MEDUSA_ADMIN_URL` (link in the shop's alert).

## Advanced API

`claimReturn`, `findGuestOrder`, `loadReturn`, `loadReturnPolicy`, `toReturnInfo`, `toAccountReturn`,
`quantitiesOf`, `ensureReturnReasons`, `ReturnClaimError`, `sendReturnEmailsWorkflow` – for the
shop's own account routes (e.g. the order view with its returns) and for integration tests.

## License

MIT
