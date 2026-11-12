import { defineRouteConfig } from '@medusajs/admin-sdk'
import { Buildings } from '@medusajs/icons'
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Table,
  Text,
  toast,
  usePrompt,
} from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BrandMessages } from '../../../messages'
import { type BrandWithCount, brandKey, failure, fill, useBrandMessages } from '../../lib/messages'
import { sdk } from '../../lib/sdk'

function BrandDrawer({
  brand,
  messages,
  onClose,
}: {
  brand: BrandWithCount | 'new' | null
  messages: BrandMessages
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')

  useEffect(() => {
    setName(brand && brand !== 'new' ? brand.name : '')
    setHandle(brand && brand !== 'new' ? brand.handle : '')
  }, [brand])

  const save = useMutation({
    mutationFn: () => {
      const body = { name, ...(handle.trim() ? { handle: handle.trim() } : {}) }
      return brand && brand !== 'new'
        ? sdk.client.fetch(`/admin/brands/${brand.id}`, { method: 'POST', body })
        : sdk.client.fetch('/admin/brands', { method: 'POST', body })
    },
    onSuccess: () => {
      toast.success(messages.saved)
      queryClient.invalidateQueries({ queryKey: brandKey('list') })
      onClose()
    },
    onError: (error) => toast.error(failure(error, messages)),
  })

  return (
    <Drawer open={brand !== null} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{brand === 'new' ? messages.newBrand : messages.editBrand}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand-name">{messages.fieldName}</Label>
            <Input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand-handle">{messages.fieldHandle}</Label>
            <Input
              id="brand-handle"
              value={handle}
              placeholder={messages.handlePlaceholder}
              onChange={(e) => setHandle(e.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {fill(messages.handleHint, { handle: handle || '…' })}
            </Text>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">{messages.cancel}</Button>
          </Drawer.Close>
          <Button onClick={() => save.mutate()} isLoading={save.isPending}>
            {messages.save}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/** Brands: list with product counts, create, edit, delete; the brand of a product is set on its page. */
const BrandsPage = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const prompt = usePrompt()
  const messages = useBrandMessages()
  const [editing, setEditing] = useState<BrandWithCount | 'new' | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: brandKey('list'),
    queryFn: () => sdk.client.fetch<{ brands: BrandWithCount[]; count: number }>('/admin/brands'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => sdk.client.fetch(`/admin/brands/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (messages) toast.success(messages.deleted)
      queryClient.invalidateQueries({ queryKey: brandKey('list') })
    },
    onError: (error) => messages && toast.error(failure(error, messages)),
  })

  // The texts come from the plugin options; nothing is shown in the wrong language meanwhile.
  if (!messages) return <Container className="p-0" />

  const confirmDelete = async (brand: BrandWithCount) => {
    const confirmed = await prompt({
      title: fill(messages.deleteTitle, { name: brand.name }),
      description:
        brand.product_count > 0
          ? fill(messages.deleteDescription, { count: brand.product_count })
          : messages.deleteDescriptionEmpty,
      confirmText: messages.deleteConfirm,
      cancelText: messages.cancel,
    })
    if (confirmed) remove.mutate(brand.id)
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">{messages.adminTitle}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {messages.adminDescription}
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setEditing('new')}>
          {messages.addBrand}
        </Button>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{messages.columnName}</Table.HeaderCell>
            <Table.HeaderCell>{messages.columnHandle}</Table.HeaderCell>
            <Table.HeaderCell className="text-right">{messages.columnProducts}</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data?.brands ?? []).map((brand) => (
            <Table.Row key={brand.id}>
              <Table.Cell>{brand.name}</Table.Cell>
              <Table.Cell className="font-mono">{brand.handle}</Table.Cell>
              <Table.Cell className="text-right">{brand.product_count}</Table.Cell>
              <Table.Cell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="small"
                    variant="transparent"
                    onClick={() => navigate(`/brands/${brand.id}`)}
                  >
                    {messages.details}
                  </Button>
                  <Button size="small" variant="transparent" onClick={() => setEditing(brand)}>
                    {messages.edit}
                  </Button>
                  <Button size="small" variant="transparent" onClick={() => confirmDelete(brand)}>
                    {messages.delete}
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!isLoading && data?.count === 0 && (
        <Text className="px-6 py-4 text-ui-fg-subtle">{messages.empty}</Text>
      )}
      <BrandDrawer brand={editing} messages={messages} onClose={() => setEditing(null)} />
    </Container>
  )
}

// The menu label is fixed when the panel is built, before the options are known.
export const config = defineRouteConfig({ label: 'Marki', icon: Buildings })

export default BrandsPage
