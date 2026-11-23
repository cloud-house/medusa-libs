export { EMAIL_ERROR_CODES, type EmailErrorCode } from './errors'
export {
  EMAIL_LOCALES,
  type EmailLocale,
  type EmailMessages,
  fillPlaceholders,
  messages,
  resolveMessages,
} from './messages'
export { type EmailsOptions, type ResolvedEmailsOptions, resolveOptions } from './options'
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
