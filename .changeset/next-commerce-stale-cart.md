---
'@cloud-house/next-commerce': patch
---

`addToCartFlow` also treats Medusa's 400 "already completed" as a stale cart (new cart, one retry) on the default `line-items` route; README: the default route is not atomic.
