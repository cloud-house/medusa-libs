import { defineRouteConfig } from '@medusajs/admin-sdk'
import { DocumentText } from '@medusajs/icons'
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Tabs,
  Text,
  toast,
  usePrompt,
} from '@medusajs/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  contentKey,
  failure,
  listMedia,
  type MediaAsset,
  uploadMedia,
} from '../../../components/content/api'
import { TextField } from '../../../components/content/fields'
import { sdk } from '../../../lib/sdk'

type Usage = { id: string; type: string; slug: string | null; title: string | null }

function MediaDrawer({ asset, onClose }: { asset: MediaAsset | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [form, setForm] = useState({ alt: '', credit: '', credit_url: '' })
  const usage = useQuery({
    queryKey: contentKey('media-usage', asset?.id ?? ''),
    queryFn: () => sdk.client.fetch<{ used_in: Usage[] }>(`/admin/content/media/${asset?.id}`),
    enabled: asset !== null,
  })
  useEffect(() => {
    if (asset)
      setForm({ alt: asset.alt, credit: asset.credit ?? '', credit_url: asset.credit_url ?? '' })
  }, [asset])
  const save = async () => {
    if (!asset) return
    try {
      await sdk.client.fetch(`/admin/content/media/${asset.id}`, { method: 'POST', body: form })
      toast.success('Zapisano opis')
      queryClient.invalidateQueries({ queryKey: contentKey('media') })
      onClose()
    } catch (error) {
      toast.error(failure(error))
    }
  }
  const remove = async () => {
    if (!asset) return
    const ok = await prompt({
      title: 'Usunąć plik?',
      description: 'Plik zniknie z biblioteki i z serwera.',
      confirmText: 'Usuń',
      cancelText: 'Anuluj',
    })
    if (!ok) return
    try {
      await sdk.client.fetch(`/admin/content/media/${asset.id}`, { method: 'DELETE' })
      toast.success('Usunięto plik')
      queryClient.invalidateQueries({ queryKey: contentKey('media') })
      onClose()
    } catch (error) {
      toast.error(failure(error))
    }
  }
  return (
    <Drawer open={asset !== null} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{asset?.filename}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          {asset?.kind === 'image' ? (
            <img src={asset.url} alt={asset.alt} className="rounded" />
          ) : null}
          <TextField
            label={asset?.kind === 'image' ? 'Tekst alternatywny' : 'Tytuł'}
            value={form.alt}
            hint={
              asset?.kind === 'image'
                ? 'Co widać na zdjęciu – czytniki ekranu i Google.'
                : undefined
            }
            onChange={(alt) => setForm({ ...form, alt })}
          />
          <TextField
            label="Autor zdjęcia"
            value={form.credit}
            onChange={(credit) => setForm({ ...form, credit })}
          />
          <TextField
            label="Link do autora"
            value={form.credit_url}
            onChange={(credit_url) => setForm({ ...form, credit_url })}
          />
          <div className="flex flex-col gap-1">
            <Text size="small" weight="plus">
              Używany w
            </Text>
            {(usage.data?.used_in ?? []).map((use) => (
              <Text key={use.id} size="small" className="text-ui-fg-subtle">
                {use.title ?? use.slug ?? use.type}
              </Text>
            ))}
            {usage.data?.used_in.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                Nigdzie – można usunąć.
              </Text>
            ) : null}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="danger" onClick={remove}>
            Usuń
          </Button>
          <Button onClick={save}>Zapisz</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/** Media library: images and PDFs used in content, their descriptions and where they are used. */
const MediaPage = () => {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<'image' | 'document'>('image')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const media = useQuery({
    queryKey: contentKey('media', kind, q),
    queryFn: () => listMedia({ kind, q }),
  })
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files))
        await uploadMedia(file, kind === 'document' ? file.name.replace(/\.pdf$/i, '') : '')
      toast.success('Wysłano pliki – uzupełnij opisy.')
      queryClient.invalidateQueries({ queryKey: contentKey('media') })
    } catch (error) {
      toast.error(failure(error))
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <Container className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Heading>Media</Heading>
        <div className="flex gap-2">
          <Input
            size="small"
            placeholder="Szukaj"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            accept={kind === 'image' ? 'image/*' : 'application/pdf'}
            onChange={(e) => upload(e.target.files)}
          />
          <Button size="small" isLoading={uploading} onClick={() => input.current?.click()}>
            Wyślij
          </Button>
        </div>
      </div>
      <Tabs value={kind} onValueChange={(value) => setKind(value as 'image' | 'document')}>
        <Tabs.List>
          <Tabs.Trigger value="image">Zdjęcia</Tabs.Trigger>
          <Tabs.Trigger value="document">Pliki PDF</Tabs.Trigger>
        </Tabs.List>
      </Tabs>
      <div className="grid grid-cols-4 gap-3">
        {(media.data?.media ?? []).map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => setSelected(asset)}
            className="shadow-elevation-card-rest hover:shadow-elevation-card-hover flex flex-col overflow-hidden rounded-lg text-left"
          >
            {asset.kind === 'image' ? (
              <img src={asset.url} alt={asset.alt} className="aspect-video w-full object-cover" />
            ) : (
              <div className="bg-ui-bg-subtle flex aspect-video items-center justify-center">
                <DocumentText />
              </div>
            )}
            <Text
              size="xsmall"
              className={`truncate px-2 py-1 ${asset.alt ? '' : 'text-ui-fg-error'}`}
            >
              {asset.alt || 'Brak opisu'}
            </Text>
          </button>
        ))}
      </div>
      <MediaDrawer asset={selected} onClose={() => setSelected(null)} />
    </Container>
  )
}

export const config = defineRouteConfig({ label: 'Media' })

export default MediaPage
