import type { AuthenticationInput, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

/** `entity_type` of the e-mail confirmation in Medusa's auth verifications. */
export const EMAIL_ENTITY = 'email'

/** Customer metadata (backend only): the account from the checkout has no password yet. */
export const PASSWORD_PENDING = 'password_pending'
/** Customer metadata: the order that sent the last „Ustaw hasło” link. */
export const CREATED_FROM_ORDER = 'created_from_order'

/** The auth identity of a customer account (`app_metadata.customer_id`). */
export async function accountIdentityId(
  container: MedusaContainer,
  customerId: string,
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'auth_identity',
    fields: ['id'],
    // JSON filter – the generated `.medusa/types` do not type nested JSON keys.
    filters: { app_metadata: { customer_id: customerId } } as Record<string, unknown>,
  })
  return (data[0] as { id?: string } | undefined)?.id ?? null
}

/** The customer of an auth identity, if it is a customer account. */
export async function customerOfIdentity(
  container: MedusaContainer,
  authIdentityId: string,
): Promise<string | null> {
  const [identity] = await container
    .resolve(Modules.AUTH)
    .listAuthIdentities({ id: [authIdentityId] }, { select: ['id', 'app_metadata'] })
  const customerId = identity?.app_metadata?.customer_id
  return typeof customerId === 'string' ? customerId : null
}

/** Confirmed with the link from „Potwierdź adres e-mail” (Medusa auth verification of the e-mail). */
export async function isEmailConfirmed(
  container: MedusaContainer,
  customerId: string,
): Promise<boolean> {
  const [customer] = await container
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: customerId }, { select: ['id', 'email'] })
  const identityId = await accountIdentityId(container, customerId)
  if (!customer?.email || !identityId) return false
  const verifications = await container.resolve(Modules.AUTH).listAuthVerifications({
    auth_identity_id: identityId,
    entity_id: customer.email,
    entity_type: EMAIL_ENTITY,
  })
  return verifications.some((verification) => Boolean(verification.verified_at))
}

/** The registered (not deleted) customer with this e-mail – e-mails are stored lowercase. */
export async function registeredCustomerByEmail(
  container: MedusaContainer,
  email: string,
): Promise<{ id: string } | null> {
  const [customer] = await container
    .resolve(Modules.CUSTOMER)
    .listCustomers({ email: email.trim().toLowerCase(), has_account: true }, { select: ['id'] })
  return customer ? { id: customer.id } : null
}

/** Sets keys in customer metadata (`''` removes a key – Medusa merges metadata on update). */
export async function updateAccountMetadata(
  container: MedusaContainer,
  customerId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const customers = container.resolve(Modules.CUSTOMER)
  const [customer] = await customers.listCustomers(
    { id: customerId },
    { select: ['id', 'metadata'] },
  )
  await customers.updateCustomers(customerId, {
    metadata: { ...(customer?.metadata ?? {}), ...patch },
  })
}

/** E-mail and password of the customer account match (Medusa `emailpass`). */
export async function passwordMatches(
  container: MedusaContainer,
  email: string,
  password: string,
): Promise<boolean> {
  const result = await container
    .resolve(Modules.AUTH)
    .authenticate('emailpass', { body: { email, password } } as AuthenticationInput)
  return Boolean(result.success)
}

/**
 * Marks the account's e-mail as confirmed without the customer's code – for an account from the
 * checkout that just set a password through the reset e-mail (the mailbox is proven, spec 5a
 * part 2 §6). The module call emits no `auth.verification_requested`, so no e-mail goes out.
 */
export async function markEmailConfirmed(
  container: MedusaContainer,
  customerId: string,
): Promise<boolean> {
  const [customer] = await container
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: customerId }, { select: ['id', 'email'] })
  const identityId = await accountIdentityId(container, customerId)
  if (!customer?.email || !identityId) return false
  const auth = container.resolve(Modules.AUTH)
  const requested = await auth.requestAuthVerification({
    auth_identity_id: identityId,
    entity_id: customer.email,
    entity_type: EMAIL_ENTITY,
    code_provider: 'token',
  })
  // Already confirmed – Medusa returns the verification without a new code.
  if (requested.code) {
    await auth.confirmAuthVerification({ code: requested.code, code_provider: 'token' })
  }
  return true
}

/**
 * Gives a confirmed verification code back (`verified_at: null`), so its link works again – for
 * „Ustaw hasło” when the password update fails after the code was used up. The module's
 * generated update is not part of `IAuthModuleService`.
 */
export async function reopenAuthVerification(
  container: MedusaContainer,
  verificationId: string,
): Promise<void> {
  const auth = container.resolve(Modules.AUTH) as unknown as {
    updateAuthVerifications(data: { id: string; verified_at: Date | null }): Promise<unknown>
  }
  await auth.updateAuthVerifications({ id: verificationId, verified_at: null })
}

export const nowSeconds = () => Math.floor(Date.now() / 1000)
