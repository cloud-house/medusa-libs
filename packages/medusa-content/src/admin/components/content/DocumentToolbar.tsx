import { Badge, Button, Drawer, Input, Label, Text, toast, usePrompt } from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { sdk } from '../../lib/sdk'
import { contentKey, type EntryResponse, failure, type Version } from './api'
import type { EntryEditor } from './useEntryEditor'

const time = (value: string | Date) =>
  new Date(value).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })

function statusBadge(editor: EntryEditor) {
  const entry = editor.entry
  if (!entry) return <Badge color="grey">Nowa – niezapisana</Badge>
  if (entry.status === 'draft') return <Badge color="orange">Szkic</Badge>
  if (entry.draft || editor.dirty) return <Badge color="blue">Zmiany nieopublikowane</Badge>
  return <Badge color="green">Opublikowana</Badge>
}

/** History of an entry: who saved when, a look at a version and „Przywróć”. */
export function VersionsDrawer(props: {
  entryId: string
  open: boolean
  onClose: () => void
  onRestored: (response: EntryResponse) => void
  /** Legal pages: „which version applied on a date”. */
  byDate?: boolean
}) {
  const prompt = usePrompt()
  const [at, setAt] = useState('')
  const [shown, setShown] = useState<Version | null>(null)
  const versions = useQuery({
    queryKey: contentKey('versions', props.entryId, at),
    queryFn: () =>
      sdk.client.fetch<{ versions: Version[] }>(
        `/admin/content/entries/${props.entryId}/versions${at ? `?at=${new Date(`${at}T23:59:59`).toISOString()}` : ''}`,
      ),
    enabled: props.open,
  })
  const restore = async (version: Version) => {
    const ok = await prompt({
      title: 'Przywrócić tę wersję?',
      description: 'Trafi do wersji roboczej – sklep pokaże ją dopiero po publikacji.',
      confirmText: 'Przywróć',
      cancelText: 'Anuluj',
    })
    if (!ok) return
    try {
      const response = await sdk.client.fetch<EntryResponse>(
        `/admin/content/versions/${version.id}/restore`,
        {
          method: 'POST',
        },
      )
      toast.success('Przywrócono wersję')
      props.onRestored(response)
      props.onClose()
    } catch (error) {
      toast.error(failure(error))
    }
  }
  return (
    <Drawer open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <Drawer.Content className="max-w-xl">
        <Drawer.Header>
          <Drawer.Title>Historia wersji</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
          {props.byDate ? (
            <div className="flex flex-col gap-1.5">
              <Label size="small">Wersja obowiązująca w dniu</Label>
              <Input type="date" value={at} onChange={(e) => setAt(e.target.value)} />
            </div>
          ) : null}
          {(versions.data?.versions ?? []).map((version) => (
            <div
              key={version.id}
              className="shadow-elevation-card-rest flex items-center justify-between gap-3 rounded-lg p-3"
            >
              <div className="flex flex-col">
                <Text size="small" weight="plus">
                  {time(version.created_at)}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {version.status === 'published'
                    ? 'Publikacja'
                    : version.autosave
                      ? 'Autozapis'
                      : 'Szkic'}
                </Text>
              </div>
              <div className="flex gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setShown(shown?.id === version.id ? null : version)}
                >
                  {shown?.id === version.id ? 'Ukryj' : 'Pokaż'}
                </Button>
                <Button size="small" variant="secondary" onClick={() => restore(version)}>
                  Przywróć
                </Button>
              </div>
            </div>
          ))}
          {versions.data?.versions.length === 0 ? <Text size="small">Brak wersji.</Text> : null}
          {shown ? (
            <pre className="bg-ui-bg-subtle txt-compact-xsmall max-h-96 overflow-auto rounded p-3">
              {JSON.stringify(shown.snapshot, null, 2)}
            </pre>
          ) : null}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}

/** Status, autosave note and the document actions over every content editor. */
export function DocumentToolbar(props: {
  editor: EntryEditor
  title: string
  drafts: boolean
  preview?: { target: 'page' | 'article' | 'home' }
  /** Legal pages cannot be unpublished. */
  canUnpublish?: boolean
  byDate?: boolean
  versions?: boolean
}) {
  const { editor } = props
  const [history, setHistory] = useState(false)
  const busy = editor.saving !== null
  /** The shop tab opened by „Podgląd” – refreshed after every save of the working copy. */
  const preview = useRef<{ window: Window; origin: string } | null>(null)
  useEffect(() => {
    const target = preview.current
    if (!editor.lastSaved || !target || target.window.closed) return
    target.window.postMessage({ type: 'content:preview-refresh' }, target.origin)
  }, [editor.lastSaved])
  const openPreview = async () => {
    try {
      // Unsaved edits first – a failed save must not open a preview of the previous copy.
      if (editor.dirty && !(await editor.save('autosave'))) return
      const { url } = await sdk.client.fetch<{ url: string }>('/admin/content/preview', {
        method: 'POST',
        body: { target: props.preview?.target, id: editor.entry?.id },
      })
      const opened = window.open(url, 'content-preview')
      if (opened) preview.current = { window: opened, origin: new URL(url).origin }
    } catch (error) {
      toast.error(failure(error))
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Text size="large" weight="plus">
            {props.title}
          </Text>
          {statusBadge(editor)}
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {editor.blocked
            ? 'Ktoś zmienił tę treść w międzyczasie – odśwież, żeby nie nadpisać jego zmian.'
            : editor.saving === 'autosave'
              ? 'Zapisywanie…'
              : editor.lastSaved
                ? `Zapisano ${time(editor.lastSaved)}`
                : editor.entry
                  ? `Ostatnia zmiana ${time(editor.entry.updated_at)}`
                  : 'Zapisz, żeby utworzyć dokument.'}
        </Text>
      </div>
      <div className="flex flex-wrap gap-2">
        {editor.blocked ? (
          <Button size="small" variant="secondary" onClick={() => editor.reload()}>
            Odśwież
          </Button>
        ) : null}
        {props.versions && editor.entry ? (
          <Button size="small" variant="secondary" onClick={() => setHistory(true)}>
            Historia
          </Button>
        ) : null}
        {props.preview && editor.entry ? (
          <Button size="small" variant="secondary" onClick={openPreview}>
            Podgląd
          </Button>
        ) : null}
        {props.drafts && editor.entry?.status === 'published' && props.canUnpublish !== false ? (
          <Button
            size="small"
            variant="secondary"
            isLoading={editor.saving === 'unpublish'}
            disabled={busy}
            onClick={() => editor.unpublish()}
          >
            Wycofaj z publikacji
          </Button>
        ) : null}
        {props.drafts ? (
          <Button
            size="small"
            variant="secondary"
            isLoading={editor.saving === 'draft'}
            disabled={busy || editor.blocked}
            onClick={() => editor.save('draft')}
          >
            Zapisz szkic
          </Button>
        ) : null}
        <Button
          size="small"
          isLoading={editor.saving === 'publish'}
          disabled={busy || editor.blocked}
          onClick={() => editor.save('publish')}
        >
          {props.drafts ? 'Opublikuj' : 'Zapisz'}
        </Button>
      </div>
      {props.versions && editor.entry ? (
        <VersionsDrawer
          entryId={editor.entry.id}
          open={history}
          byDate={props.byDate}
          onClose={() => setHistory(false)}
          onRestored={(response) => editor.load(response)}
        />
      ) : null}
    </div>
  )
}
