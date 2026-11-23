# @cloud-house/medusa-accounts

Medusa 2 plugin: customer accounts (registration, e-mail confirmation, password reset, checkout
sign-up, account deletion): workflows, event subscribers, the three account e-mails, options,
dictionaries, error codes and the account helpers. Account routes follow.

```sh
pnpm add --save-exact @cloud-house/medusa-accounts
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README) and
`@cloud-house/medusa-emails` for the e-mails.

## Setup

```ts
// medusa-config.ts
import { accountEmailTemplates } from '@cloud-house/medusa-accounts'

plugins: [
  {
    resolve: '@cloud-house/medusa-accounts',
    options: { paths: { confirmEmail: '/…', passwordReset: '/…', setPassword: '/…' } /* see below */ },
  },
  {
    resolve: '@cloud-house/medusa-emails',
    // the provider needs the three account e-mails next to the shop's own
    options: { /* theme… */ templates: [...accountEmailTemplates /*, the shop's templates */] },
  },
]
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
}
```

`resolveOptions` treats `undefined` values as unset and throws when a `paths` entry is missing or
`locale` is unknown.

## Messages and error codes

`messages.pl` / `messages.en` hold the API error texts (`duplicateAccount`, `linkExpired`,
`tooManyRequests`, `wrongCurrentPassword`, `wrongPassword`, `signInAgain`, `tokenIssuedAtMissing`,
`orderNotFound`, `cartNotFound`, `invoiceNotFound`). `ACCOUNT_ERROR_CODES` has the matching stable
`account_*` codes.

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
