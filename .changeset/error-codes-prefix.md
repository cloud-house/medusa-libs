---
'@cloud-house/medusa-newsletter': minor
'@cloud-house/medusa-favorites': minor
---

Breaking (0.x): error codes now follow `<domain>_<reason>`. Newsletter: `already_subscribed` is
`newsletter_already_subscribed`, `storefront_secret_invalid` is `newsletter_storefront_secret_invalid`.
Favorites: `product_not_found` is `favorites_product_not_found`. Statuses and messages are unchanged;
update any storefront code that compares `code`. Also removes the `./workflows` export, which pointed
to a file that was never in the package.
