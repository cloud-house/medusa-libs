import {
  EMAIL_LOCALES,
  type EmailLocale,
  type EmailMessages,
  fillPlaceholders,
  resolveMessages,
  withoutUndefined,
} from './messages'
import { DEFAULT_COLORS, DEFAULT_FONTS, type EmailTheme, type ResolvedEmailTheme } from './theme'
import type { EmailTemplate } from './types'

/** `options` of the provider in `medusa-config.ts` (the `notification` module). */
export interface EmailsOptions {
  /** Sales channels whose notifications go through this provider. */
  channels?: string[]
  /** Resend API key; without it (or in `preview` mode) nothing is sent. */
  apiKey?: string | null
  /** From address ("Shop <shop@example.com>"). */
  from?: string | null
  /** Default Reply-To. */
  replyTo?: string | null
  /** Directory the previews are written to when nothing is sent. */
  previewDir?: string | null
  /** `'send'` (default) or `'preview'` – render to `previewDir` only. */
  mode?: 'send' | 'preview'
  theme: EmailTheme
  /** Dictionary of the layout texts; default `'pl'`. */
  locale?: EmailLocale
  /** Single texts over the `locale` dictionary. */
  messages?: Partial<EmailMessages>
  /** The e-mails the shop can send; names must be unique. */
  templates: EmailTemplate[]
}

export interface ResolvedEmailsOptions {
  channels: string[]
  apiKey: string | null
  from: string | null
  replyTo: string | null
  previewDir: string | null
  mode: 'send' | 'preview'
  theme: ResolvedEmailTheme
  locale: EmailLocale
  messages: EmailMessages
  templates: EmailTemplate[]
}

const fail = (message: string): never => {
  throw new Error(`@cloud-house/medusa-emails: ${message}`)
}

/** Options with the defaults filled in (`undefined` values count as unset); throws on an invalid value. */
export function resolveOptions(options: EmailsOptions): ResolvedEmailsOptions {
  const {
    channels = [],
    apiKey = null,
    from = null,
    replyTo = null,
    previewDir = null,
    mode = 'send',
    locale = 'pl',
    templates = [],
    messages,
  } = withoutUndefined(options)
  const theme: Partial<EmailTheme> = options.theme ?? {}

  if (!theme.shopName) fail('theme.shopName is required.')
  if (!EMAIL_LOCALES.includes(locale))
    fail(`unknown locale "${locale}" (use ${EMAIL_LOCALES.join(', ')}).`)
  if (mode !== 'send' && mode !== 'preview') fail(`unknown mode "${mode}" (use send or preview).`)

  const names = new Set<string>()
  for (const template of templates) {
    if (names.has(template.name)) fail(`duplicate template "${template.name}".`)
    names.add(template.name)
  }

  const resolvedTheme: ResolvedEmailTheme = {
    shopName: theme.shopName as string,
    shopNameLocative: theme.shopNameLocative || (theme.shopName as string),
    logoUrl: theme.logoUrl ?? null,
    colors: { ...DEFAULT_COLORS, ...withoutUndefined(theme.colors) },
    fonts: { ...DEFAULT_FONTS, ...withoutUndefined(theme.fonts) },
    footerLinks: theme.footerLinks ?? [],
  }

  const shopValues = {
    shopName: resolvedTheme.shopName,
    shopNameLocative: resolvedTheme.shopNameLocative,
  }
  const dictionary = resolveMessages(locale, messages)
  const filled = Object.fromEntries(
    Object.entries(dictionary).map(([key, text]) => [key, fillPlaceholders(text, shopValues)]),
  ) as unknown as EmailMessages

  return {
    channels,
    apiKey,
    from,
    replyTo,
    previewDir,
    mode,
    theme: resolvedTheme,
    locale,
    messages: filled,
    templates,
  }
}
