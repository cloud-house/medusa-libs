import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types'
import { Button, Container, Heading, Select, Text, toast } from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { type Brand, brandKey, failure, useBrandMessages } from '../lib/messages'
import { sdk } from '../lib/sdk'

const NONE = '__none__'

const ProductBrandWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient()
  const messages = useBrandMessages()
  const productBrandKey = brandKey('product-brand', product.id)
  const brands = useQuery({
    queryKey: brandKey('list'),
    queryFn: () => sdk.client.fetch<{ brands: Brand[] }>('/admin/brands'),
  })
  const current = useQuery({
    queryKey: productBrandKey,
    queryFn: () => sdk.client.fetch<{ brand: Brand | null }>(`/admin/products/${product.id}/brand`),
  })
  const [value, setValue] = useState(NONE)

  useEffect(() => {
    setValue(current.data?.brand?.id ?? NONE)
  }, [current.data])

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}/brand`, {
        method: 'POST',
        body: { brand_id: value === NONE ? null : value },
      }),
    onSuccess: () => {
      if (messages) toast.success(messages.saved)
      queryClient.invalidateQueries({ queryKey: productBrandKey })
      queryClient.invalidateQueries({ queryKey: brandKey('list') })
    },
    onError: (error) => messages && toast.error(failure(error, messages)),
  })

  // The texts come from the plugin options; nothing is shown in the wrong language meanwhile.
  if (!messages) return <Container className="p-0" />
  const changed = value !== (current.data?.brand?.id ?? NONE)

  return (
    <Container className="flex flex-col gap-3 px-6 py-4">
      <Heading level="h2">{messages.widgetTitle}</Heading>
      <Select value={value} onValueChange={setValue}>
        <Select.Trigger>
          <Select.Value placeholder={messages.widgetPlaceholder} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={NONE}>{messages.widgetNone}</Select.Item>
          {(brands.data?.brands ?? []).map((brand) => (
            <Select.Item key={brand.id} value={brand.id}>
              {brand.name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
      {brands.data?.brands.length === 0 && (
        <Text size="small" className="text-ui-fg-subtle">
          {messages.widgetEmpty}
        </Text>
      )}
      <Button
        size="small"
        variant="secondary"
        className="self-end"
        disabled={!changed}
        isLoading={save.isPending}
        onClick={() => save.mutate()}
      >
        {messages.save}
      </Button>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: 'product.details.side.after' })

export default ProductBrandWidget
