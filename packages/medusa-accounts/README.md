# @cloud-house/medusa-accounts

Medusa 2 plugin: customer accounts (registration, e-mail confirmation, password reset, checkout
sign-up, account deletion). This release is the foundation: options, dictionaries, error codes and
the account helpers; workflows, subscribers and routes follow.

```sh
pnpm add --save-exact @cloud-house/medusa-accounts
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README) and
`@cloud-house/medusa-emails` for the e-mails.

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
