import type { CartClient } from './client'

export type FakeCall = { path: string; init?: Parameters<CartClient['fetch']>[1] }

export const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), { status, statusText: 'Error' })

/** Atrapa klienta SDK do testów: odpowiedzi po „METODA ścieżka”, funkcja może rzucić błąd. */
export function fakeClient(responses: Record<string, (() => unknown) | unknown>) {
  const calls: FakeCall[] = []
  const client: CartClient = {
    async fetch<T>(path: string, init?: FakeCall['init']) {
      calls.push({ path, init })
      const key = `${init?.method ?? 'GET'} ${path}`
      const response = responses[key]
      if (response === undefined) throw new Error(`unexpected ${key}`)
      return (typeof response === 'function' ? response() : response) as T
    },
  }
  return { client, calls }
}
