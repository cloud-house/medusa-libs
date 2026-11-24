/** Stable `code` of the errors the plugin itself throws; it is the prefix of the message in brackets. */
export const RETURNS_ERROR_CODES = {
  /** A required plugin option is missing (thrown at start-up). */
  missingOption: 'returns_missing_option',
  /** A plugin option has a value the plugin cannot use (thrown at start-up). */
  invalidOption: 'returns_invalid_option',
  /** The return shipping option (`RETURN_OPTION_CODE`) does not exist in the database. */
  noReturnOption: 'returns_no_return_option',
  /** A return reason of the shop's list does not exist in the database. */
  noReturnReason: 'returns_no_return_reason',
  /** The return shipping option is not connected to a stock location. */
  noLocation: 'returns_no_location',
} as const

export type ReturnsErrorCode = (typeof RETURNS_ERROR_CODES)[keyof typeof RETURNS_ERROR_CODES]

/** An error of the plugin's own: the code in brackets, then what to do about it. */
export function returnsError(code: ReturnsErrorCode, message: string): Error {
  return new Error(`@cloud-house/medusa-returns [${code}]: ${message}`)
}
