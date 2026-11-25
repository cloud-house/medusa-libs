import { defineRouteConfig } from '@medusajs/admin-sdk'
import { Tabs } from '@medusajs/ui'
import { useCallback } from 'react'
import type { Data } from '../../../components/content/api'
import { DocumentToolbar } from '../../../components/content/DocumentToolbar'
import { EditorPage } from '../../../components/content/EditorPage'
import { ArrayField, TextField, Toggle } from '../../../components/content/fields'
import { useEntryEditor } from '../../../components/content/useEntryEditor'

const linkRow = (row: Data, update: (row: Data) => void) => (
  <div className="grid grid-cols-2 gap-3">
    <TextField label="Etykieta" value={row.label} onChange={(label) => update({ ...row, label })} />
    <TextField
      label="Adres"
      value={row.href}
      placeholder="/kategoria"
      onChange={(href) => update({ ...row, href })}
    />
  </div>
)

function HeaderTab() {
  const editor = useEntryEditor({
    url: '/admin/content/globals/header',
    drafts: false,
    initial: useCallback(() => ({ navigation: [] }), []),
  })
  return (
    <EditorPage
      editor={editor}
      toolbar={<DocumentToolbar editor={editor} title="Menu nagłówka" drafts={false} />}
    >
      <ArrayField<Data>
        label="Pozycje menu"
        rows={editor.data?.navigation}
        max={6}
        empty={() => ({ label: '', href: '' })}
        onChange={(navigation) => editor.update({ navigation })}
        render={linkRow}
      />
    </EditorPage>
  )
}

function AnnouncementTab() {
  const editor = useEntryEditor({
    url: '/admin/content/globals/announcement-bar',
    drafts: false,
    initial: useCallback(() => ({ enabled: false, items: [] }) as Data, []),
  })
  return (
    <EditorPage
      editor={editor}
      toolbar={<DocumentToolbar editor={editor} title="Pasek ogłoszeń" drafts={false} />}
    >
      <Toggle
        label="Pokazuj pasek"
        checked={editor.data?.enabled}
        onChange={(enabled) => editor.update({ enabled })}
      />
      <ArrayField<Data>
        label="Komunikaty"
        rows={editor.data?.items}
        max={4}
        empty={() => ({ text: '', href: '' })}
        onChange={(items) => editor.update({ items })}
        render={(row, update) => (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Treść"
              value={row.text}
              onChange={(text) => update({ ...row, text })}
            />
            <TextField
              label="Link (opcjonalny)"
              value={row.href}
              onChange={(href) => update({ ...row, href })}
            />
          </div>
        )}
      />
    </EditorPage>
  )
}

function FooterTab() {
  const editor = useEntryEditor({
    url: '/admin/content/globals/footer',
    drafts: false,
    initial: useCallback(
      () => ({ tagline: '', columns: [], newsletter: { enabled: true, heading: '' } }) as Data,
      [],
    ),
  })
  const newsletter = (editor.data?.newsletter ?? {}) as Data
  return (
    <EditorPage
      editor={editor}
      toolbar={<DocumentToolbar editor={editor} title="Stopka" drafts={false} />}
    >
      <TextField
        label="Opis sklepu"
        value={editor.data?.tagline}
        multiline
        onChange={(tagline) => editor.update({ tagline })}
      />
      <ArrayField<Data>
        label="Kolumny linków"
        rows={editor.data?.columns}
        max={4}
        empty={() => ({ heading: '', links: [{ label: '', href: '' }] })}
        onChange={(columns) => editor.update({ columns })}
        render={(row, update) => (
          <>
            <TextField
              label="Nagłówek"
              value={row.heading}
              onChange={(heading) => update({ ...row, heading })}
            />
            <ArrayField<Data>
              label="Linki"
              rows={row.links}
              max={8}
              empty={() => ({ label: '', href: '' })}
              onChange={(links) => update({ ...row, links })}
              render={linkRow}
            />
          </>
        )}
      />
      <Toggle
        label="Zapis na newsletter w stopce"
        checked={newsletter.enabled}
        onChange={(enabled) => editor.update({ newsletter: { ...newsletter, enabled } })}
      />
      <TextField
        label="Nagłówek zapisu"
        value={newsletter.heading}
        onChange={(heading) => editor.update({ newsletter: { ...newsletter, heading } })}
      />
      <TextField
        label="Metody płatności"
        value={editor.data?.paymentMethods}
        onChange={(paymentMethods) => editor.update({ paymentMethods })}
      />
    </EditorPage>
  )
}

/** Header menu, announcement bar and footer – saved at once, the shop shows them right away. */
const LayoutPage = () => (
  <Tabs defaultValue="header">
    <Tabs.List className="mb-4">
      <Tabs.Trigger value="header">Menu</Tabs.Trigger>
      <Tabs.Trigger value="announcement">Pasek ogłoszeń</Tabs.Trigger>
      <Tabs.Trigger value="footer">Stopka</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="header">
      <HeaderTab />
    </Tabs.Content>
    <Tabs.Content value="announcement">
      <AnnouncementTab />
    </Tabs.Content>
    <Tabs.Content value="footer">
      <FooterTab />
    </Tabs.Content>
  </Tabs>
)

export const config = defineRouteConfig({ label: 'Układ strony' })

export default LayoutPage
