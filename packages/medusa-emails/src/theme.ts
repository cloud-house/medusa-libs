/** Colours as hex – e-mail clients ignore oklch and CSS variables. */
export interface EmailColors {
  /** Header background and main text. */
  navy: string
  /** Page background. */
  sand: string
  /** Secondary text. */
  muted: string
  /** Tertiary text. */
  subtle: string
  /** Borders and dividers. */
  line: string
  /** Positive amounts and confirmations. */
  success: string
  /** Button background. */
  yellow: string
}

export interface EmailFonts {
  /** Body font stack. */
  sans: string
  /** Headings font stack. */
  display: string
  /** Stylesheet (e.g. Google Fonts URL) linked in the `<head>` so web fonts load where clients allow it; none by default. */
  stylesheet?: string | null
}

export interface EmailFooterLink {
  label: string
  url: string
}

/** How the shop's e-mails look; only `shopName` is required. */
export interface EmailTheme {
  shopName: string
  /** `shopName` in the locative ("w Acme"); defaults to `shopName`. */
  shopNameLocative?: string
  /** Image shown in the header instead of the shop name; `null` – none. */
  logoUrl?: string | null
  colors?: Partial<EmailColors>
  fonts?: Partial<EmailFonts>
  /** Links after the shop address in the footer (terms, privacy policy …). */
  footerLinks?: EmailFooterLink[]
}

export interface ResolvedEmailTheme {
  shopName: string
  shopNameLocative: string
  logoUrl: string | null
  colors: EmailColors
  fonts: EmailFonts
  footerLinks: EmailFooterLink[]
}

/** Neutral defaults (slate and off-white with a gold button); the shop overrides them in `theme.colors`. */
export const DEFAULT_COLORS: EmailColors = {
  navy: '#1f2933',
  sand: '#f4f4f1',
  muted: '#52606d',
  subtle: '#7b8794',
  line: '#d9d9d3',
  success: '#2f7a46',
  yellow: '#f0c93a',
}

export const DEFAULT_FONTS: EmailFonts = {
  sans: 'Arial, Helvetica, sans-serif',
  display: 'Arial, Helvetica, sans-serif',
}
