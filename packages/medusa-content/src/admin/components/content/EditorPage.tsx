import { Button, Container, Text, toast, usePrompt } from '@medusajs/ui'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { sdk } from '../../lib/sdk'
import { contentKey, failure } from './api'
import type { EntryEditor } from './useEntryEditor'

/** Frame of a document editor: loading and error states, the form, the delete action. */
export function EditorPage(props: {
  editor: EntryEditor
  toolbar: ReactNode
  children: ReactNode
  /** Where to go after deleting; `undefined` – no delete. */
  deleteTo?: string
  deleteLabel?: string
}) {
  const navigate = useNavigate()
  const prompt = usePrompt()
  const queryClient = useQueryClient()
  const { editor } = props
  if (editor.loading) return <Container className="p-6">Wczytywanie…</Container>
  if (editor.error)
    return <Container className="p-6 text-ui-fg-error">{failure(editor.error)}</Container>
  if (!editor.data) return null
  const remove = async () => {
    if (!editor.entry) return
    const ok = await prompt({
      title: 'Usunąć na stałe?',
      description: 'Dokument i jego historia znikną, a stary adres przestanie działać.',
      confirmText: 'Usuń',
      cancelText: 'Anuluj',
    })
    if (!ok) return
    try {
      await sdk.client.fetch(`/admin/content/entries/${editor.entry.id}`, { method: 'DELETE' })
      toast.success('Usunięto')
      queryClient.invalidateQueries({ queryKey: contentKey('list') })
      if (props.deleteTo) navigate(props.deleteTo)
    } catch (error) {
      toast.error(failure(error))
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">{props.toolbar}</Container>
      <Container className="flex flex-col gap-5 p-6">{props.children}</Container>
      {props.deleteTo && editor.entry ? (
        <Container className="flex items-center justify-between p-6">
          <Text size="small" className="text-ui-fg-subtle">
            {props.deleteLabel ?? 'Usunięcie jest nieodwracalne.'}
          </Text>
          <Button size="small" variant="danger" onClick={remove}>
            Usuń
          </Button>
        </Container>
      ) : null}
    </div>
  )
}
