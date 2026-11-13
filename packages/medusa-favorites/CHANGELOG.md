# @cloud-house/medusa-favorites

## 0.2.0

### Minor Changes

- 1e20d04: Breaking (0.x): error codes now follow `<domain>_<reason>`. Newsletter: `already_subscribed` is
  `newsletter_already_subscribed`, `storefront_secret_invalid` is `newsletter_storefront_secret_invalid`.
  Favorites: `product_not_found` is `favorites_product_not_found`. Statuses and messages are unchanged;
  update any storefront code that compares `code`. Also removes the `./workflows` export, which pointed
  to a file that was never in the package.
- 1e20d04: The limit message agrees with the number: "Masz już 3 ulubione", "1 ulubiony", "5 ulubionych"
  (Polish), "favourite" / "favourites" (English). The default texts use a `{favorites}` placeholder
  next to `{limit}`; a `messages.limitReached` of your own is used as is. Adds a dependency on
  `@cloud-house/commerce-rules`.

## 0.1.0

### Minor Changes

- 6d12c83: First release: the `favorite` module and the `/store/account/favorites` routes (list, add, remove, merge of the guest list), with the `limit`, `locale` and `messages` options and the error codes `favorites_limit_reached` and `product_not_found`.
