import { FurgonetkaError, NO_FUNDS_MESSAGE } from '../api-errors'
import type { OrderResult, PackageInfo } from '../client'
import {
  BUSY_MESSAGE,
  commandFailure,
  fulfillmentLabels,
  isFresh,
  noServiceMessage,
  notOrderedMessage,
  ownError,
  packageStep,
  pickupFailure,
  serviceFor,
  trackingFrom,
  unorderedReason,
} from '../create'

const MINUTE = 60_000
const now = new Date('2026-11-03T10:00:00.000Z')

const info = (overrides: Partial<PackageInfo> = {}): PackageInfo => ({
  packageId: '100001',
  state: 'ordered',
  reference: 'CHNS-1001',
  tracking: [],
  costCents: 1899,
  cancelAvailable: true,
  pickupAvailable: true,
  ...overrides,
})

describe('serviceFor', () => {
  const services = [
    { id: 1, service: 'dpd', owner: 'furgonetka' as const },
    { id: 2, service: 'inpostkurier', owner: 'furgonetka' as const },
    { id: 3, service: 'inpost', owner: 'furgonetka' as const },
  ]

  it('finds the service of each carrier by its API key', () => {
    expect(serviceFor(services, 'dpd')).toBe(1)
    expect(serviceFor(services, 'inpost_courier')).toBe(2)
    expect(serviceFor(services, 'inpost_locker')).toBe(3)
  })

  it('prefers the shop’s own contract to the one of Furgonetka', () => {
    const own = [...services, { id: 9, service: 'dpd', owner: 'client' as const }]

    expect(serviceFor(own, 'dpd')).toBe(9)
  })

  it('has no service for a carrier the account does not offer', () => {
    expect(serviceFor(services.slice(0, 1), 'inpost_locker')).toBeNull()
    expect(noServiceMessage('inpost_locker')).toBe(
      'Brak usługi Paczkomat InPost na koncie Furgonetki',
    )
  })
})

describe('packageStep – what to do with a package an earlier attempt left', () => {
  it('creates a package when there is none, or only a cancelled one', () => {
    expect(packageStep(null)).toBe('create')
    expect(packageStep(info({ state: 'cancelled' }))).toBe('create')
  })

  it('goes on with an ordered package – it is paid already', () => {
    expect(packageStep(info({ state: 'ordered' }))).toBe('ordered')
  })

  it('replaces a package that was never ordered (it costs nothing)', () => {
    expect(packageStep(info({ state: 'waiting' }))).toBe('replace')
  })

  it('leaves alone a package whose order is under way', () => {
    expect(packageStep(info({ state: 'queued' }))).toBe('pending')
  })
})

describe('commandFailure – a thrown order command', () => {
  it('fails the rows with the literal text of no funds and of the carrier terms', () => {
    expect(commandFailure(new FurgonetkaError('no_funds', NO_FUNDS_MESSAGE, 400))).toBe(
      'Brak środków na koncie Furgonetki – doładuj saldo i spróbuj ponownie',
    )
    expect(commandFailure(new FurgonetkaError('terms', 'Zaakceptuj regulaminy.', 409))).toBe(
      'Zaakceptuj regulaminy.',
    )
  })

  it('fails the rows with the message of a refusal', () => {
    expect(commandFailure(new FurgonetkaError('auth', 'Połącz ponownie.', 401))).toBe(
      'Połącz ponownie.',
    )
    expect(commandFailure(new FurgonetkaError('permanent', 'Niezweryfikowany telefon.'))).toBe(
      'Niezweryfikowany telefon.',
    )
  })

  it('keeps the rows creating when the outcome is unknown (a timeout, anything unexpected)', () => {
    expect(commandFailure(new FurgonetkaError('transient', 'Nie odpowiedziała w 30 s.'))).toBeNull()
    expect(commandFailure(new TypeError('fetch failed'))).toBeNull()
  })
})

describe('the result of a finished order command for one package', () => {
  const result: OrderResult = {
    status: 'partial_success',
    ordered: ['1'],
    errors: [
      { packageId: '2', message: 'Nieprawidłowy kod pocztowy', code: 'carrierValidationError' },
      { packageId: '2', message: 'Za ciężka', code: 'carrierValidationError' },
      { packageId: null, message: 'Uwaga ogólna', code: null },
    ],
  }

  it('names the errors of the package itself', () => {
    expect(ownError(result, '1')).toBeNull()
    expect(ownError(result, '2')).toBe('Nieprawidłowy kod pocztowy; Za ciężka')
    expect(ownError(result, '3')).toBeNull()
  })

  it('explains a package that was not ordered: its own errors, the general ones, else a default', () => {
    expect(notOrderedMessage(result, '2')).toBe('Nieprawidłowy kod pocztowy; Za ciężka')
    expect(notOrderedMessage(result, '3')).toBe('Uwaga ogólna')
    expect(notOrderedMessage({ status: 'successful', ordered: [], errors: [] }, '3')).toBe(
      'Furgonetka nie zamówiła paczki – spróbuj ponownie.',
    )
  })
})

describe('unorderedReason – whether a package of a finished command goes on to its fulfillment', () => {
  // The balance covered the first two packages of the batch.
  const short: OrderResult = {
    status: 'partial_success',
    ordered: ['1', '2'],
    errors: [{ packageId: null, message: NO_FUNDS_MESSAGE, code: null }],
  }

  it('sends an ordered package on', () => {
    expect(unorderedReason(short, '1')).toBeNull()
    expect(unorderedReason(short, '2')).toBeNull()
  })

  it('fails the package a partly successful command left out, with the reason of the command', () => {
    expect(unorderedReason(short, '3')).toBe(
      'Brak środków na koncie Furgonetki – doładuj saldo i spróbuj ponownie',
    )
  })

  it('fails a package a failed command left out, and one the carrier refused', () => {
    expect(unorderedReason({ status: 'error', ordered: [], errors: [] }, '3')).toBe(
      'Furgonetka nie zamówiła paczki – spróbuj ponownie.',
    )
    const refused: OrderResult = {
      status: 'partial_success',
      ordered: ['1'],
      errors: [{ packageId: '2', message: 'Nieprawidłowy kod pocztowy', code: null }],
    }
    expect(unorderedReason(refused, '2')).toBe('Nieprawidłowy kod pocztowy')
  })

  it('reads the package again when a successful command does not list it', () => {
    expect(unorderedReason({ status: 'successful', ordered: [], errors: [] }, '3')).toBeNull()
  })
})

describe('pickupFailure', () => {
  it('passes a refusal on as it is', () => {
    expect(pickupFailure(new FurgonetkaError('permanent', 'Brak terminu odbioru.'))).toBe(
      'Brak terminu odbioru.',
    )
  })

  it('asks to look in Furgonetka first when the outcome is unknown', () => {
    expect(
      pickupFailure(new FurgonetkaError('transient', 'Furgonetka nie odpowiada (HTTP 503).')),
    ).toBe('Furgonetka nie odpowiada (HTTP 503) – sprawdź w Furgonetce, zanim ponowisz odbiór')
    expect(pickupFailure(new Error('socket hang up'))).toBe(
      'socket hang up – sprawdź w Furgonetce, zanim ponowisz odbiór',
    )
  })
})

describe('isFresh – a creating row another pass is still working on', () => {
  it('is fresh for ten minutes after its last change', () => {
    expect(isFresh({ updated_at: new Date(now.getTime() - 9 * MINUTE) }, now)).toBe(true)
    expect(isFresh({ updated_at: new Date(now.getTime() - 11 * MINUTE) }, now)).toBe(false)
  })

  it('names the busy shipment the way the panel shows it', () => {
    expect(BUSY_MESSAGE).toBe('Przesyłka jest właśnie tworzona – odśwież stronę za chwilę.')
  })
})

describe('tracking and labels of a created package', () => {
  it('keeps the link of the API and puts the carrier page where there is none', () => {
    const tracking = trackingFrom(
      'dpd',
      info({
        tracking: [
          { number: '0000123U', url: 'https://furgonetka.pl/sledzenie/0000123U' },
          { number: '0000124U', url: null },
          { number: '0000125U', url: 'javascript:alert(1)' },
        ],
      }),
    )

    expect(tracking).toEqual([
      { number: '0000123U', url: 'https://furgonetka.pl/sledzenie/0000123U' },
      {
        number: '0000124U',
        url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000124U',
      },
      {
        number: '0000125U',
        url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000125U',
      },
    ])
  })

  it('gives each parcel a label with the label route of the panel', () => {
    expect(
      fulfillmentLabels('shp_1', [{ number: '620001', url: 'https://inpost.pl/s?number=620001' }]),
    ).toEqual([
      {
        tracking_number: '620001',
        tracking_url: 'https://inpost.pl/s?number=620001',
        label_url: '/admin/shipments/shp_1/label',
      },
    ])
  })
})
