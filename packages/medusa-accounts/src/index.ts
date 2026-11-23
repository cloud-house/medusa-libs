export { closedRoutes, routedPath } from './api/guards/body-guards'
export { isStaleToken, SESSIONS_VALID_FROM } from './api/guards/session-guard'
export { ownOrder } from './api/store/account/own-order'
export { PASSWORD_MIN_LENGTH } from './api/store/account/validators'
export { accountEmailData, DEFAULT_STOREFRONT_URL, replyToFor } from './emails/account-email-data'
export { accountEmailTemplates } from './emails/templates'
export type { AccountEmailData } from './emails/types'
export { ACCOUNT_ERROR_CODES, type AccountErrorCode } from './errors'
export {
  accountIdentityId,
  CREATED_FROM_ORDER,
  customerOfIdentity,
  EMAIL_ENTITY,
  isEmailConfirmed,
  markEmailConfirmed,
  nowSeconds,
  PASSWORD_PENDING,
  passwordMatches,
  registeredCustomerByEmail,
  reopenAuthVerification,
  updateAccountMetadata,
} from './lib/account'
export { ACCOUNT_EMAIL_LIMIT, tooManyAccountEmails } from './lib/account-email-throttle'
export { ACCOUNT_CART_FLAG, LAST_CART } from './lib/constants'
export { accountsOptions } from './lib/plugin-options'
export type { AccountEmailKind, EmailThrottle } from './lib/types'
export {
  ACCOUNT_LOCALES,
  type AccountLocale,
  type AccountsMessages,
  messages,
  resolveMessages,
} from './messages'
export { ACCOUNTS_MODULE } from './modules/accounts'
export type { default as AccountsModuleService } from './modules/accounts/service'
export {
  type AccountsOptions,
  type AccountsPaths,
  type ResolvedAccountsOptions,
  resolveOptions,
} from './options'
export { assignPlacedOrderWorkflow } from './workflows/account/assign-placed-order'
export { createAccountFromCheckoutWorkflow } from './workflows/account/create-account-from-checkout'
export { deleteAccountWorkflow, eraseCustomerDataStep } from './workflows/account/delete-account'
export { linkGuestOrdersWorkflow } from './workflows/account/link-guest-orders'
export { registerCustomerWorkflow } from './workflows/account/register-customer'
export { registerFromOrderWorkflow } from './workflows/account/register-from-order'
export { requestEmailConfirmationWorkflow } from './workflows/account/request-email-confirmation'
