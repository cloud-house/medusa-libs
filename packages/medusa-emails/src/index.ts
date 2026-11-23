export { emailEnv, emailWarnings } from './env'
export { EMAIL_ERROR_CODES, type EmailErrorCode } from './errors'
export {
  Button,
  Card,
  Column,
  ContactCard,
  contactSentence,
  type EmailContact,
  EmailLayout,
  layoutStyles,
  Row,
} from './layout'
export {
  EMAIL_LOCALES,
  type EmailLocale,
  type EmailMessages,
  fillPlaceholders,
  messages,
  resolveMessages,
} from './messages'
export { type EmailsOptions, type ResolvedEmailsOptions, resolveOptions } from './options'
export { type EmailFixture, previewEmails } from './preview'
export { renderEmail } from './render'
export {
  DEFAULT_COLORS,
  DEFAULT_FONTS,
  type EmailColors,
  type EmailFonts,
  type EmailFooterLink,
  type EmailTheme,
  type ResolvedEmailTheme,
} from './theme'
export type {
  ContactResolver,
  EmailTemplate,
  RenderContext,
  RenderedEmail,
  ShopContact,
} from './types'
