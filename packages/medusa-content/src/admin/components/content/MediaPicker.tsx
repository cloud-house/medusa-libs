import { DocumentText, Photo, XMark } from '@medusajs/icons'
import { Button, Drawer, IconButton, Input, Text, toast } from '@medusajs/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import {
  contentKey,
  failure,
  listMedia,
  type MediaAsset,
  type MediaDoc,
  toMediaDoc,
  uploadMedia,
} from './api'
import { Field } from './fields'

const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** Library browser: pick an existing file or upload a new one (images or PDFs). */
export function MediaLibraryDrawer(props: {
  open: boolean
  kind: 'image' | 'document'
  onClose: () => void
  onPick: (asset: MediaDoc) => void
}) {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const media = useQuery({
    queryKey: contentKey('media', props.kind, q),
    queryFn: () => listMedia({ kind: props.kind, q }),
    enabled: props.open,
  })
  const pick = (asset: MediaAsset) => {
    props.onPick(toMediaDoc(asset))
    props.onClose()
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const asset = await uploadMedia(
        file,
        props.kind === 'document' ? file.name.replace(/\.pdf$/i, '') : '',
      )
      await queryClient.invalidateQueries({ queryKey: contentKey('media') })
      toast.success('Plik dodany – uzupełnij opis w bibliotece mediów.')
      pick(asset)
    } catch (error) {
      toast.error(failure(error))
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <Drawer open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <Drawer.Content className="max-w-2xl">
        <Drawer.Header>
          <Drawer.Title>
            {props.kind === 'image' ? 'Wybierz zdjęcie' : 'Wybierz plik PDF'}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex gap-2">
            <Input
              placeholder="Szukaj po opisie albo nazwie pliku"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input
              ref={input}
              type="file"
              className="hidden"
              accept={props.kind === 'image' ? 'image/*' : 'application/pdf'}
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              isLoading={uploading}
              onClick={() => input.current?.click()}
            >
              Wyślij nowy
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(media.data?.media ?? []).map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => pick(asset)}
                className="shadow-elevation-card-rest hover:shadow-elevation-card-hover flex flex-col gap-1 overflow-hidden rounded-lg text-left"
              >
                {asset.kind === 'image' ? (
                  <img
                    src={asset.url}
                    alt={asset.alt}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="bg-ui-bg-subtle flex aspect-video items-center justify-center">
                    <DocumentText />
                  </div>
                )}
                <Text size="xsmall" className="truncate px-2 pb-2">
                  {asset.alt || asset.filename}
                </Text>
              </button>
            ))}
          </div>
          {media.data && media.data.media.length === 0 ? (
            <Text size="small">Brak plików.</Text>
          ) : null}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}

/** One image or PDF field: thumbnail, „Wybierz” and „Usuń”; stores the media id. */
export function MediaField(props: {
  label: string
  value: unknown
  media: Record<string, MediaDoc>
  onChange: (id: string | null, doc: MediaDoc | null) => void
  kind?: 'image' | 'document'
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const kind = props.kind ?? 'image'
  const id = typeof props.value === 'string' ? props.value : null
  const doc = id ? props.media[id] : undefined
  return (
    <Field label={props.label} hint={props.hint}>
      <div className="flex items-center gap-3">
        {id ? (
          kind === 'image' && doc ? (
            <img src={doc.url} alt={doc.alt} className="h-16 w-24 rounded object-cover" />
          ) : (
            <div className="bg-ui-bg-subtle flex h-16 w-24 items-center justify-center rounded">
              {kind === 'image' ? <Photo /> : <DocumentText />}
            </div>
          )
        ) : null}
        <div className="flex flex-col gap-1">
          {doc ? (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {doc.alt || doc.filename} · {sizeLabel(doc.filesize)}
            </Text>
          ) : id ? (
            <Text size="xsmall" className="text-ui-fg-error">
              Plik usunięty z biblioteki
            </Text>
          ) : null}
          <div className="flex gap-2">
            <Button size="small" variant="secondary" type="button" onClick={() => setOpen(true)}>
              {id ? 'Zmień' : 'Wybierz'}
            </Button>
            {id ? (
              <IconButton
                size="small"
                variant="transparent"
                type="button"
                aria-label="Usuń"
                onClick={() => props.onChange(null, null)}
              >
                <XMark />
              </IconButton>
            ) : null}
          </div>
        </div>
      </div>
      <MediaLibraryDrawer
        open={open}
        kind={kind}
        onClose={() => setOpen(false)}
        onPick={(asset) => props.onChange(asset.id, asset)}
      />
    </Field>
  )
}
