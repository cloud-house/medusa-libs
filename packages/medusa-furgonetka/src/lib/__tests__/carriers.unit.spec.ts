import { CARRIER_NAMES, carrierForCode, httpUrl, trackingUrl } from '../carriers'

describe('CARRIER_NAMES', () => {
  it('names the carriers the way the delivery options do', () => {
    expect(CARRIER_NAMES).toEqual({
      dpd: 'Kurier DPD',
      inpost_courier: 'Kurier InPost',
      inpost_locker: 'Paczkomat InPost',
    })
  })
})

const CODES = { inpostCourier: 'kurier-inpost', inpostLocker: 'paczkomat-inpost' }

describe('carrierForCode', () => {
  it('maps the InPost delivery methods', () => {
    expect(carrierForCode('kurier-inpost', CODES)).toBe('inpost_courier')
    expect(carrierForCode('paczkomat-inpost', CODES)).toBe('inpost_locker')
  })

  it('follows the codes the shop gives', () => {
    const shop = { inpostCourier: 'inpost-kurier', inpostLocker: 'locker' }

    expect(carrierForCode('locker', shop)).toBe('inpost_locker')
    expect(carrierForCode('inpost-kurier', shop)).toBe('inpost_courier')
    expect(carrierForCode('paczkomat-inpost', shop)).toBe('dpd')
  })

  it('takes DPD for DPD, an unknown code and no code', () => {
    expect(carrierForCode('kurier-dpd', CODES)).toBe('dpd')
    expect(carrierForCode('odbior-osobisty', CODES)).toBe('dpd')
    expect(carrierForCode(null, CODES)).toBe('dpd')
  })
})

describe('trackingUrl', () => {
  it('links a DPD parcel to the DPD tracking page', () => {
    expect(trackingUrl('dpd', '0000123')).toBe(
      'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000123',
    )
  })

  it('links both InPost services to the InPost tracking page', () => {
    const url = 'https://inpost.pl/sledzenie-przesylek?number=620012345'
    expect(trackingUrl('inpost_courier', '620012345')).toBe(url)
    expect(trackingUrl('inpost_locker', '620012345')).toBe(url)
  })

  it('escapes what is not safe in a query', () => {
    expect(trackingUrl('dpd', 'A B&1')).toBe(
      'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=A%20B%261',
    )
  })
})

describe('httpUrl', () => {
  it('keeps a link that opens in a browser', () => {
    expect(httpUrl('https://inpost.pl/sledzenie-przesylek?number=1')).toBe(
      'https://inpost.pl/sledzenie-przesylek?number=1',
    )
    expect(httpUrl(' http://example.com/t ')).toBe('http://example.com/t')
  })

  it('refuses what is no http(s) link: the admin placeholder, other schemes, blanks', () => {
    expect(httpUrl('#')).toBeNull()
    expect(httpUrl('javascript:alert(1)')).toBeNull()
    expect(httpUrl('ftp://example.com/t')).toBeNull()
    expect(httpUrl('/sledzenie/1')).toBeNull()
    expect(httpUrl('')).toBeNull()
    expect(httpUrl('   ')).toBeNull()
    expect(httpUrl(null)).toBeNull()
    expect(httpUrl(undefined)).toBeNull()
  })
})
