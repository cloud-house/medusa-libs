import { slugify } from '@cloud-house/commerce-rules'
import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Data } from '../../../../components/content/api'
import { DocumentToolbar } from '../../../../components/content/DocumentToolbar'
import { fromDateInput, toDateInput } from '../../../../components/content/dates'
import { EditorPage } from '../../../../components/content/EditorPage'
import { Field, NumberField, str, TextField, Toggle } from '../../../../components/content/fields'
import { PAGE_EDITOR, RichTextEditor } from '../../../../components/content/lexical/RichTextEditor'
import { useEntryEditor } from '../../../../components/content/useEntryEditor'

const NEW_PAGE = (): Data => ({
  title: '',
  slug: '',
  lead: '',
  content: null,
  legalReview: false,
  inInfoNav: true,
  navOrder: 100,
})

const PageEditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'nowa'
  const editor = useEntryEditor({
    url: isNew ? null : `/admin/content/entries/${id}`,
    create: { url: '/admin/content/entries', type: 'page' },
    drafts: true,
    initial: useCallback(NEW_PAGE, []),
    onCreated: (entry) => navigate(`/tresci/strony/${entry.id}`, { replace: true }),
  })
  const data = editor.data ?? {}
  const protectedPage = editor.protectedEntry
  return (
    <EditorPage
      editor={editor}
      deleteTo={protectedPage ? undefined : '/tresci/strony'}
      toolbar={
        <DocumentToolbar
          editor={editor}
          title={str(data.title) || 'Nowa strona'}
          drafts
          versions
          byDate
          preview={{ target: 'page' }}
          canUnpublish={!protectedPage}
        />
      }
    >
      <TextField
        label="Tytuł"
        value={data.title}
        onChange={(title) =>
          editor.update((current) => ({
            ...current,
            title,
            // A new page takes its address from the title until the editor types one.
            ...(!editor.entry && (!current.slug || current.slug === slugify(str(current.title)))
              ? { slug: slugify(title) }
              : {}),
          }))
        }
      />
      <TextField
        label="Adres"
        value={data.slug}
        hint={
          protectedPage
            ? 'Adresu tej strony nie można zmienić – linkują do niej checkout i e-maile.'
            : `Strona będzie pod /${str(data.slug) || '…'}`
        }
        onChange={(slug) => !protectedPage && editor.update({ slug })}
      />
      <TextField
        label="Wstęp"
        value={data.lead}
        multiline
        onChange={(lead) => editor.update({ lead })}
        hint="Pod tytułem."
      />
      <RichTextEditor
        key={editor.revision}
        label="Treść"
        value={data.content}
        features={PAGE_EDITOR}
        related={editor.related}
        onRelated={editor.remember}
        onChange={(content) => editor.update({ content })}
      />
      <Field label="Obowiązuje od" hint="Dla stron prawnych – data pod tytułem.">
        <input
          type="date"
          className="shadow-borders-base bg-ui-bg-field txt-compact-small h-8 rounded-md px-2"
          value={toDateInput(data.effectiveFrom)}
          onChange={(e) => editor.update({ effectiveFrom: fromDateInput(e.target.value) })}
        />
      </Field>
      <Toggle
        label="Wymaga weryfikacji prawnej"
        hint="Tylko w panelu – sklep tego nie pokazuje."
        checked={data.legalReview}
        onChange={(legalReview) => editor.update({ legalReview })}
      />
      <Toggle
        label="Pokaż w menu informacji"
        checked={data.inInfoNav}
        onChange={(inInfoNav) => editor.update({ inInfoNav })}
      />
      <NumberField
        label="Kolejność w menu"
        value={data.navOrder}
        hint="Mniejsza liczba – wyżej."
        onChange={(navOrder) => editor.update({ navOrder })}
      />
      <TextField
        label="Tytuł strony (meta)"
        value={data.metaTitle}
        onChange={(metaTitle) => editor.update({ metaTitle })}
      />
      <TextField
        label="Opis strony (meta)"
        value={data.metaDescription}
        multiline
        onChange={(metaDescription) => editor.update({ metaDescription })}
      />
    </EditorPage>
  )
}

export default PageEditorPage
