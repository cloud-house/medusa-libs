import { asValue } from '@medusajs/framework/awilix'
import { createMedusaContainer } from '@medusajs/framework/utils'
import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { resolveOptions } from '../../../options'
import { registerIdentityStep } from '../register-customer'

const workflow = createWorkflow(
  'test-register-identity',
  (input: { email: string; password: string }) => new WorkflowResponse(registerIdentityStep(input)),
)

const containerFor = (options: Parameters<typeof resolveOptions>[0]) => {
  const container = createMedusaContainer()
  container.register(
    'auth',
    asValue({ register: async () => ({ success: false, authIdentity: undefined }) }),
  )
  container.register('accounts', asValue({ getOptions: () => resolveOptions(options) }))
  return container
}

const paths = { confirmEmail: '/a', passwordReset: '/b', setPassword: '/c' }

const rejection = (container: ReturnType<typeof containerFor>) =>
  workflow(container as never)
    .run({ input: { email: 'a@b.pl', password: 'x' } })
    .then(
      () => null,
      (error: unknown) => error as { message: string; type: string; code?: string },
    )

describe('duplicate account error', () => {
  it('uses the Polish text and the stable code by default', async () => {
    const error = await rejection(containerFor({ paths }))
    expect(error).toMatchObject({
      type: 'duplicate_error',
      message: 'Konto z tym adresem już istnieje.',
      code: 'account_duplicate',
    })
  })

  it('takes the text from the shop dictionary (locale and single overrides)', async () => {
    expect((await rejection(containerFor({ paths, locale: 'en' })))?.message).toBe(
      'An account with this e-mail address already exists.',
    )
    expect(
      (await rejection(containerFor({ paths, messages: { duplicateAccount: 'Taken.' } })))?.message,
    ).toBe('Taken.')
  })
})
