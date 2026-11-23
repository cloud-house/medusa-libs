/** Stable `code` of the invoicing errors thrown by the plugin itself (not the Fakturownia API ones). */
export const FAKTUROWNIA_ERROR_CODES = {
  /** A required plugin option is missing (thrown at start-up). */
  missingOption: 'fakturownia_missing_option',
} as const

export type FakturowniaErrorCode =
  (typeof FAKTUROWNIA_ERROR_CODES)[keyof typeof FAKTUROWNIA_ERROR_CODES]
