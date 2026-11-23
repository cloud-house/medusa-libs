# @cloud-house/medusa-fakturownia

Medusa 2 plugin: invoices and credit notes through [Fakturownia](https://fakturownia.pl) – the
invoice of a paid order, the credit note of a received return, KSeF, the e-mail with the PDF, a
retry job, alerts to the shop team, the `/admin/orders/:id/invoice*` routes, the customer's PDF
download and the „Faktura” card on the admin order page.

The plugin is thin on purpose: it knows Fakturownia, KSeF and the invoice states, **not the
checkout**. The shop tells it what an order and a return look like (`resolveOrder`,
`resolveReturnOrder`, `resolveReturn`), so amounts are computed in one place – the shop's.

```sh
pnpm add --save-exact @cloud-house/medusa-fakturownia
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README) and, as
peers, `@cloud-house/medusa-emails` (the two e-mails) and `@cloud-house/medusa-accounts` (the PDF
route of the customer's own order).

## Setup

```ts
// medusa-config.ts
import { invoiceEmailTemplates } from '@cloud-house/medusa-fakturownia'

plugins: [
  {
    resolve: '@cloud-house/medusa-fakturownia',
    options: {
      resolveOrder, // (container, orderId) => Promise<InvoiceOrder | null>
      resolveReturnOrder, // (container, orderId) => Promise<ReturnOrder | null>
      resolveReturn, // (container, returnId) => Promise<ReturnRow | null>
    },
  },
],
// the two e-mails go into the `templates` of the medusa-emails provider
// templates: [...accountEmailTemplates, ...invoiceEmailTemplates]
```

Do not list the `fakturownia` module in `modules` yourself: the plugin registers it, and a shop
entry would win over the plugin's `options`. Run `medusa db:migrate` – the module has two tables
(`invoice`, `invoice_correction`).

## Environment

| Variable | Meaning |
|---|---|
| `FAKTUROWNIA_URL` | Account address, e.g. `https://myshop.fakturownia.pl`. Not set: the shop issues no invoices. `atrapa` selects the in-process fake (development and tests; ignored in production). |
| `FAKTUROWNIA_API_TOKEN` | API token (required with a real `FAKTUROWNIA_URL`). |
| `FAKTUROWNIA_DEPARTMENT_ID` | Seller department of the invoices. |
| `FAKTUROWNIA_KSEF` | `off` (default), `companies` or `all` – which invoices the shop sends to KSeF itself. |
| `FAKTUROWNIA_OID_PREFIX` | Order number prefix; wins over the `oidPrefix` option. |
| `STOREFRONT_URL`, `EMAIL_REPLY_TO`, `MEDUSA_ADMIN_URL` | Links and reply-to of the e-mails. |

`fakturowniaWarnings(process.env, logPrefix)` returns start-up warnings for a bad setup.

## Options

| Option | Default | |
|---|---|---|
| `resolveOrder`, `resolveReturnOrder`, `resolveReturn` | – (required) | What the shop's orders and returns look like (types `InvoiceOrder`, `ReturnOrder`, `ReturnRow`). Missing: the plugin refuses to start (`fakturownia_missing_option`). |
| `resolveContact` | none | Shop contact and seller line for the e-mails (`ShopContact` + optional `replyTo`). |
| `paymentTypes` | `{}` | Payment provider id → Fakturownia payment type (`card`, `BLIK`, …); others become `transfer`. |
| `oidPrefix` | `INV-` | Prefix of the Fakturownia order number. |
| `logPrefix` | `[Fakturownia]` | Prefix of the log lines. |
| `accountOrderPath` | `/account/orders/:id` | Path of an order in the customer account (link in the e-mail). |

## What it does

- `order.placed` and `payment.captured` create the invoice row; a paid shop order gets its invoice,
  then KSeF (when the mode asks for it), then the e-mail with the PDF. A job (`process-invoices`,
  every 15 minutes) retries what failed and alerts the shop's contact address once per problem.
- `order.return_received` creates the credit note of the return (`resolveReturn*`) – only for an order whose `resolveOrder` result has `shopOrder: true`, the same rule as for its invoice.
- Admin: `GET /admin/orders/:id/invoice` (the card), `POST …/issue`, `…/recheck`, `…/email`,
  `GET …/pdf`. Customer: `GET /store/account/orders/:id/invoice` (PDF of the own order).
- The shop reads the account's invoice state with `accountInvoice(row)` / `invoiceEnabled(env)`.
- The invoice texts (e-mails, admin card, Fakturownia positions) are Polish; there is no
  dictionary option yet.

## Advanced API

For the shop's own integration tests and scripts the package root also exports one pass of each
pipeline: `processInvoice`, `ensureInvoiceRow`, `recheckInvoice`, `resendInvoiceEmail`,
`invoicePdf`, `sweepInvoices`, `ensureCorrectionRow`, `processCorrection`, `sweepCorrections`,
`payloadTotalCents`, `correctionTotalCents`, and the in-process fake (`fakeFakturownia`,
`createFakeClient`). They may change in a minor release.
