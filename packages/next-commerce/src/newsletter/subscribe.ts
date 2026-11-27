import { normalizeEmail } from './email'

export type NewsletterSource = 'footer' | 'home' | 'register' | 'checkout'

const SOURCES: readonly NewsletterSource[] = ['footer', 'home', 'register', 'checkout']

export type NewsletterState =
  | { status: 'idle' }
  | { status: 'success'; email: string }
  | {
      status: 'error'
      /** Wpisany tekst – wraca do pola po błędzie. */
      email: string
      fieldErrors: { email?: string; consent?: string }
      message?: string
    }

export const NEWSLETTER_MESSAGES = {
  email: 'Podaj poprawny adres e-mail.',
  consent: 'Zaznacz zgodę, żeby się zapisać.',
  rateLimited: 'Za dużo prób. Spróbuj ponownie za kilka minut.',
  failed: 'Nie udało się zapisać. Spróbuj ponownie za chwilę.',
} as const

export interface SubscribeDeps {
  exists(email: string): Promise<boolean>
  create(entry: {
    email: string
    consentText: string
    consentAt: string
    source: NewsletterSource
  }): Promise<void>
  notify(email: string): Promise<void>
  isUniqueViolation(error: unknown): boolean
  allow(ip: string): boolean
  now(): Date
  log(message: string): void
  /** The whole consent text the form shows – stored with every sign-up as the proof. */
  consentText: string
  /** Prefix of the log lines; default `[Newsletter]`. */
  logPrefix?: string
}

// Bez apostrofu w wykluczeniach – formularz przyjmuje go w adresie, a drizzle podaje parametry bez
// cudzysłowów.
const EMAIL = /[^\s@,;:()<>"[\]]+@[^\s@,;:()<>"[\]]+/g

/**
 * Błąd zapisu do logu bez adresów e-mail: drizzle podaje parametry zapytania w treści błędu,
 * a Postgres – wartość duplikatu w przyczynie. Zostają nazwa, treść i kod błędu bazy.
 */
export function redactedError(error: unknown): string {
  const describe = (value: unknown): string => {
    if (value && typeof value === 'object' && !(value instanceof Error)) {
      const msg = (value as { message?: unknown }).message
      const name = (value as { name?: unknown }).name
      if (typeof msg === 'string') {
        return name ? `${name}: ${msg}` : msg
      }
    }
    if (!(value instanceof Error)) return String(value)
    const code = (value as { code?: unknown }).code
    return `${value.name}${typeof code === 'string' ? ` [${code}]` : ''}: ${value.message}`
  }
  try {
    const cause =
      error instanceof Error && error.cause ? ` (przyczyna: ${describe(error.cause)})` : ''
    return `${describe(error)}${cause}`.replace(EMAIL, '[e-mail]')
  } catch {
    // Np. obiekt bez prototypu – `String()` rzuca; zapis ma się skończyć zwykłym komunikatem.
    return '[nieznany błąd]'
  }
}

/**
 * Zapis na newsletter (spec 4c §3): pole-pułapka i ponowny zapis kończą się tym samym
 * podziękowaniem co nowy wpis – formularz nie zdradza, kto jest na liście.
 */
export async function subscribe(
  form: { email: unknown; consent: unknown; website: unknown; source: unknown },
  ip: string | null,
  deps: SubscribeDeps,
): Promise<NewsletterState> {
  const typed = typeof form.email === 'string' ? form.email : ''
  const email = normalizeEmail(form.email)
  if (typeof form.website === 'string' && form.website.trim() !== '') {
    return { status: 'success', email: email ?? typed.trim() }
  }
  if (ip && !deps.allow(ip)) {
    return {
      status: 'error',
      email: typed,
      fieldErrors: {},
      message: NEWSLETTER_MESSAGES.rateLimited,
    }
  }
  const consent = form.consent === 'tak'
  if (!email || !consent) {
    return {
      status: 'error',
      email: typed,
      fieldErrors: {
        ...(email ? {} : { email: NEWSLETTER_MESSAGES.email }),
        ...(consent ? {} : { consent: NEWSLETTER_MESSAGES.consent }),
      },
    }
  }
  const success: NewsletterState = { status: 'success', email }
  try {
    if (await deps.exists(email)) return success
    await deps.create({
      email,
      consentText: deps.consentText,
      consentAt: deps.now().toISOString(),
      source: SOURCES.includes(form.source as NewsletterSource)
        ? (form.source as NewsletterSource)
        : 'footer',
    })
    try {
      await deps.notify(email)
    } catch {
      // Błąd dostawcy nie wpływa na sukces zapisu w sklepie
    }
    return success
  } catch (error) {
    if (deps.isUniqueViolation(error)) return success
    deps.log(
      `${deps.logPrefix ?? '[Newsletter]'} Nie udało się zapisać adresu na newsletter: ${redactedError(error)}`,
    )
    return { status: 'error', email: typed, fieldErrors: {}, message: NEWSLETTER_MESSAGES.failed }
  }
}
