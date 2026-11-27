import { Resend } from 'resend'
import { redactedError } from './subscribe'

export interface NewsletterProvider {
  /** Dodaje kontakt do Audience. Rzuca przy błędzie konfiguracji; łapie błędy sieciowe wewnętrznie. */
  add(email: string): Promise<void>
}

/** Resend Audiences provider. `NEWSLETTER_API_KEY` i `NEWSLETTER_AUDIENCE_ID` wymagane – bez nich zwraca null. */
export function resendNewsletterProvider(
  env: Record<string, string | undefined> = process.env,
  resendClient?: Resend,
  logPrefix = '[Newsletter]',
): NewsletterProvider | null {
  const apiKey = env.NEWSLETTER_API_KEY
  const audienceId = env.NEWSLETTER_AUDIENCE_ID

  if (!apiKey || !audienceId) {
    return null
  }

  const resend = resendClient ?? new Resend(apiKey)

  return {
    async add(email: string): Promise<void> {
      try {
        const { error } = await resend.contacts.create({
          audienceId,
          email,
          unsubscribed: false,
        })
        if (error) {
          console.error(
            `${logPrefix} Resend Audiences: nie dodano [e-mail]: ${redactedError(error)}`,
          )
        }
      } catch (error) {
        console.error(`${logPrefix} Resend Audiences: nie dodano [e-mail]: ${redactedError(error)}`)
      }
    },
  }
}

/** Atrapa do testów – zbiera wywołania bez sieci. */
export function fakeNewsletterProvider(): NewsletterProvider & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async add(email: string): Promise<void> {
      calls.push(email)
    },
  }
}
