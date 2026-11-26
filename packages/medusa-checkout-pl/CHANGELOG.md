# @cloud-house/medusa-checkout-pl

## 0.1.1

### Patch Changes

- 2fe3547: Stricter start-up validation of options (customer texts, function options, prefixes); a custom `blockReasons` callback that returns nothing falls back to the default text so every endpoint agrees the method is closed; the no-op plugin option `asyncPaymentMethodTypes` is removed (it is an argument of `paymentModules`); README corrections.

## 0.1.0

### Minor Changes

- 802a3bf: New plugin `@cloud-house/medusa-checkout-pl`: Polish checkout backend – Stripe card/BLIK/P24 configuration, shipping rates and delivery options, parcel locker rule from parcel classes, checkout check, order summary, delivery review and the order confirmation e-mail.

### Patch Changes

- Updated dependencies [802a3bf]
  - @cloud-house/commerce-rules@0.8.0
  - @cloud-house/medusa-furgonetka@0.1.2
