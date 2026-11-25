import { defineRouteConfig } from '@medusajs/admin-sdk'
import { DocumentText } from '@medusajs/icons'
import { Container, Heading, Text } from '@medusajs/ui'
import { Link } from 'react-router-dom'
import { type HubSection, hubSections } from '../../lib/ui-registry'

/** What the plugin offers; a shop adds its own tiles with `registerHubSection` (admin-kit). */
const SECTIONS: HubSection[] = [
  {
    to: '/tresci/strony',
    title: 'Strony',
    text: 'Regulamin, polityka prywatności, dostawa i zwroty, kontakt i inne.',
  },
  { to: '/tresci/poradnik', title: 'Poradnik', text: 'Artykuły i kategorie Poradnika.' },
  {
    to: '/tresci/strona-glowna',
    title: 'Strona główna',
    text: 'Bloki strony głównej z podglądem.',
  },
  { to: '/tresci/uklad', title: 'Układ strony', text: 'Menu, pasek ogłoszeń i stopka.' },
  { to: '/tresci/media', title: 'Media', text: 'Zdjęcia i pliki PDF używane w treściach.' },
]

/** Content hub; product, category and brand content are edited on their own Medusa pages. */
const ContentHubPage = () => (
  <Container className="flex flex-col gap-6 p-6">
    <div>
      <Heading>Treści sklepu</Heading>
      <Text size="small" className="text-ui-fg-subtle">
        Treści kart produktów, stron kategorii i marek edytujesz na stronach produktu, kategorii i
        marki (jeśli sklep je zarejestrował).
      </Text>
    </div>
    <div className="grid grid-cols-2 gap-4">
      {[...SECTIONS, ...hubSections()].map((section) => (
        <Link
          key={section.to}
          to={section.to}
          className="shadow-elevation-card-rest hover:shadow-elevation-card-hover rounded-lg p-4"
        >
          <Text weight="plus">{section.title}</Text>
          <Text size="small" className="text-ui-fg-subtle">
            {section.text}
          </Text>
        </Link>
      ))}
    </div>
  </Container>
)

export const config = defineRouteConfig({ label: 'Treści', icon: DocumentText })

export default ContentHubPage
