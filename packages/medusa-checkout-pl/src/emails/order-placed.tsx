import { formatPrice } from '@cloud-house/commerce-rules'
import {
  Card,
  ContactCard,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Column, Heading, Img, Row, Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import type { EmailLine, OrderPlacedEmailData } from './types'

/** Sum rows are laid out as a data table in the plain-text version (label and amount apart). */
export const SUM_ROW = 'sum-row'
/** Struck-through price before a discount – the plain-text version names it in words. */
export const WAS_PRICE = 'was-price'

const PREVIEW = 'Przyjęliśmy Twoje zamówienie. Poniżej jego podsumowanie.'
const NOTE_STYLE: CSSProperties = { margin: '10px 0 0', fontSize: 14, lineHeight: 1.5 }

export const orderPlacedSubject = (data: OrderPlacedEmailData) =>
  `Dziękujemy za zamówienie #${data.displayId}`

function Thumbnail({ src, alt, size }: { src: string | null; alt: string; size: number }) {
  const box: CSSProperties = { width: size, height: size, borderRadius: 8, display: 'block' }
  // Without a photo a sand box keeps the layout; never an <img> with an empty src.
  // The product name as alt – clients that block images show it in the empty box.
  return src ? (
    <Img src={src} alt={alt} width={size} height={size} style={{ ...box, objectFit: 'cover' }} />
  ) : (
    <div style={{ ...box, backgroundColor: '#e8e6df' }} />
  )
}

function LineRow({
  line,
  upgrade,
  ctx,
}: {
  line: EmailLine
  upgrade: boolean
  ctx: RenderContext
}) {
  const { small } = layoutStyles(ctx.theme)
  const { navy, subtle, success } = ctx.theme.colors
  const size = upgrade ? 44 : 56
  return (
    <Row>
      <Column style={{ width: size + 12, verticalAlign: 'top', paddingTop: 2 }}>
        <Thumbnail src={line.thumbnail} alt={line.title} size={size} />
      </Column>
      <Column style={{ verticalAlign: 'top', fontSize: 14, lineHeight: 1.5, color: navy }}>
        {upgrade && (
          <Text
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: subtle,
            }}
          >
            Do zestawu
          </Text>
        )}
        <Text style={{ margin: 0, fontSize: 14, fontWeight: 700, color: navy }}>{line.title}</Text>
        <Text style={small}>
          {[
            line.variant,
            line.replaces ? `zamiast ${line.replaces}` : null,
            // A non-breaking space keeps „1 szt.” together on phones.
            `${line.quantity} szt.`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {line.discountLabel && (
          <Text style={{ margin: 0, fontSize: 12, fontWeight: 700, color: success }}>
            {line.discountLabel}
          </Text>
        )}
      </Column>
      <Column style={{ verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <Text style={{ margin: 0, fontSize: 14, fontWeight: 700, color: navy }}>
          {formatPrice(line.total)}
        </Text>
        {line.originalTotal > line.total && (
          <Text
            className={WAS_PRICE}
            style={{ margin: 0, fontSize: 12, color: subtle, textDecoration: 'line-through' }}
          >
            {formatPrice(line.originalTotal)}
          </Text>
        )}
      </Column>
    </Row>
  )
}

function SumRow({
  label,
  value,
  style,
  ctx,
}: {
  label: string
  value: string
  style?: CSSProperties
  ctx: RenderContext
}) {
  return (
    <Row className={SUM_ROW} style={{ fontSize: 14, color: ctx.theme.colors.navy, ...style }}>
      <Column style={{ padding: '4px 0' }}>{label}</Column>
      <Column style={{ padding: '4px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {value}
      </Column>
    </Row>
  )
}

/** „Dziękujemy za zamówienie” (spec 3c §4.3, mock-up `mail-potwierdzenie.html`). */
export function OrderPlacedEmail({
  data,
  ctx,
}: {
  data: OrderPlacedEmailData
  ctx: RenderContext
}) {
  const { card, cardTitle, pageTitle, small, text } = layoutStyles(ctx.theme)
  const { line: rule, muted, sand, success } = ctx.theme.colors
  const { totals } = data

  return (
    <EmailLayout
      ctx={ctx}
      preview={PREVIEW}
      shopUrl={data.shopUrl}
      seller={data.seller}
      reason={`Ten mail wysłaliśmy, bo w sklepie ${ctx.theme.shopName} złożono zamówienie z tym adresem e-mail.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          Dziękujemy za zamówienie!
        </Heading>
        <Text style={text}>
          {data.firstName ? `Cześć ${data.firstName}, p` : 'Dzień dobry, p'}
          rzyjęliśmy Twoje zamówienie <strong>#{data.displayId}</strong> z {data.placedAt}. Poniżej
          znajdziesz jego podsumowanie.
        </Text>
        <Text style={small}>Fakturę wyślemy w osobnym e-mailu po zaksięgowaniu płatności.</Text>
      </Card>

      <Card ctx={ctx} title="Twoje zamówienie">
        {data.groups.map((group) => (
          <Section key={`${group.line.title}-${group.line.total}`} style={{ marginBottom: 10 }}>
            <LineRow ctx={ctx} line={group.line} upgrade={false} />
            {group.upgrades.map((upgrade) => (
              // Indent with padding on a wrapper – a margin would push the box out of the card.
              <Section
                key={`${upgrade.title}-${upgrade.total}`}
                style={{ padding: '8px 0 0 14px' }}
              >
                <Section style={{ backgroundColor: sand, borderRadius: 10, padding: 10 }}>
                  <LineRow ctx={ctx} line={upgrade} upgrade />
                </Section>
              </Section>
            ))}
          </Section>
        ))}
        <Section style={{ borderTop: `1px solid ${rule}`, marginTop: 8, paddingTop: 8 }}>
          <SumRow ctx={ctx} label="Wartość produktów" value={formatPrice(totals.products)} />
          {totals.discounts > 0 && (
            <SumRow
              ctx={ctx}
              label="Rabaty"
              value={`−${formatPrice(totals.discounts)}`}
              style={{ color: success, fontWeight: 700 }}
            />
          )}
          <SumRow
            ctx={ctx}
            label={`Dostawa · ${totals.shippingMethod}`}
            value={formatPrice(totals.shipping)}
          />
        </Section>
        <Section style={{ borderTop: `1px solid ${rule}`, marginTop: 8, paddingTop: 8 }}>
          <SumRow
            ctx={ctx}
            label="Razem"
            value={formatPrice(totals.total)}
            style={{ fontSize: 17, fontWeight: 700 }}
          />
          <SumRow
            ctx={ctx}
            label="w tym VAT"
            value={formatPrice(totals.tax)}
            style={{ fontSize: 13, color: muted }}
          />
        </Section>
      </Card>

      {(data.delivery || data.invoice) && (
        <Section style={card}>
          <Row>
            {data.delivery && (
              <Column className="stack" style={{ verticalAlign: 'top', paddingRight: 12 }}>
                <Heading as="h2" style={cardTitle}>
                  Dostawa
                </Heading>
                <Text style={{ ...text, fontWeight: 700 }}>{data.delivery.method}</Text>
                {data.delivery.lines.map((line) => (
                  <Text key={line} style={small}>
                    {line}
                  </Text>
                ))}
                {data.delivery.note && <Text style={NOTE_STYLE}>{data.delivery.note}</Text>}
              </Column>
            )}
            {data.invoice && (
              <Column className="stack" style={{ verticalAlign: 'top' }}>
                <Heading as="h2" style={cardTitle}>
                  Dane do faktury
                </Heading>
                {data.invoice.company && (
                  <Text style={{ ...text, fontWeight: 700 }}>{data.invoice.company}</Text>
                )}
                {data.invoice.nip && <Text style={small}>NIP {data.invoice.nip}</Text>}
                {data.invoice.lines.map((line) => (
                  <Text key={line} style={small}>
                    {line}
                  </Text>
                ))}
              </Column>
            )}
          </Row>
        </Section>
      )}

      {data.customerNote && (
        <Section style={card}>
          <Heading as="h2" style={cardTitle}>
            Uwagi do zamówienia
          </Heading>
          {data.customerNote.split('\n').map((line, index) => (
            // Lines of one note never reorder.
            // biome-ignore lint/suspicious/noArrayIndexKey: static text split by line
            <Text key={index} style={{ ...small, margin: 0 }}>
              {line}
            </Text>
          ))}
        </Section>
      )}

      <ContactCard ctx={ctx} contact={data.contact} />
    </EmailLayout>
  )
}
