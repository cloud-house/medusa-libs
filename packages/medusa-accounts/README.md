# @cloud-house/medusa-accounts

Medusa 2 plugin: customer accounts (registration, e-mail confirmation, password reset, checkout
sign-up, account deletion): workflows, event subscribers, the three account e-mails, options,
dictionaries, error codes, the account helpers and the `/store/account/*` routes with their
middlewares.

```sh
pnpm add --save-exact @cloud-house/medusa-accounts
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README) and
`@cloud-house/medusa-emails` for the e-mails.

## Setup

```ts
// medusa-config.ts
import { accountEmailTemplates } from '@cloud-house/medusa-accounts'
import { emailEnv, type EmailsOptions } from '@cloud-house/medusa-emails'

// medusa-emails is a Notification provider (not a plugin): the three account e-mails go into its
// `templates` next to the shop's own.
const emails: EmailsOptions = {
  channels: ['email'],
  ...emailEnv(process.env),
  theme: { shopName: 'Acme' },
  templates: [...accountEmailTemplates /*, the shop's templates */],
}

plugins: [
  {
    resolve: '@cloud-house/medusa-accounts',
    options: { paths: { confirmEmail: '/…', passwordReset: '/…', setPassword: '/…' } /* see below */ },
  },
],
modules: [
  {
    resolve: '@medusajs/medusa/notification',
    options: {
      providers: [
        { resolve: '@cloud-house/medusa-emails/providers/resend', id: 'resend', options: emails },
      ],
    },
  },
],
```

Do not list the `accounts` module in `modules` yourself: the plugin registers it, and a shop entry
would win over the plugin's `options`.

## Options

```ts
import { resolveOptions, type AccountsOptions } from '@cloud-house/medusa-accounts'

const options: AccountsOptions = {
  paths: {
    confirmEmail: '/account/confirm-email', // required, no defaults
    passwordReset: '/account/reset-password',
    setPassword: '/account/set-password',
  },
  storefrontUrl: 'https://shop.example', // default process.env.STOREFRONT_URL; trailing `/` stripped
  locale: 'pl', // 'pl' | 'en', default 'pl'
  messages: { linkExpired: 'Link expired.' }, // single texts over the dictionary
  resolveContact: async (container) => null, // ContactResolver from medusa-emails
  onAccountDeleted: [async (container, customerId) => {}],
  emailThrottle: { max: 3, windowMs: 15 * 60 * 1000 }, // the defaults
  deletedEmail: (customerId) => `deleted+${customerId}@account-deleted.invalid`, // the default
  createAccountFlag: { key: 'create_account', value: 'true' }, // the default, see below
}
```

`deletedEmail` is the e-mail stored over an erased account (the row stays after Medusa's soft delete).
A shop that already has erased accounts in its own format passes that format here, so old and new
rows stay identical (e.g. `(id) => \`usuniete+${id}@shop.invalid\``).

`createAccountFlag` is the order metadata entry the checkout sets when the customer ticks „create an
account” (`createAccountFromCheckoutWorkflow` reads it on `order.placed`). A shop whose checkout
writes another contract passes its own, e.g. `{ key: 'create_account', value: 'yes' }`; both parts
must be non-empty strings.

`resolveOptions` treats `undefined` values as unset and throws when a `paths` entry is missing or
`locale` is unknown.

## Messages and error codes

`messages.pl` / `messages.en` hold the API error texts (`duplicateAccount`, `linkExpired`,
`tooManyRequests`, `wrongCurrentPassword`, `wrongPassword`, `signInAgain`, `tokenIssuedAtMissing`,
`orderNotFound`, `cartNotFound`, `invoiceNotFound`, `sessionExpired`, `notFound`,
`metadataUnavailable`). `ACCOUNT_ERROR_CODES` has the matching stable `account_*` codes.

## Helpers

`accountIdentityId`, `customerOfIdentity`, `isEmailConfirmed`, `registeredCustomerByEmail`,
`updateAccountMetadata`, `passwordMatches`, `markEmailConfirmed`, `reopenAuthVerification`, and
`tooManyAccountEmails(container, email, kind, throttle?)`.

## How the options reach subscribers and workflows

Medusa passes plugin `options` only to modules. The plugin therefore registers a tiny module,
`accounts` (`ACCOUNTS_MODULE`), whose service holds the resolved options; subscribers, workflow steps
and routes read them with `accountsOptions(container)`. The module has **no data models and no
migrations** – installing the plugin adds no table to the shop's database.

## Workflows

All run on the shop's own Medusa container; error texts come from the dictionary (`messages`):

| Workflow | What it does |
| --- | --- |
| `registerCustomerWorkflow` | e-mail + password identity, customer, confirmation e-mail request (one transaction) |
| `registerFromOrderWorkflow` | turns a guest order into an account (only for the cart that placed it) |
| `requestEmailConfirmationWorkflow` | a fresh confirmation link; nothing for an already confirmed e-mail |
| `createAccountFromCheckoutWorkflow` | the checkout's „create an account” checkbox: account without a password and a „set password” link |
| `assignPlacedOrderWorkflow` | who owns a freshly placed order: the account or a guest |
| `linkGuestOrdersWorkflow` | after the e-mail confirmation the guest orders with that e-mail join the account |
| `deleteAccountWorkflow` | erases the personal data, then Medusa's soft delete; see `onAccountDeleted` |

`eraseCustomerDataStep` erases addresses, personal fields, open carts and the auth identity, and
awaits every `options.onAccountDeleted` callback in order (e.g. clean up the customer's favourites).
A callback that throws **aborts the deletion** and the error reaches the caller; the data already
erased is **not** restored (a half-deleted account is better than restored data).

`ACCOUNT_CART_FLAG` (cart metadata) and `LAST_CART` (customer metadata) are exported for the cart
route and the checkout.

## Subscribers

| Event | Does |
| --- | --- |
| `auth.verification_requested` | sends „confirm your e-mail” (or „set password” for an account from the checkout); idempotency key `<template>:<hash of the code>` |
| `auth.password_reset` | sends the reset link to an existing customer account only; throttled by `emailThrottle`; idempotency key `password-reset:<jti>` |
| `order.placed` | `assignPlacedOrderWorkflow`, then `createAccountFromCheckoutWorkflow`; failures are logged and never touch the order |

The e-mails go through `sendEmailWorkflow` of `@cloud-house/medusa-emails`. Links are
`options.storefrontUrl` + `options.paths.*` (`?kod=` for confirmation and set password, `?token=` for
the reset). Reply-To is `process.env.EMAIL_REPLY_TO`, else the e-mail from `resolveContact`; without
`resolveContact` the contact block is empty. Without `storefrontUrl` / `STOREFRONT_URL` links point
to `http://localhost:3200`.

## E-mail templates

`accountEmailTemplates` – `email-confirmation`, `password-reset`, `set-password`; they read the shop
name (and its locative, used in the subjects) from the `medusa-emails` theme. Their texts are Polish.
`accountEmailData(container, options, logger, { email, firstName, path, orderNumber? })` builds the
data (link, contact, seller, Reply-To) a template needs.

## Routes

All under `/store/account` (a publishable API key is needed like on every store route). Errors from
the routes themselves are `{ type, message }` with the dictionary text; errors thrown by the
workflows (e.g. duplicate account, unknown order) carry the stable `code` too.

| Method and path | Auth | Body | Answers |
| --- | --- | --- | --- |
| `POST /register` | none | `email`, `password` (8-128), `first_name`, `last_name`, `phone` | `201 { customer: { id, email } }`; `422` duplicate account; `400` validation |
| `POST /register-from-order` | none | `order_id`, `cart_id`, `password` | `201 { customer: { id, email } }`; `404` order not found (the cart must be the one that placed it); `422` the e-mail already has an account |
| `POST /confirm-email` | customer | `code` | `200 { linked }` (guest orders moved in); `400` expired, used or not this account's code |
| `POST /email-confirmation` | customer | `{}` | `201 { sent: true }`; `200 { sent: false, confirmed: true }`; `429` throttled |
| `POST /set-password` | none (the e-mailed code is the access) | `code`, `password` | `200 { email, linked }`; `400` expired, used, or not an account waiting for a password |
| `POST /password` | customer | `current_password`, `new_password` | `200 { success: true }`, every older session ends; `400` wrong current password |
| `POST /sessions/end-others` | customer | `{}` | `200 { success: true }`: tokens older than this one stop working; `400` token without `iat` |
| `GET /profile` | customer | | `200 { customer: { id, email, first_name, last_name, phone, email_confirmed } }`; `401` |
| `POST /cart` | customer | `cart_id` | `200 { cart_id }` the open cart now belongs to the customer (`ACCOUNT_CART_FLAG`, `LAST_CART`); `404` |
| `GET /cart` | customer | | `200 { cart_id }` the customer's last open cart, or `null` |
| `POST /delete` | customer | `password` | `200 { deleted: true }`; `400` wrong password; see `onAccountDeleted` |

„customer” is Medusa's `authenticate('customer', ['session', 'bearer'])`. Bodies are strict
(`400` on unknown fields); e-mails are trimmed and lower-cased, so ` Jan@Example.PL ` and
`jan@example.pl` are the same account and the same throttle counter.

`ownOrder(req)` (exported) returns `{ id, display_id }` of the order `req.params.id` when it belongs
to the signed-in customer (never a draft order), else `null`. A shop's own `/store/account/orders/:id`
routes use it for their 404.

## Middlewares

`src/api/middlewares.ts` of the plugin registers, with the same matchers and order the routes need:

- `sessionGuard` on `/store/customers/me*`, `/store/orders*`, `/store/account*` and
  `/store/carts/:id/customer`: a token older than the customer's `sessions_valid_from` (set by a
  password change or `end-others`) gets `401 sessionExpired`; a deleted account's token too;
- `rejectCustomerMetadata` on `/store/customers` (`POST /store/customers` and `/me` with `metadata`
  is `400`: the plugin keeps account state there);
- `verificationDisabled` on `/auth/verification/*` and `closedRoutes` on Medusa's own customer
  registration (`POST /store/customers`, `POST /auth/customer/emailpass/register`): `404`; the
  e-mail confirmation goes only through `/store/account/*`;
- `rejectCustomerTokens` on `POST /auth/token/refresh` and `POST /auth/session`: a customer token is
  never refreshed or exchanged for a session (it would dodge `sessions_valid_from`);
- the `authenticate` and body validators of the routes above.

Medusa merges the middlewares of all plugins with the shop's own `src/api/middlewares.ts` and sorts
them by specificity, not by file, so the plugin's `/store/account*` session guard also applies to
routes the **shop** adds under `/store/account/*` (e.g. its orders). The shop still lists its own
`authenticate(...)` for those routes. `closedRoutes(paths)` and `routedPath(req)` are exported
for the shop's own guards (`closedRoutes(['/store/returns'])`).

## Test-shop

`apps/test-shop` of this repo runs the routes end to end (`pnpm --filter test-shop test:integration:http -- account`).
