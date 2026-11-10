# @cloud-house/medusa-newsletter

## 0.1.0

### Minor Changes

- First release: newsletter module (`newsletter_subscriber`), storefront-only store route guarded by a shared secret, admin list, CSV export and GDPR delete, admin page `/app/newsletter`. Options: `locale` (`pl`/`en`), `messages`, `storefrontSecret`, `sources`. Error codes `already_subscribed` (422) and `storefront_secret_invalid` (401).
