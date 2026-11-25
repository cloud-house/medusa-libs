import { defineRouteConfig } from '@medusajs/admin-sdk'
import { Button } from '@medusajs/ui'
import { useNavigate } from 'react-router-dom'
import { EntryList } from '../../../components/content/EntryList'

const ArticlesPage = () => {
  const navigate = useNavigate()
  return (
    <EntryList
      type="article"
      title="Poradnik"
      description="Artykuły pod adresem /poradnik/{adres}. Do publikacji potrzebne są kategoria, wstęp i zdjęcie główne."
      basePath="/tresci/poradnik"
      actions={
        <Button
          size="small"
          variant="secondary"
          onClick={() => navigate('/tresci/poradnik/kategorie')}
        >
          Kategorie
        </Button>
      }
    />
  )
}

export const config = defineRouteConfig({ label: 'Poradnik' })

export default ArticlesPage
