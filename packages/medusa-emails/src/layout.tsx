import {
  Body,
  Column,
  Container,
  Button as EmailButton,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import { type EmailMessages, fillPlaceholders } from './messages'
import type { ResolvedEmailTheme } from './theme'
import type { RenderContext, ShopContact } from './types'

export { Column, Row }

/** Shared inline styles built from the theme. */
export function layoutStyles(theme: ResolvedEmailTheme) {
  const { navy, muted } = theme.colors
  const text: CSSProperties = { margin: '0 0 8px', fontSize: 15, lineHeight: 1.55, color: navy }
  const small: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.6, color: muted }
  const card: CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    marginBottom: 16,
  }
  const cardTitle: CSSProperties = {
    margin: '0 0 14px',
    fontFamily: theme.fonts.display,
    fontSize: 17,
    fontWeight: 700,
    color: navy,
  }
  const pageTitle: CSSProperties = {
    margin: '0 0 10px',
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 1.15,
    color: navy,
  }
  return { text, small, card, cardTitle, pageTitle }
}

type LayoutContext = Pick<RenderContext, 'theme'>

export function Card({
  ctx,
  title,
  children,
}: {
  ctx: LayoutContext
  title?: string
  children: ReactNode
}) {
  const { card, cardTitle } = layoutStyles(ctx.theme)
  return (
    <Section style={card}>
      {title && (
        <Heading as="h2" style={cardTitle}>
          {title}
        </Heading>
      )}
      {children}
    </Section>
  )
}

/** Pill button in the theme's button colour. */
export function Button({
  ctx,
  href,
  children,
}: {
  ctx: LayoutContext
  href: string
  children: ReactNode
}) {
  return (
    <EmailButton
      href={href}
      style={{
        backgroundColor: ctx.theme.colors.yellow,
        color: ctx.theme.colors.navy,
        borderRadius: 999,
        padding: '13px 26px',
        fontSize: 15,
        fontWeight: 700,
        textDecoration: 'none',
        margin: '8px 0 14px',
      }}
    >
      {children}
    </EmailButton>
  )
}

/** What the contact card shows; `canReply` – a Reply-To address is known. */
export interface EmailContact extends Pick<ShopContact, 'email' | 'phone' | 'hours'> {
  canReply: boolean
}

/** "Reply to this e-mail or …" – `null` when the shop has no contact at all. */
export function contactSentence(contact: EmailContact, messages: EmailMessages): string | null {
  // Non-breaking spaces keep the phone number on one line.
  const phone = contact.phone?.replace(/ /g, ' ')
  const phonePhrase = phone
    ? contact.hours
      ? fillPlaceholders(messages.phoneWithHours, { phone, hours: contact.hours })
      : fillPlaceholders(messages.phone, { phone })
    : null
  const emailPhrase = contact.email
    ? fillPlaceholders(messages.writeAt, { email: contact.email })
    : null
  const write = [emailPhrase, phonePhrase].filter(Boolean).join(', ')
  if (contact.canReply) {
    return write ? fillPlaceholders(messages.replyOrWrite, { contact: write }) : messages.replyOnly
  }
  const reach = [contact.email, phonePhrase].filter(Boolean).join(', ')
  return reach ? fillPlaceholders(messages.writeToUs, { contact: reach }) : null
}

export function ContactCard({
  ctx,
  contact,
}: {
  ctx: Pick<RenderContext, 'theme' | 'messages'>
  contact: EmailContact
}) {
  const sentence = contactSentence(contact, ctx.messages)
  if (!sentence) return null
  const { text } = layoutStyles(ctx.theme)
  return (
    <Card ctx={ctx}>
      <Text style={{ ...text, fontSize: 14, margin: 0 }}>
        <strong>{ctx.messages.questionsTitle}</strong> {sentence}
      </Text>
    </Card>
  )
}

/** The seller line as separate text nodes around the seller (the markup the layout always had). */
const sellerNodes = (line: string, seller: string) =>
  line
    .split('{seller}')
    .flatMap((part, index) => (index === 0 ? [part] : [seller, part]))
    .filter((part) => part !== '')

interface EmailLayoutProps {
  ctx: RenderContext
  preview: string
  /** Shop address shown (without the scheme) and linked after the shop name in the footer. */
  shopUrl?: string | null
  /** Seller line text (`messages.sellerLine`); `null` while the seller data is incomplete. */
  seller?: string | null
  /** Why the recipient got this e-mail – the last footer line. */
  reason?: string | null
  children: ReactNode
}

/** Header in the theme's colours (logo or shop name), body with cards, footer with the shop links. */
export function EmailLayout({
  ctx,
  preview,
  shopUrl = null,
  seller = null,
  reason = null,
  children,
}: EmailLayoutProps) {
  const { theme, messages, locale } = ctx
  const { navy, sand, muted } = theme.colors
  const { small } = layoutStyles(theme)
  const linkStyle: CSSProperties = { color: muted, textDecoration: 'underline' }
  const links = [
    ...(shopUrl
      ? [
          <Link key="shop" href={shopUrl} style={linkStyle}>
            {shopUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}
          </Link>,
        ]
      : []),
    ...theme.footerLinks.map((link) => (
      <Link key={link.url} href={link.url} style={linkStyle}>
        {link.label}
      </Link>
    )),
  ]
  const footerLine = links.length
    ? [
        `${theme.shopName} ·`,
        ...links.flatMap((link, index) => [
          ' ',
          link,
          ...(index < links.length - 1 ? [' ', '·'] : []),
        ]),
      ]
    : theme.shopName
  return (
    <Html lang={locale}>
      <Head>
        {theme.fonts.stylesheet && <link href={theme.fonts.stylesheet} rel="stylesheet" />}
        <style>
          {
            '@media (max-width: 620px) { .stack { display: block !important; width: 100% !important; padding: 0 0 12px !important; } }'
          }
        </style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: sand, fontFamily: theme.fonts.sans, color: navy }}>
        <Container style={{ width: '100%', maxWidth: 600, backgroundColor: sand }}>
          <Section style={{ backgroundColor: navy, padding: '22px 28px' }}>
            {theme.logoUrl ? (
              <Img src={theme.logoUrl} alt={theme.shopName} height={28} />
            ) : (
              <Text
                style={{
                  margin: 0,
                  color: '#ffffff',
                  fontFamily: theme.fonts.display,
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                {messages.headerName}
              </Text>
            )}
          </Section>

          <Section style={{ padding: '24px 16px 8px' }}>{children}</Section>

          <Section style={{ padding: '0 28px 28px' }}>
            <Text style={{ ...small, fontSize: 12 }}>{footerLine}</Text>
            {seller && (
              <Text style={{ ...small, fontSize: 12 }}>
                {sellerNodes(messages.sellerLine, seller)}
              </Text>
            )}
            {reason && <Text style={{ ...small, fontSize: 12 }}>{reason}</Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
