import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type NotificationRow = { status: string; data: Record<string, unknown> | null }

const list = (container: MedusaContainer, to: string, template: string) =>
  container
    .resolve(Modules.NOTIFICATION)
    .listNotifications({ to, template }, { order: { created_at: 'ASC' } }) as Promise<
    NotificationRow[]
  >

/** Oldest first. Until `count` notifications of the template exist and none is still `pending`. */
export async function waitForNotifications(
  container: MedusaContainer,
  to: string,
  template: string,
  count = 1,
): Promise<NotificationRow[]> {
  const done = (rows: NotificationRow[]) =>
    rows.length >= count && rows.every((n) => n.status !== 'pending')
  for (let i = 0; i < 100 && !done(await list(container, to, template)); i++) await sleep(100)
  return list(container, to, template)
}

/** Waits a moment and returns what exists – for „nothing was sent” checks. */
export async function notificationsAfterPause(
  container: MedusaContainer,
  to: string,
  template: string,
): Promise<NotificationRow[]> {
  await sleep(1500)
  return list(container, to, template)
}

/** Value of a query parameter in the action link of an account e-mail (`kod`, `token`). */
export function linkParam(notification: NotificationRow | undefined, name: string): string {
  const url = (notification?.data as { actionUrl?: string } | null)?.actionUrl
  if (!url) throw new Error('no action link in the notification')
  const value = new URL(url).searchParams.get(name)
  if (!value) throw new Error(`no ${name} in ${url}`)
  return value
}
