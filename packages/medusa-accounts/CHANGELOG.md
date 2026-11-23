# @cloud-house/medusa-accounts

## 0.2.0

### Minor Changes

- dcfe8ab: 0.1.0 was published without the store account routes and without two options added in review;
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

## 0.1.0

### Minor Changes

- 2481e55: First release (foundation): options (`locale`, `messages`, `storefrontUrl`, required `paths`,
  `resolveContact`, `onAccountDeleted`, `emailThrottle`), Polish and English dictionaries of the
  account API error texts, the `account_*` error codes and the account helpers
  (`accountIdentityId`, `customerOfIdentity`, `isEmailConfirmed`, `updateAccountMetadata`,
  `tooManyAccountEmails` with a configurable throttle).

  Also: the `accounts` module (holds the resolved options for subscribers, workflows and routes; no
  data models, no migrations), the account workflows (`registerCustomerWorkflow`,
  `registerFromOrderWorkflow`, `requestEmailConfirmationWorkflow`,
  `createAccountFromCheckoutWorkflow`, `assignPlacedOrderWorkflow`, `linkGuestOrdersWorkflow`,
  `deleteAccountWorkflow` with the `onAccountDeleted` callbacks), the subscribers for
  `auth.verification_requested`, `auth.password_reset` and `order.placed`, and the three account
  e-mails (`accountEmailTemplates` for the `medusa-emails` provider).
