import { defineRouteConfig } from '@medusajs/admin-sdk'
import { EnvelopeSolid } from '@medusajs/icons'
import { Button, Container, Heading, Input, Table, Text, toast, usePrompt } from '@medusajs/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { messages as dictionaries } from '../../../messages'
import { failure, fill, newsletterKey, useNewsletterMessages } from '../../lib/messages'
import { sdk } from '../../lib/sdk'

type Subscriber = {
  id: string
  email: string
  source: string
  consent_at: string
  consent_text: string
}

/** Newsletter sign-ups (proof of consent): search, CSV for the e-mail provider, GDPR delete. */
const NewsletterPage = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const messages = useNewsletterMessages()
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const list = useQuery({
    queryKey: newsletterKey('subscribers', q, String(offset)),
    queryFn: () =>
      sdk.client.fetch<{ subscribers: Subscriber[]; count: number; limit: number }>(
        `/admin/newsletter-subscribers?limit=50&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  })
  // The texts come from the plugin options; nothing is shown in the wrong language meanwhile.
  if (!messages) return <Container className="p-0" />
  const download = async () => {
    try {
      const response = await fetch('/admin/newsletter-subscribers/export', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error(messages.downloadFailed)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(failure(error, messages))
    }
  }
  const remove = async (subscriber: Subscriber) => {
    const ok = await prompt({
      title: fill(messages.deleteTitle, { email: subscriber.email }),
      description: messages.deleteDescription,
      confirmText: messages.deleteConfirm,
      cancelText: messages.deleteCancel,
    })
    if (!ok) return
    try {
      await sdk.client.fetch(`/admin/newsletter-subscribers/${subscriber.id}`, { method: 'DELETE' })
      toast.success(messages.deleted)
      queryClient.invalidateQueries({ queryKey: newsletterKey('subscribers') })
    } catch (error) {
      toast.error(failure(error, messages))
    }
  }
  const count = list.data?.count ?? 0
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>{messages.adminTitle}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {fill(messages.adminDescription, { count })}
          </Text>
        </div>
        <div className="flex gap-2">
          <Input
            size="small"
            placeholder={messages.searchPlaceholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOffset(0)
            }}
          />
          <Button size="small" variant="secondary" onClick={download}>
            {messages.downloadCsv}
          </Button>
        </div>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{messages.columnEmail}</Table.HeaderCell>
            <Table.HeaderCell>{messages.columnSource}</Table.HeaderCell>
            <Table.HeaderCell>{messages.columnConsentDate}</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(list.data?.subscribers ?? []).map((subscriber) => (
            <Table.Row key={subscriber.id}>
              <Table.Cell title={subscriber.consent_text}>{subscriber.email}</Table.Cell>
              <Table.Cell>
                {messages.sourceLabels[subscriber.source] ?? subscriber.source}
              </Table.Cell>
              <Table.Cell>
                {new Date(subscriber.consent_at).toLocaleString(messages.dateLocale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Table.Cell>
              <Table.Cell className="text-right">
                <Button size="small" variant="transparent" onClick={() => remove(subscriber)}>
                  {messages.deleteButton}
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <div className="flex justify-end gap-2 px-6 py-3">
        <Button
          size="small"
          variant="secondary"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          {messages.previous}
        </Button>
        <Button
          size="small"
          variant="secondary"
          disabled={offset + 50 >= count}
          onClick={() => setOffset(offset + 50)}
        >
          {messages.next}
        </Button>
      </div>
    </Container>
  )
}

// The menu label is fixed when the panel is built, before the options are known.
export const config = defineRouteConfig({
  label: dictionaries.pl.adminTitle,
  icon: EnvelopeSolid,
})

export default NewsletterPage
