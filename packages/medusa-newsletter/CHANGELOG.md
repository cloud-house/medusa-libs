# @cloud-house/medusa-newsletter

## 0.2.0

### Minor Changes

- 1e20d04: Breaking (0.x): error codes now follow `<domain>_<reason>`. Newsletter: `already_subscribed` is
  `newsletter_already_subscribed`, `storefront_secret_invalid` is `newsletter_storefront_secret_invalid`.
  Favorites: `product_not_found` is `favorites_product_not_found`. Statuses and messages are unchanged;
  update any storefront code that compares `code`. Also removes the `./workflows` export, which pointed
  to a file that was never in the package.

## 0.1.1

### Patch Changes

- Ignore `undefined` overrides in `messages` and options instead of wiping the defaults, reject an empty `sources` list, fall back to the bundled `pl` texts when the admin page cannot load the messages, and build the model enum from `NEWSLETTER_SOURCES` (no schema change).

## 0.1.0

### Minor Changes

- First release: newsletter module (`newsletter_subscriber`), storefront-only store route guarded by a shared secret, admin list, CSV export and GDPR delete, admin page `/app/newsletter`. Options: `locale` (`pl`/`en`), `messages`, `storefrontSecret`, `sources`. Error codes `already_subscribed` (422) and `storefront_secret_invalid` (401).
