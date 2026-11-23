import { render } from '@react-email/components'
import { Button, Card, ContactCard, contactSentence, EmailLayout } from '../layout'
import { resolved } from './fixtures'

const html = (node: React.ReactElement) => render(node)

describe('EmailLayout', () => {
  it('renders the header with theme.shopName as text without logoUrl', async () => {
    const ctx = resolved({ theme: { shopName: 'Acme' } })
    const out = await html(
      <EmailLayout
        ctx={{ theme: ctx.theme, messages: ctx.messages, locale: ctx.locale }}
        preview="p"
      >
        <p>body</p>
      </EmailLayout>,
    )
    expect(out).toContain('>Acme</p>')
    expect(out).not.toContain('<img')
  })

  it('renders the logo image when logoUrl is set', async () => {
    const ctx = resolved({ theme: { shopName: 'Acme', logoUrl: 'https://example.com/logo.png' } })
    const out = await html(
      <EmailLayout ctx={ctx} preview="p">
        <p>body</p>
      </EmailLayout>,
    )
    expect(out).toContain('src="https://example.com/logo.png"')
    expect(out).toContain('alt="Acme"')
  })

  it('uses theme colours and fonts in inline styles', async () => {
    const ctx = resolved({
      theme: {
        shopName: 'Acme',
        colors: { navy: '#112233', sand: '#aabbcc', yellow: '#ddeeff' },
        fonts: { sans: 'Foo, sans-serif', display: 'Bar, serif' },
      },
    })
    const out = await html(
      <EmailLayout ctx={ctx} preview="p">
        <Card ctx={ctx} title="T">
          x
        </Card>
      </EmailLayout>,
    )
    expect(out).toContain('background-color:#112233')
    expect(out).toContain('background-color:#aabbcc')
    expect(out).toContain('font-family:Foo, sans-serif')
    expect(out).toContain('font-family:Bar, serif')
    expect(out).not.toContain('#0e1b2c')
  })

  it('renders the footer from the shop name, footerLinks, seller and reason', async () => {
    const ctx = resolved({
      theme: {
        shopName: 'Acme',
        footerLinks: [
          { label: 'Terms', url: 'https://shop.example.com/terms' },
          { label: 'Privacy', url: 'https://shop.example.com/privacy' },
        ],
      },
    })
    const out = await html(
      <EmailLayout
        ctx={ctx}
        preview="p"
        shopUrl="https://shop.example.com/"
        seller="Acme Ltd, 1 Main St"
        reason="Because."
      >
        x
      </EmailLayout>,
    )
    expect(out).toContain('href="https://shop.example.com/"')
    expect(out).toContain('>shop.example.com</a>')
    expect(out).toContain('href="https://shop.example.com/terms"')
    expect(out).toContain('>Privacy</a>')
    expect(out.replaceAll('<!-- -->', '')).toContain('Sprzedawca: Acme Ltd, 1 Main St')
    expect(out).toContain('Because.')
  })

  it('emits the font stylesheet link only when the theme has one', async () => {
    const plain = await html(
      <EmailLayout ctx={resolved()} preview="p">
        x
      </EmailLayout>,
    )
    expect(plain).not.toContain('rel="stylesheet"')
    const withCss = await html(
      <EmailLayout
        ctx={resolved({
          theme: { shopName: 'Acme', fonts: { stylesheet: 'https://f.example/x.css' } },
        })}
        preview="p"
      >
        x
      </EmailLayout>,
    )
    expect(withCss).toContain('href="https://f.example/x.css"')
  })

  it('sets the document language from the locale', async () => {
    const out = await html(
      <EmailLayout ctx={resolved({ locale: 'en' })} preview="p">
        x
      </EmailLayout>,
    )
    expect(out).toContain('lang="en"')
  })
})

describe('contact sentence', () => {
  const ctx = resolved()
  const contact = { canReply: true, email: 'a@example.com', phone: '600 100 200', hours: 'Mon-Fri' }

  it('keeps the phone number on one line with non-breaking spaces', () => {
    expect(contactSentence(contact, ctx.messages)).toBe(
      'Odpowiedz na tego maila albo napisz na a@example.com, tel. 600 100 200 (Mon-Fri).',
    )
  })

  it('falls back to the reply-only and write-to-us texts', () => {
    expect(contactSentence({ ...contact, email: null, phone: null }, ctx.messages)).toBe(
      'Odpowiedz na tego maila.',
    )
    expect(
      contactSentence(
        { canReply: false, email: 'a@example.com', phone: null, hours: null },
        ctx.messages,
      ),
    ).toBe('Napisz do nas: a@example.com.')
    expect(
      contactSentence({ canReply: false, email: null, phone: null, hours: null }, ctx.messages),
    ).toBeNull()
  })

  it('renders a contact card only when there is a sentence', async () => {
    expect(await html(<ContactCard ctx={ctx} contact={contact} />)).toContain('Masz pytania?')
    expect(
      await html(
        <ContactCard
          ctx={ctx}
          contact={{ canReply: false, email: null, phone: null, hours: null }}
        />,
      ),
    ).not.toContain('Masz pytania?')
  })
})

describe('layout parity guard (a shop theme with its own colours and fonts)', () => {
  const ctx = resolved({
    theme: {
      shopName: 'Acme',
      colors: {
        navy: '#0e1b2c',
        sand: '#f5f4f0',
        muted: '#56606e',
        subtle: '#8a8f98',
        line: '#dcdad3',
        success: '#2f7a46',
        yellow: '#f2d14a',
      },
      fonts: {
        sans: 'Manrope, Arial, Helvetica, sans-serif',
        display: 'Syne, Arial, Helvetica, sans-serif',
        stylesheet: 'https://fonts.example.com/css?family=Manrope|Syne',
      },
      footerLinks: [
        { label: 'Terms', url: 'https://shop.example.com/terms' },
        { label: 'Privacy', url: 'https://shop.example.com/privacy' },
      ],
    },
  })
  const contact = { canReply: true, email: 'a@example.com', phone: '600 100 200', hours: 'Mon-Fri' }

  it('keeps the markup and inline styles of the full layout', async () => {
    const out = await html(
      <EmailLayout
        ctx={ctx}
        preview="Preview"
        shopUrl="https://shop.example.com/"
        seller="Acme Ltd"
        reason="Because."
      >
        <Card ctx={ctx} title="Title">
          <Button ctx={ctx} href="https://shop.example.com/go">
            Go
          </Button>
        </Card>
        <ContactCard ctx={ctx} contact={contact} />
      </EmailLayout>,
    )
    expect(out).toMatchSnapshot()
    // The points the snapshot exists for, stated explicitly:
    expect(out).toContain('color:#56606e;margin-top:0')
    expect(out).toContain('color:#56606e;text-decoration-line:none')
    expect(out).toContain('background-color:#f2d14a')
    expect(out).toContain('border-radius:16px')
    expect(out).toContain('padding:22px')
    expect(out).toContain('@media (max-width: 620px) { .stack {')
  })

  it('omits the seller and reason blocks when they are null', async () => {
    const out = await html(
      <EmailLayout ctx={ctx} preview="Preview" seller={null} reason={null}>
        x
      </EmailLayout>,
    )
    expect(out).not.toContain('Sprzedawca')
    expect(out.match(/<p /g)).toHaveLength(2) // header text and the footer line only
    expect(out).toMatchSnapshot()
  })

  it('colours a Button with theme.colors.yellow and navy text', async () => {
    const out = await html(
      <Button ctx={ctx} href="https://x.example.com">
        Go
      </Button>,
    )
    expect(out).toContain('background-color:#f2d14a')
    expect(out).toContain('color:#0e1b2c')
    expect(out).toContain('border-radius:999px')
  })
})
