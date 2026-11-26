export const DEFAULT_REFRESH_MESSAGE = 'content:preview-refresh'

/**
 * The panel sends this message to the tab that opened the preview after each save. Only the
 * panel's origin counts (when configured) and only the expected `type`.
 */
export function isPreviewRefreshMessage(
  event: { origin: string; data: unknown },
  adminOrigin: string | undefined,
  messageType: string = DEFAULT_REFRESH_MESSAGE,
): boolean {
  if (adminOrigin && event.origin !== adminOrigin) return false
  const data = event.data
  return (
    typeof data === 'object' && data !== null && (data as { type?: unknown }).type === messageType
  )
}
