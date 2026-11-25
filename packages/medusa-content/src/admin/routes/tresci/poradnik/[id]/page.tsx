import { articleSlugFromTitle, readingMinutes } from '@cloud-house/commerce-rules'
import { Text } from '@medusajs/ui'
import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Data } from '../../../../components/content/api'
import { DocumentToolbar } from '../../../../components/content/DocumentToolbar'
import { fromDateInput, toDateInput } from '../../../../components/content/dates'
import { EditorPage } from '../../../../components/content/EditorPage'
import { Field, str, TextField } from '../../../../components/content/fields'
import {
  ARTICLE_EDITOR,
  RichTextEditor,
} from '../../../../components/content/lexical/RichTextEditor'
import { MediaField } from '../../../../components/content/MediaPicker'
import { RelationField } from '../../../../components/content/RelationPicker'
import { useEntryEditor } from '../../../../components/content/useEntryEditor'

const NEW_ARTICLE = (): Data => ({
  title: '',
  slug: '',
  category: null,
  lead: '',
  image: null,
  content: null,
})

const ArticleEditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'nowa'
  const editor = useEntryEditor({
    url: isNew ? null : `/admin/content/entries/${id}`,
    create: { url: '/admin/content/entries', type: 'article' },
    drafts: true,
    initial: useCallback(NEW_ARTICLE, []),
    onCreated: (entry) => navigate(`/tresci/poradnik/${entry.id}`, { replace: true }),
  })
  const data = editor.data ?? {}
  return (
    <EditorPage
      editor={editor}
      deleteTo="/tresci/poradnik"
      toolbar={
        <DocumentToolbar
          editor={editor}
          title={str(data.title) || 'Nowy artykuł'}
          drafts
          versions
          preview={{ target: 'article' }}
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
            ...(!editor.entry &&
            (!current.slug || current.slug === articleSlugFromTitle(str(current.title)))
              ? { slug: articleSlugFromTitle(title) }
              : {}),
          }))
        }
      />
      <TextField
        label="Adres"
        value={data.slug}
        hint={`Artykuł będzie pod /poradnik/${str(data.slug) || '…'}`}
        onChange={(slug) => editor.update({ slug })}
      />
      <RelationField
        label="Kategoria"
        kind="article_category"
        value={data.category}
        known={editor.related.entry}
        onChange={(category, picked) => {
          if (picked) editor.remember('entry', picked.id, picked)
          editor.update({ category })
        }}
      />
      <TextField
        label="Wstęp"
        value={data.lead}
        multiline
        onChange={(lead) => editor.update({ lead })}
        hint="Na kaflu artykułu i pod tytułem."
      />
      <MediaField
        label="Zdjęcie główne"
        value={data.image}
        media={editor.related.media}
        onChange={(image, doc) => {
          if (doc) editor.remember('media', doc.id, doc)
          editor.update({ image })
        }}
      />
      <RichTextEditor
        key={editor.revision}
        label="Treść"
        value={data.content}
        features={ARTICLE_EDITOR}
        related={editor.related}
        onRelated={editor.remember}
        onChange={(content) => editor.update({ content })}
      />
      <Text size="xsmall" className="text-ui-fg-subtle">
        Czas czytania: {readingMinutes(data.content)} min (liczony z treści przy zapisie).
      </Text>
      <Field label="Data publikacji" hint="Puste – dzień pierwszej publikacji.">
        <input
          type="date"
          className="shadow-borders-base bg-ui-bg-field txt-compact-small h-8 rounded-md px-2"
          value={toDateInput(data.publishedAt)}
          onChange={(e) => editor.update({ publishedAt: fromDateInput(e.target.value) })}
        />
      </Field>
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

export default ArticleEditorPage
