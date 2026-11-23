// biome-ignore lint/suspicious/noExplicitAny: an axios response of the test runner
export type TestResponse = { data: any; status: number }

export type Api = {
  get: (url: string, config?: unknown) => Promise<TestResponse>
  post: (url: string, body?: unknown, config?: unknown) => Promise<TestResponse>
}

export interface RegisteredCustomerInput {
  email: string
  password?: string
  first_name?: string
  last_name?: string
  phone?: string
}

export interface RegisteredCustomer {
  customerId: string
  token: string
  /** Publishable key + bearer token of the customer. */
  authHeaders: Record<string, string>
}

export const TEST_PASSWORD = 'secret-password-1'

/** A request that resolves to the error response too (a 4xx/5xx does not throw). */
export const send = (promise: Promise<TestResponse>): Promise<TestResponse> =>
  promise.catch((error: { response: TestResponse }) => error.response)

/** Registers a customer with `/store/account/register` and signs in with e-mail and password. */
export async function registerCustomer(
  api: Api,
  headers: Record<string, string>,
  input: RegisteredCustomerInput,
): Promise<RegisteredCustomer> {
  const password = input.password ?? TEST_PASSWORD
  const customer = (
    await api.post(
      '/store/account/register',
      {
        email: input.email,
        password,
        first_name: input.first_name ?? 'Jan',
        last_name: input.last_name ?? 'Kowalski',
        phone: input.phone ?? '600100200',
      },
      { headers },
    )
  ).data.customer
  const token = await login(api, customer.email, password)
  return {
    customerId: customer.id,
    token,
    authHeaders: { ...headers, authorization: `Bearer ${token}` },
  }
}

export async function login(api: Api, email: string, password = TEST_PASSWORD): Promise<string> {
  return (await api.post('/auth/customer/emailpass', { email, password })).data.token as string
}

/** `iat` (seconds) of a JWT. */
export function issuedAt(token: string): number {
  const payload = token.split('.')[1] ?? ''
  return (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { iat: number }).iat
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
