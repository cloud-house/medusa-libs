---
'@cloud-house/medusa-checkout-pl': patch
---

Stricter start-up validation of options (customer texts, function options, prefixes); a custom `blockReasons` callback that returns nothing falls back to the default text so every endpoint agrees the method is closed; the no-op plugin option `asyncPaymentMethodTypes` is removed (it is an argument of `paymentModules`); README corrections.
