---
'@cloud-house/medusa-revalidation': minor
---

`postRevalidate` and `createRevalidationSubscriber` take `locale` (`'pl' | 'en'`, default `'en'`,
as before) and `messages` (single log lines over the dictionary). Exports `revalidationMessages`,
`resolveRevalidationMessages` and `RevalidationMessages`.
