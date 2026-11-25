import { defineRouteConfig } from '@medusajs/admin-sdk'
import { Badge } from '@medusajs/ui'
import { EntryList } from '../../../components/content/EntryList'

const PagesPage = () => (
  <EntryList
    type="page"
    title="Strony"
    description="Strony informacyjne pod adresem /{adres}. Regulaminu i polityki prywatności nie można usunąć ani przenieść."
    basePath="/tresci/strony"
    extra={(entry) =>
      entry.legal_review ? (
        <Badge size="2xsmall" color="red">
          Weryfikacja prawna
        </Badge>
      ) : null
    }
  />
)

export const config = defineRouteConfig({ label: 'Strony' })

export default PagesPage
