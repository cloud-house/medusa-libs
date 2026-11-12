# @cloud-house/medusa-newsletter

## 0.1.1

### Patch Changes

- Ignore `undefined` overrides in `messages` and options instead of wiping the defaults, reject an empty `sources` list, fall back to the bundled `pl` texts when the admin page cannot load the messages, and build the model enum from `NEWSLETTER_SOURCES` (no schema change).

## 0.1.0

### Minor Changes

- First release: newsletter module (`newsletter_subscriber`), storefront-only store route guarded by a shared secret, admin list, CSV export and GDPR delete, admin page `/app/newsletter`. Options: `locale` (`pl`/`en`), `messages`, `storefrontSecret`, `sources`. Error codes `already_subscribed` (422) and `storefront_secret_invalid` (401).
