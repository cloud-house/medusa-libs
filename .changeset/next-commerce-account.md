---
'@cloud-house/next-commerce': minor
---

New entries `./account` (customer account client, forms, saved addresses, cart sync on sign-in, safe return path), `./favorites` (guest list in localStorage with a configurable key, sync with the account, Medusa calls) and `./returns` (return lookup and claim forms with an optional order prefix, label helpers, Medusa calls). `SavedAddress` now lives in `./account`; `./checkout` still exports it.
