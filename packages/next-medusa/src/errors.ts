/** The store cannot fetch data from Medusa (backend down, missing key or region). */
export class StoreUnavailableError extends Error {
  override name = 'StoreUnavailableError'
}
