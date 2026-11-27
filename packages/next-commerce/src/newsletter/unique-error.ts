/** Medusa answers an address already on the list with 422 (`DUPLICATE_ERROR`). */
export function isUniqueEmailError(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 422
}
