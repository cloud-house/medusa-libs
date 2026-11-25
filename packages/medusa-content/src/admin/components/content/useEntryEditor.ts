import { toast } from '@medusajs/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { sdk } from '../../lib/sdk'
import {
  contentKey,
  type Data,
  type Entry,
  type EntryResponse,
  emptyRelated,
  failure,
  type MediaDoc,
  type RefDoc,
  type Related,
  type SaveMode,
  saveEntry,
} from './api'

const AUTOSAVE_MS = 2000

export interface EntryEditorOptions {
  /** GET (and save) address; `null` – a new entry, created on the first save. */
  url: string | null
  /** For a new entry: POST address and `type` of the created entry. */
  create?: { url: string; type: string }
  /** Working copies with autosave (pages, articles, home page). */
  drafts: boolean
  /** Content of a never-saved entry. */
  initial: () => Data
  onCreated?: (entry: Entry) => void
}

/**
 * State of one edited document: the working data, documents it points at (names, images),
 * autosave of drafts, explicit saves, publication and the conflict check (`expected_updated_at`).
 */
export function useEntryEditor(options: EntryEditorOptions) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: contentKey('entry', options.url ?? 'new'),
    queryFn: () => sdk.client.fetch<EntryResponse>(options.url as string),
    enabled: options.url !== null,
  })
  const [data, setData] = useState<Data | null>(options.url === null ? options.initial() : null)
  const [related, setRelated] = useState<Related>(emptyRelated)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [protectedEntry, setProtectedEntry] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState<SaveMode | 'unpublish' | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [blocked, setBlocked] = useState(false)
  /** Bumped when the content is replaced from outside (load, restore) – editors remount. */
  const [revision, setRevision] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<{ data: Data | null; entry: Entry | null }>({ data, entry })
  latest.current = { data, entry }
  // Stable `send`: options are a new object on every render.
  const optionsRef = useRef(options)
  optionsRef.current = options
  /** The save under way – saves never overlap (each one carries the previous one's `updated_at`). */
  const inFlight = useRef<Promise<Entry | null> | null>(null)

  const load = useCallback(
    (response: EntryResponse) => {
      setEntry(response.entry)
      setProtectedEntry(response.protected === true)
      setRelated((current) => {
        const next = { ...current }
        for (const kind of Object.keys(next) as (keyof Related)[]) {
          next[kind] = { ...current[kind], ...(response.related[kind] ?? {}) } as never
        }
        return next
      })
      const source = response.entry ? (response.entry.draft ?? response.entry.data) : null
      setData(
        source ? { ...source } : response.initial ? { ...response.initial } : options.initial(),
      )
      setDirty(false)
      setRevision((value) => value + 1)
    },
    [options.initial],
  )

  useEffect(() => {
    if (query.data) load(query.data)
  }, [query.data, load])

  const save = useCallback(
    async (mode: SaveMode): Promise<Entry | null> => {
      const { data: current, entry: currentEntry } = latest.current
      if (!current) return null
      if (timer.current) clearTimeout(timer.current)
      setSaving(mode)
      try {
        const url = currentEntry
          ? (optionsRef.current.url ?? `/admin/content/entries/${currentEntry.id}`)
          : (optionsRef.current.create?.url ?? optionsRef.current.url)
        if (!url) return null
        const response = await saveEntry(url, {
          mode,
          data: current,
          expected_updated_at: currentEntry?.updated_at ?? null,
          ...(currentEntry || !optionsRef.current.create
            ? {}
            : { type: optionsRef.current.create.type }),
        })
        setEntry(response.entry)
        // A save waiting for this one must send the new `updated_at` before React re-renders.
        latest.current = { ...latest.current, entry: response.entry }
        setRelated((value) => {
          const next = { ...value }
          for (const kind of Object.keys(next) as (keyof Related)[]) {
            next[kind] = { ...value[kind], ...(response.related[kind] ?? {}) } as never
          }
          return next
        })
        // Typing during the save stays dirty; the saved copy is what the server has now.
        if (latest.current.data === current) setDirty(false)
        setLastSaved(new Date())
        if (!currentEntry && response.entry) optionsRef.current.onCreated?.(response.entry)
        if (mode !== 'autosave') {
          toast.success(
            mode === 'publish' && optionsRef.current.drafts
              ? 'Opublikowano'
              : mode === 'publish'
                ? 'Zapisano'
                : 'Zapisano szkic',
          )
          queryClient.invalidateQueries({ queryKey: contentKey('list') })
        }
        return response.entry
      } catch (error) {
        const message = failure(error)
        if (message.startsWith('Ktoś zmienił')) setBlocked(true)
        toast.error(message)
        return null
      } finally {
        setSaving(null)
      }
    },
    [queryClient],
  )

  const send = useCallback(
    async (mode: SaveMode): Promise<Entry | null> => {
      if (inFlight.current) {
        // An autosave during a save is dropped – the effect schedules a new one afterwards.
        if (mode === 'autosave') return null
        await inFlight.current
      }
      const run = save(mode)
      inFlight.current = run
      try {
        return await run
      } finally {
        if (inFlight.current === run) inFlight.current = null
      }
    },
    [save],
  )

  // Autosave of a working copy – only for existing entries (a new one needs its first save).
  // biome-ignore lint/correctness/useExhaustiveDependencies: every change of `data` restarts the debounce.
  useEffect(() => {
    if (!options.drafts || !dirty || blocked || !entry || saving !== null) return
    timer.current = setTimeout(() => void send('autosave'), AUTOSAVE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [data, dirty, blocked, entry, saving, options.drafts, send])

  const update = useCallback((patch: Data | ((current: Data) => Data)) => {
    setData((current) => {
      const base = current ?? {}
      return typeof patch === 'function' ? patch(base) : { ...base, ...patch }
    })
    setDirty(true)
  }, [])

  const remember = useCallback((kind: keyof Related, id: string, doc: RefDoc | MediaDoc) => {
    setRelated((current) => ({ ...current, [kind]: { ...current[kind], [id]: doc } }))
  }, [])

  const unpublish = async () => {
    if (!entry) return
    setSaving('unpublish')
    try {
      const response = await sdk.client.fetch<EntryResponse>(
        `/admin/content/entries/${entry.id}/unpublish`,
        {
          method: 'POST',
          body: { expected_updated_at: entry.updated_at },
        },
      )
      setEntry(response.entry)
      toast.success('Wycofano z publikacji – sklep tej treści nie pokazuje.')
      queryClient.invalidateQueries({ queryKey: contentKey('list') })
    } catch (error) {
      toast.error(failure(error))
    } finally {
      setSaving(null)
    }
  }

  const reload = async () => {
    setBlocked(false)
    const response = await query.refetch()
    if (response.data) load(response.data)
  }

  return {
    loading: options.url !== null && query.isLoading,
    error: query.error,
    entry,
    /** Cannot be deleted, unpublished or renamed. */
    protectedEntry,
    data,
    related,
    dirty,
    saving,
    lastSaved,
    blocked,
    revision,
    update,
    remember,
    save: send,
    unpublish,
    reload,
    load,
  }
}

export type EntryEditor = ReturnType<typeof useEntryEditor>
