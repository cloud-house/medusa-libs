import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useCallback } from 'react'
import { DocumentToolbar } from '../../../components/content/DocumentToolbar'
import { EditorPage } from '../../../components/content/EditorPage'
import { TextField } from '../../../components/content/fields'
import { HomeBlocksEditor } from '../../../components/content/HomeBlocks'
import { useEntryEditor } from '../../../components/content/useEntryEditor'

const HomePageEditor = () => {
  const editor = useEntryEditor({
    url: '/admin/content/globals/home-page',
    drafts: true,
    // The shop's starting texts come from the server (`initial` of the home-page kind).
    initial: useCallback(() => ({ layout: [], metaTitle: '', metaDescription: '' }), []),
  })
  const data = editor.data ?? {}
  return (
    <EditorPage
      editor={editor}
      toolbar={
        <DocumentToolbar
          editor={editor}
          title="Strona główna"
          drafts
          versions
          preview={{ target: 'home' }}
        />
      }
    >
      <HomeBlocksEditor editor={editor} />
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

export const config = defineRouteConfig({ label: 'Strona główna' })

export default HomePageEditor
