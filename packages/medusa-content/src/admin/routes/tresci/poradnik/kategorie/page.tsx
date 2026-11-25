import { slugify } from '@cloud-house/commerce-rules'
import { Button, Container, Drawer, Heading, Table, Text, toast, usePrompt } from '@medusajs/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  contentKey,
  type Data,
  type EntryResponse,
  failure,
} from '../../../../components/content/api'
import { useEntries } from '../../../../components/content/EntryList'
import { NumberField, str, TextField } from '../../../../components/content/fields'
import { sdk } from '../../../../lib/sdk'

type Editing = { id: string | null; data: Data; updatedAt: string | null }

/** Poradnik categories – saved at once (no drafts); a category with articles cannot be deleted. */
const ArticleCategoriesPage = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const categories = useEntries('article_category')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saving, setSaving] = useState(false)

  const open = async (id: string | null) => {
    if (!id)
      return setEditing({
        id: null,
        data: { name: '', slug: '', description: '', order: 100 },
        updatedAt: null,
      })
    const { entry } = await sdk.client.fetch<EntryResponse>(`/admin/content/entries/${id}`)
    setEditing({ id, data: { ...(entry?.data ?? {}) }, updatedAt: entry?.updated_at ?? null })
  }
  useEffect(() => {
    if (editing && !editing.id && !editing.data.slugEdited) {
      const slug = slugify(str(editing.data.name))
      if (slug !== editing.data.slug) setEditing({ ...editing, data: { ...editing.data, slug } })
    }
  }, [editing])

  const save = async () => {
    if (!editing) return
    setSaving(true)
    const { slugEdited: _edited, ...data } = editing.data
    try {
      await sdk.client.fetch(
        editing.id ? `/admin/content/entries/${editing.id}` : '/admin/content/entries',
        {
          method: 'POST',
          body: {
            mode: 'publish',
            data,
            expected_updated_at: editing.updatedAt,
            ...(editing.id ? {} : { type: 'article_category' }),
          },
        },
      )
      toast.success('Zapisano kategorię')
      queryClient.invalidateQueries({ queryKey: contentKey('list') })
      setEditing(null)
    } catch (error) {
      toast.error(failure(error))
    } finally {
      setSaving(false)
    }
  }
  const remove = async (id: string) => {
    const ok = await prompt({
      title: 'Usunąć kategorię?',
      description: 'Tylko kategorię bez artykułów.',
      confirmText: 'Usuń',
      cancelText: 'Anuluj',
    })
    if (!ok) return
    try {
      await sdk.client.fetch(`/admin/content/entries/${id}`, { method: 'DELETE' })
      toast.success('Usunięto kategorię')
      queryClient.invalidateQueries({ queryKey: contentKey('list') })
    } catch (error) {
      toast.error(failure(error))
    }
  }
  const set = (patch: Data) =>
    editing && setEditing({ ...editing, data: { ...editing.data, ...patch } })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Kategorie Poradnika</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Pigułka kategorii pojawia się w sklepie, gdy kategoria ma opublikowany artykuł.
          </Text>
        </div>
        <Button size="small" onClick={() => open(null)}>
          Nowa kategoria
        </Button>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Nazwa</Table.HeaderCell>
            <Table.HeaderCell>Adres</Table.HeaderCell>
            <Table.HeaderCell>Kolejność</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(categories.data?.entries ?? [])
            .slice()
            .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
            .map((category) => (
              <Table.Row key={category.id}>
                <Table.Cell>{category.title}</Table.Cell>
                <Table.Cell className="text-ui-fg-subtle">{category.slug}</Table.Cell>
                <Table.Cell>{category.order ?? '—'}</Table.Cell>
                <Table.Cell className="flex justify-end gap-2">
                  <Button size="small" variant="secondary" onClick={() => open(category.id)}>
                    Edytuj
                  </Button>
                  <Button size="small" variant="transparent" onClick={() => remove(category.id)}>
                    Usuń
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
        </Table.Body>
      </Table>
      <Drawer open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{editing?.id ? 'Edytuj kategorię' : 'Nowa kategoria'}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            <TextField
              label="Nazwa"
              value={editing?.data.name}
              onChange={(name) => set({ name })}
            />
            <TextField
              label="Adres"
              value={editing?.data.slug}
              hint={`/poradnik/kategoria/${str(editing?.data.slug) || '…'}`}
              onChange={(slug) => set({ slug, slugEdited: true })}
            />
            <TextField
              label="Opis"
              value={editing?.data.description}
              multiline
              onChange={(description) => set({ description })}
            />
            <NumberField
              label="Kolejność"
              value={editing?.data.order}
              hint="Mniejsza liczba – wcześniej."
              onChange={(order) => set({ order })}
            />
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Anuluj</Button>
            </Drawer.Close>
            <Button isLoading={saving} onClick={save}>
              Zapisz
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export default ArticleCategoriesPage
