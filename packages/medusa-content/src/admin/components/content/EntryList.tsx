import { Badge, Button, Container, Heading, Table, Text } from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { sdk } from '../../lib/sdk'
import { contentKey } from './api'

export interface ListedEntry {
  id: string
  type: string
  slug: string | null
  title: string
  status: 'draft' | 'published'
  has_draft: boolean
  legal_review: boolean
  category: string | null
  order: number | null
  published_at: string | null
  updated_at: string
}

export const useEntries = (type: string) =>
  useQuery({
    queryKey: contentKey('list', type),
    queryFn: () =>
      sdk.client.fetch<{ entries: ListedEntry[] }>(`/admin/content/entries?type=${type}`),
  })

export function StatusBadge({ entry }: { entry: Pick<ListedEntry, 'status' | 'has_draft'> }) {
  if (entry.status === 'draft')
    return (
      <Badge color="orange" size="small">
        Szkic
      </Badge>
    )
  if (entry.has_draft)
    return (
      <Badge color="blue" size="small">
        Zmiany nieopublikowane
      </Badge>
    )
  return (
    <Badge color="green" size="small">
      Opublikowana
    </Badge>
  )
}

/** Table of pages or articles with a „Nowa” button; a row opens the editor. */
export function EntryList(props: {
  type: 'page' | 'article'
  title: string
  description: string
  basePath: string
  extra?: (entry: ListedEntry) => ReactNode
  actions?: ReactNode
}) {
  const navigate = useNavigate()
  const entries = useEntries(props.type)
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>{props.title}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {props.description}
          </Text>
        </div>
        <div className="flex gap-2">
          {props.actions}
          <Button size="small" onClick={() => navigate(`${props.basePath}/nowa`)}>
            Nowa
          </Button>
        </div>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Tytuł</Table.HeaderCell>
            <Table.HeaderCell>Adres</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Zmiana</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(entries.data?.entries ?? []).map((entry) => (
            <Table.Row
              key={entry.id}
              className="cursor-pointer"
              onClick={() => navigate(`${props.basePath}/${entry.id}`)}
            >
              <Table.Cell>
                <div className="flex items-center gap-2">
                  {entry.title}
                  {props.extra?.(entry)}
                </div>
              </Table.Cell>
              <Table.Cell className="text-ui-fg-subtle">{entry.slug ?? '—'}</Table.Cell>
              <Table.Cell>
                <StatusBadge entry={entry} />
              </Table.Cell>
              <Table.Cell className="text-ui-fg-subtle">
                {new Date(entry.updated_at).toLocaleString('pl-PL', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {entries.data?.entries.length === 0 ? (
        <Text size="small" className="px-6 py-4">
          Brak dokumentów.
        </Text>
      ) : null}
    </Container>
  )
}
