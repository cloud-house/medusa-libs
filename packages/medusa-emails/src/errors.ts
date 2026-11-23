/** Stable `code` of the plugin's errors – callers can branch on it. */
export const EMAIL_ERROR_CODES = {
  /** The notification asked for a template that is not in the `templates` option. */
  unknownTemplate: 'emails_unknown_template',
  /** The provider did not send the e-mail (no API key outside preview mode, or Resend refused it). */
  notSent: 'emails_not_sent',
} as const

export type EmailErrorCode = (typeof EMAIL_ERROR_CODES)[keyof typeof EMAIL_ERROR_CODES]
