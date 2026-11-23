import { EMAIL_ERROR_CODES } from '../errors'
import { renderEmail } from '../render'
import { resolved } from './fixtures'

describe('renderEmail', () => {
  it('renders the template picked by name with the shop theme and messages', async () => {
    const email = await renderEmail(resolved(), 'greeting', { who: 'Ola' })
    expect(email.subject).toBe('Hello Ola')
    expect(email.html).toContain('Hello Ola')
    expect(email.html).toContain('Acme')
  })

  it('fails with emails_unknown_template for a template not in the list', async () => {
    await expect(renderEmail(resolved(), 'nope', {})).rejects.toMatchObject({
      code: EMAIL_ERROR_CODES.unknownTemplate,
    })
  })

  it('fails with emails_unknown_template when the list is empty', async () => {
    await expect(renderEmail(resolved({ templates: [] }), 'greeting', {})).rejects.toMatchObject({
      code: EMAIL_ERROR_CODES.unknownTemplate,
    })
  })
})
