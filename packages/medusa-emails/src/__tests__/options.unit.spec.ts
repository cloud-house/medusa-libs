import { messages } from '../messages'
import { type EmailsOptions, resolveOptions } from '../options'
import type { EmailTemplate } from '../types'

const template = (name: string): EmailTemplate => ({
  name,
  render: async () => ({ subject: name, html: '', text: '', name }),
})

const base = (overrides: Partial<EmailsOptions> = {}): EmailsOptions => ({
  theme: { shopName: 'Acme' },
  templates: [template('welcome')],
  ...overrides,
})

describe('resolveOptions', () => {
  it('fills in neutral theme colours and locale pl', () => {
    const resolved = resolveOptions(base())
    expect(resolved.locale).toBe('pl')
    expect(resolved.mode).toBe('send')
    for (const colour of Object.values(resolved.theme.colors)) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(Object.keys(resolved.theme.colors).sort()).toEqual(
      ['line', 'muted', 'navy', 'sand', 'subtle', 'success', 'yellow'].sort(),
    )
    expect(resolved.theme.fonts.sans).toBeTruthy()
    expect(resolved.theme.fonts.display).toBeTruthy()
    expect(resolved.messages.sellerLine).toBe(messages.pl.sellerLine)
  })

  it('ignores undefined overrides', () => {
    const defaults = resolveOptions(base())
    const resolved = resolveOptions(
      base({
        theme: { shopName: 'Acme', colors: { navy: undefined, sand: '#ffffff' } },
        locale: undefined,
        messages: { termsLink: undefined, privacyLink: 'Privacy' },
      }),
    )
    expect(resolved.theme.colors.navy).toBe(defaults.theme.colors.navy)
    expect(resolved.theme.colors.sand).toBe('#ffffff')
    expect(resolved.locale).toBe('pl')
    expect(resolved.messages.termsLink).toBe(messages.pl.termsLink)
    expect(resolved.messages.privacyLink).toBe('Privacy')
  })

  it('throws on a duplicate template name', () => {
    expect(() => resolveOptions(base({ templates: [template('a'), template('a')] }))).toThrow(
      /duplicate template "a"/,
    )
  })

  it('throws without theme.shopName', () => {
    expect(() => resolveOptions(base({ theme: { shopName: '' } }))).toThrow(/shopName/)
    expect(() => resolveOptions({ templates: [] } as unknown as EmailsOptions)).toThrow(/shopName/)
  })

  it('throws on an unknown locale', () => {
    expect(() => resolveOptions(base({ locale: 'de' as never }))).toThrow(/unknown locale "de"/)
  })

  it('uses shopName as shopNameLocative when not given', () => {
    expect(resolveOptions(base()).theme.shopNameLocative).toBe('Acme')
    expect(
      resolveOptions(base({ theme: { shopName: 'Acme', shopNameLocative: 'Acme-u' } })).theme
        .shopNameLocative,
    ).toBe('Acme-u')
  })

  it('puts the shop name into the dictionary texts', () => {
    const resolved = resolveOptions(
      base({ theme: { shopName: 'Acme', shopNameLocative: 'Acme-ie' } }),
    )
    expect(JSON.stringify(resolved.messages)).not.toMatch(/\{shopName/)
    expect(resolved.messages.inShop).toBe('w Acme-ie')
  })
})
