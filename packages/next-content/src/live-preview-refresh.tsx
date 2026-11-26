import { useRouter } from 'next/navigation.js'
import { useEffect } from 'react'
import { isPreviewRefreshMessage } from './live-preview-message'

/**
 * Live preview: after each save the Medusa panel (the tab that opened the preview) sends a
 * message and the route renders again with the working copy.
 */
export function LivePreviewRefresh({
  adminOrigin = process.env.NEXT_PUBLIC_ADMIN_ORIGIN,
  messageType,
}: {
  adminOrigin?: string
  messageType?: string
}) {
  const router = useRouter()
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (isPreviewRefreshMessage(event, adminOrigin, messageType)) router.refresh()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [router, adminOrigin, messageType])
  return null
}
