# @cloud-house/medusa-accounts

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
