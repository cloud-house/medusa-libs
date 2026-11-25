import Medusa from '@medusajs/js-sdk'

/** Admin API client; the panel is served by the backend itself (`/app`), so same origin. */
export const sdk = new Medusa({ baseUrl: '/', auth: { type: 'session' } })

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Coś poszło nie tak. Spróbuj ponownie.'
}
