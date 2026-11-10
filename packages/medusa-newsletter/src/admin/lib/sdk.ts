import Medusa from '@medusajs/js-sdk'

/** Admin API client; the panel is served by the backend itself (`/app`), so same origin. */
export const sdk = new Medusa({ baseUrl: '/', auth: { type: 'session' } })
