---
'@cloud-house/medusa-accounts': minor
---

First release (foundation): options (`locale`, `messages`, `storefrontUrl`, required `paths`,
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

Also: the store account routes (`/store/account/register`, `register-from-order`, `confirm-email`,
`email-confirmation`, `set-password`, `password`, `sessions/end-others`, `profile`, `cart`,
`delete`), their middlewares (customer session guard, closed native registration and verification
routes, no refresh of customer tokens, protected customer `metadata`) and the exported `ownOrder`
for a shop's own order routes; the dictionary has `sessionExpired`, `notFound` and
`metadataUnavailable` for the guards.
