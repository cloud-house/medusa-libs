/** Stable `code` of the errors the plugin itself throws; it is the prefix of the message in brackets. */
export const CONTENT_ERROR_CODES = {
  /** A required plugin option is missing (thrown at start-up). */
  missingOption: 'content_missing_option',
  /** A plugin option has a value the plugin cannot use (thrown at start-up). */
  invalidOption: 'content_invalid_option',
} as const

export type ContentErrorCode = (typeof CONTENT_ERROR_CODES)[keyof typeof CONTENT_ERROR_CODES]

/** An error of the plugin's own: the code in brackets, then what to do about it. */
export function contentError(code: ContentErrorCode, message: string): Error {
  return new Error(`@cloud-house/medusa-content [${code}]: ${message}`)
}
