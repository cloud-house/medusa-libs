/** At most `max` e-mails of one kind to one address within `windowMs`. */
export interface EmailThrottle {
  max: number
  windowMs: number
}

/** The account e-mails that are throttled; also the notification `template` names. */
export type AccountEmailKind = 'email-confirmation' | 'password-reset' | 'set-password'
