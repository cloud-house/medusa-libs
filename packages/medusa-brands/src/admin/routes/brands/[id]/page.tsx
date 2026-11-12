import { Container, Heading, Text } from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { type Brand, brandKey, useBrandMessages } from '../../../lib/messages'
import { sdk } from '../../../lib/sdk'

/** One brand: name and handle. A shop that keeps more about its brands (logos, texts) adds widgets. */
const BrandDetailPage = () => {
  const { id } = useParams()
  const messages = useBrandMessages()
  const brand = useQuery({
    queryKey: brandKey('detail', id ?? ''),
    queryFn: () => sdk.client.fetch<{ brand: Brand }>(`/admin/brands/${id}`),
  })
  if (!messages) return <Container className="p-0" />
  if (!brand.data) return <Text size="small">{messages.loading}</Text>
  return (
    <Container className="flex flex-col gap-2 px-6 py-4">
      <Heading level="h1">{brand.data.brand.name}</Heading>
      <Text size="small" className="font-mono text-ui-fg-subtle">
        {brand.data.brand.handle}
      </Text>
    </Container>
  )
}

export default BrandDetailPage
