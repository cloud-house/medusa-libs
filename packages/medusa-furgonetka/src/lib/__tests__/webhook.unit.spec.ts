import { createHash } from 'node:crypto'
import { FAKE_WEBHOOK_TOKEN } from '../config'
import { createFakeClient, fakeFurgonetka, markPickedUp, webhookBody } from '../fake'
import { verifyWebhook, webhookControl, webhookPayload } from '../webhook'

const md5 = (text: string) => createHash('md5').update(text).digest('hex')

/** The example of the spec: a DPD parcel delivered. */
const payload = {
  package_id: 21351614,
  package_no: '0000123U',
  partner_order_id: '',
  tracking: {
    datetime: '2026-09-29 11:59:34',
    state: 'delivered',
    description: 'Doręczona',
    branch: '',
  },
}

describe('webhookControl', () => {
  it('is the md5 of the fields in the documented order and the token', () => {
    expect(webhookControl(payload, 't')).toBe(
      md5('213516140000123Udelivered' + 'Doręczona2026-09-29 11:59:34t'),
    )
  })

  it('takes a missing or empty field as an empty text', () => {
    expect(
      webhookControl(
        {
          package_id: 5,
          package_no: null,
          tracking: { state: 'collected', description: undefined },
        },
        't',
      ),
    ).toBe(md5('5collectedt'))
    expect(webhookControl({}, 't')).toBe(md5('t'))
  })
})

describe('verifyWebhook', () => {
  const signed = { ...payload, control: webhookControl(payload, 't') }

  it('accepts the right sum, in either case', () => {
    expect(verifyWebhook(signed, 't')).toBe(true)
    expect(verifyWebhook({ ...signed, control: signed.control.toUpperCase() }, 't')).toBe(true)
  })

  it('refuses a wrong sum, a sum of another token and a changed field', () => {
    expect(verifyWebhook({ ...signed, control: 'f'.repeat(32) }, 't')).toBe(false)
    expect(verifyWebhook(signed, 'another-token')).toBe(false)
    expect(
      verifyWebhook({ ...signed, tracking: { ...payload.tracking, state: 'returned' } }, 't'),
    ).toBe(false)
  })

  it('refuses a body without a sum or with a sum that is not text', () => {
    expect(verifyWebhook(payload, 't')).toBe(false)
    expect(verifyWebhook({ ...payload, control: '' }, 't')).toBe(false)
    expect(verifyWebhook({ ...payload, control: 12345 }, 't')).toBe(false)
  })

  it('accepts what the fake sends', async () => {
    const state = fakeFurgonetka()
    state.reset()
    const client = createFakeClient(state)
    const { packageId } = await client.createPackage({
      reference: 'CHNS-1001',
      serviceId: 1001,
      carrier: 'dpd',
      receiver: {
        name: 'Jan Kowalski',
        company: null,
        phone: '+48600100200',
        email: null,
        street: 'ul. Morska 5',
        postal_code: '80-001',
        city: 'Gdańsk',
        point: null,
        point_label: null,
      },
      sender: {
        name: 'Acme Shop',
        street: 'ul. Magazynowa 1',
        postal_code: '00-001',
        city: 'Warszawa',
        phone: '+48600100200',
        email: null,
      },
      parcels: [],
      declaredValueCents: 10000,
      pickup: 'drop_off',
    })
    await client.orderPackages('cmd-1', [packageId])
    markPickedUp(packageId, state)

    expect(verifyWebhook(webhookBody(packageId, 'collected', state), FAKE_WEBHOOK_TOKEN)).toBe(true)
    state.reset()
  })
})

describe('webhookPayload', () => {
  it('takes a JSON object, also one that came as text', () => {
    expect(webhookPayload(payload)).toEqual(payload)
    expect(webhookPayload(JSON.stringify(payload))).toEqual(payload)
  })

  it('has no payload for anything else', () => {
    expect(webhookPayload(undefined)).toBeNull()
    expect(webhookPayload('not json')).toBeNull()
    expect(webhookPayload('[1, 2]')).toBeNull()
    expect(webhookPayload(42)).toBeNull()
  })
})
