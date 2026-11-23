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
export type { AccountEmailKind, EmailThrottle } from './lib/types'
export {
  ACCOUNT_LOCALES,
  type AccountLocale,
  type AccountsMessages,
  messages,
  resolveMessages,
} from './messages'
export {
  type AccountsOptions,
  type AccountsPaths,
  type ResolvedAccountsOptions,
  resolveOptions,
} from './options'
