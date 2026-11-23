import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  accountIdentityId,
  CREATED_FROM_ORDER,
  customerOfIdentity,
  EMAIL_ENTITY,
  isEmailConfirmed,
  PASSWORD_PENDING,
  updateAccountMetadata,
} from '../account'

const containerOf = (services: Record<string, unknown>) =>
  ({ resolve: (key: string) => services[key] }) as unknown as MedusaContainer

const queryReturning = (data: unknown[]) => ({
  graph: jest.fn(async () => ({ data })),
})

describe('account constants', () => {
  it('keeps the stored values', () => {
    expect(EMAIL_ENTITY).toBe('email')
    expect(PASSWORD_PENDING).toBe('password_pending')
    expect(CREATED_FROM_ORDER).toBe('created_from_order')
  })
})

describe('accountIdentityId', () => {
  it('queries the identity by app_metadata.customer_id', async () => {
    const query = queryReturning([{ id: 'authid_1' }])
    const id = await accountIdentityId(
      containerOf({ [ContainerRegistrationKeys.QUERY]: query }),
      'cus_1',
    )
    expect(id).toBe('authid_1')
    expect(query.graph).toHaveBeenCalledWith({
      entity: 'auth_identity',
      fields: ['id'],
      filters: { app_metadata: { customer_id: 'cus_1' } },
    })
  })

  it('is null without an identity', async () => {
    const query = queryReturning([])
    expect(
      await accountIdentityId(containerOf({ [ContainerRegistrationKeys.QUERY]: query }), 'cus_1'),
    ).toBeNull()
  })
})

describe('customerOfIdentity', () => {
  const auth = (identities: unknown[]) => ({
    listAuthIdentities: jest.fn(async () => identities),
  })

  it('returns the customer id from app_metadata', async () => {
    const service = auth([{ id: 'a', app_metadata: { customer_id: 'cus_1' } }])
    expect(await customerOfIdentity(containerOf({ [Modules.AUTH]: service }), 'a')).toBe('cus_1')
  })

  it('is null for an identity that is not a customer', async () => {
    const service = auth([{ id: 'a', app_metadata: { user_id: 'usr_1' } }])
    expect(await customerOfIdentity(containerOf({ [Modules.AUTH]: service }), 'a')).toBeNull()
    expect(await customerOfIdentity(containerOf({ [Modules.AUTH]: auth([]) }), 'a')).toBeNull()
  })
})

describe('isEmailConfirmed', () => {
  const setup = (verifications: unknown[], identities: unknown[] = [{ id: 'authid_1' }]) => {
    const listAuthVerifications = jest.fn(async () => verifications)
    const container = containerOf({
      [Modules.CUSTOMER]: {
        listCustomers: jest.fn(async () => [{ id: 'cus_1', email: 'a@b.pl' }]),
      },
      [Modules.AUTH]: { listAuthVerifications },
      [ContainerRegistrationKeys.QUERY]: queryReturning(identities),
    })
    return { container, listAuthVerifications }
  }

  it('is true with a verified verification of the e-mail', async () => {
    const { container, listAuthVerifications } = setup([{ verified_at: new Date() }])
    expect(await isEmailConfirmed(container, 'cus_1')).toBe(true)
    expect(listAuthVerifications).toHaveBeenCalledWith({
      auth_identity_id: 'authid_1',
      entity_id: 'a@b.pl',
      entity_type: 'email',
    })
  })

  it('is false when not verified yet or without an identity', async () => {
    expect(await isEmailConfirmed(setup([{ verified_at: null }]).container, 'cus_1')).toBe(false)
    expect(await isEmailConfirmed(setup([], []).container, 'cus_1')).toBe(false)
  })
})

describe('updateAccountMetadata', () => {
  it('merges the patch into the customer metadata', async () => {
    const updateCustomers = jest.fn(async () => undefined)
    const container = containerOf({
      [Modules.CUSTOMER]: {
        listCustomers: jest.fn(async () => [{ id: 'cus_1', metadata: { a: 1, b: 2 } }]),
        updateCustomers,
      },
    })
    await updateAccountMetadata(container, 'cus_1', { b: '', c: 3 })
    expect(updateCustomers).toHaveBeenCalledWith('cus_1', { metadata: { a: 1, b: '', c: 3 } })
  })
})
