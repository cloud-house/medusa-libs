# @cloud-house/next-commerce

## 0.1.1

### Patch Changes

- 55d1d27: `addToCartFlow` also treats Medusa's 400 "already completed" as a stale cart (new cart, one retry) on the default `line-items` route; README: the default route is not atomic.

## 0.1.0

### Minor Changes

- 2a64b28: New package `@cloud-house/next-commerce` (part 1): cart client and view, checkout form with Polish validation, checkout flow and Medusa calls, Stripe adapter, order view and the newsletter sign-up core.
