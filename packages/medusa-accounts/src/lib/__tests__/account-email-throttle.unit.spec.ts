import type { MedusaContainer } from '@medusajs/framework/types'
import { ACCOUNT_EMAIL_LIMIT, tooManyAccountEmails } from '../account-email-throttle'

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)

const containerWith = (createdAt: number[]) => {
  const listNotifications = jest.fn(async (_filter: unknown, config: { take: number }) =>
    createdAt.slice(0, config.take).map((time) => ({ created_at: new Date(time) })),
  )
  const container = { resolve: () => ({ listNotifications }) } as unknown as MedusaContainer
  return { container, listNotifications }
}

describe('tooManyAccountEmails', () => {
  it('defaults to 3 e-mails in 15 minutes', () => {
    expect(ACCOUNT_EMAIL_LIMIT).toEqual({ max: 3, windowMs: 15 * 60 * 1000 })
  })

  it('is false below the limit', async () => {
    const { container } = containerWith([NOW - 1000, NOW - 2000])
    expect(await tooManyAccountEmails(container, 'a@b.pl', 'password-reset', undefined, NOW)).toBe(
      false,
    )
  })

  it('is true when the last 3 are inside the window', async () => {
    const { container, listNotifications } = containerWith([NOW - 1000, NOW - 2000, NOW - 3000])
    expect(await tooManyAccountEmails(container, 'a@b.pl', 'set-password', undefined, NOW)).toBe(
      true,
    )
    expect(listNotifications).toHaveBeenCalledWith(
      { to: 'a@b.pl', template: 'set-password' },
      { order: { created_at: 'DESC' }, take: 3 },
    )
  })

  it('is false when the oldest of them is outside the window', async () => {
    const old = NOW - ACCOUNT_EMAIL_LIMIT.windowMs - 1
    const { container } = containerWith([NOW - 1000, NOW - 2000, old])
    expect(
      await tooManyAccountEmails(container, 'a@b.pl', 'email-confirmation', undefined, NOW),
    ).toBe(false)
  })

  it('honours a custom throttle', async () => {
    const { container, listNotifications } = containerWith([NOW - 1000])
    expect(
      await tooManyAccountEmails(
        container,
        'a@b.pl',
        'password-reset',
        { max: 1, windowMs: 5000 },
        NOW,
      ),
    ).toBe(true)
    expect(listNotifications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ take: 1 }),
    )
    expect(
      await tooManyAccountEmails(
        container,
        'a@b.pl',
        'password-reset',
        { max: 1, windowMs: 500 },
        NOW,
      ),
    ).toBe(false)
  })
})
