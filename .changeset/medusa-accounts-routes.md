---
'@cloud-house/medusa-accounts': minor
---

0.1.0 was published without the store account routes and without two options added in review;
this release completes the package.

- The store account routes (`/store/account/register`, `register-from-order`, `confirm-email`,
  `email-confirmation`, `set-password`, `password`, `sessions/end-others`, `profile`, `cart`,
  `delete`) and their middlewares (customer session guard, closed native registration and
  verification routes, no refresh of customer tokens, protected customer `metadata`); the exported
  `ownOrder`, `closedRoutes`, `routedPath`, `isStaleToken` and `SESSIONS_VALID_FROM` for a shop's own
  account routes; the dictionary keys `sessionExpired`, `notFound` and `metadataUnavailable` for the
  guards.
- New option `deletedEmail` (`(customerId) => string`, default
  `deleted+<id>@account-deleted.invalid`): the placeholder e-mail written when an account is erased.
- New option `createAccountFlag` (`{ key, value }`, default `{ key: 'create_account', value: 'true' }`):
  the order metadata entry of the checkout's „create an account” box.
- `accountsOptions(container)` throws a clear error when the `accounts` module is not registered.
