---
'@cloud-house/next-content': patch
---

Preview enter and exit routes redirect with a relative `Location` (like Next's `redirect()`), so behind a proxy the browser is not sent to the server's listen address.
