import {
  connectionText,
  dimensionsText,
  gramsFromKg,
  KIND_LABELS,
  kgText,
  numberFromText,
  purposeOptions,
  purposeText,
  weightText,
} from '../shipping-labels'

describe('dimensionsText', () => {
  it('writes length × width × height in cm', () => {
    expect(dimensionsText({ length_cm: 95, width_cm: 45, height_cm: 30 })).toBe('95×45×30 cm')
    expect(dimensionsText({ length_cm: 64, width_cm: 38, height_cm: 8 })).toBe('64×38×8 cm')
  })
})

describe('weightText', () => {
  it.each([
    [15000, '15 kg'],
    [2000, '2 kg'],
    [2500, '2,5 kg'],
    [250, '0,25 kg'],
    [1, '0,001 kg'],
    [50000, '50 kg'],
  ])('%i g → %s', (grams, text) => {
    expect(weightText(grams)).toBe(text)
  })
})

describe('kgText and gramsFromKg', () => {
  it('turns grams into the text of the weight field', () => {
    expect(kgText(15000)).toBe('15')
    expect(kgText(2500)).toBe('2,5')
  })

  it.each([
    ['15', 15000],
    ['2,5', 2500],
    ['2.5', 2500],
    [' 0,25 ', 250],
    ['0,001', 1],
  ])('reads "%s" kg as %i g', (text, grams) => {
    expect(gramsFromKg(text)).toBe(grams)
  })

  it.each([[''], ['  '], ['abc'], ['1,2,3'], ['-1'], ['1,0005'], ['1,'], [',5']])(
    'reads "%s" as no weight',
    (text) => {
      expect(gramsFromKg(text)).toBeNull()
    },
  )
})

describe('numberFromText', () => {
  it('reads whole numbers and leaves the rest to the server to refuse', () => {
    expect(numberFromText('95')).toBe(95)
    expect(numberFromText(' 40 ')).toBe(40)
    expect(numberFromText('10,5')).toBe(10.5)
    expect(numberFromText('')).toBeNull()
    expect(numberFromText('abc')).toBeNull()
  })
})

describe('names of kinds and purposes', () => {
  it('names the kinds', () => {
    expect(KIND_LABELS).toEqual({
      locker_a: 'Paczkomat A',
      locker_b: 'Paczkomat B',
      locker_c: 'Paczkomat C',
      box: 'Karton',
    })
  })

  it('names the purposes and a dash for none', () => {
    const classes = [
      { key: 'board', label: 'Deska' },
      { key: 'courier_only', label: 'Tylko kurier' },
    ]
    expect(purposeText('board', classes)).toBe('Deska')
    expect(purposeText('courier_only', classes)).toBe('Tylko kurier')
    expect(purposeText('accessories_locker', classes)).toBe('Akcesoria – paczkomat')
    expect(purposeText('accessories_courier', classes)).toBe('Akcesoria – kurier')
    expect(purposeText('sofa', classes)).toBe('sofa')
    expect(purposeText(null, classes)).toBe('–')
  })
})

describe('connectionText', () => {
  it.each([
    [{ state: 'not_configured', account: null }, 'nie skonfigurowana'],
    [{ state: 'not_connected', account: null }, 'niepołączona'],
    [
      { state: 'connected', account: 'Acme Shop sp. z o.o.' },
      'połączona jako Acme Shop sp. z o.o.',
    ],
    [{ state: 'connected', account: null }, 'połączona'],
    [{ state: 'disconnected', account: 'Acme Shop sp. z o.o.' }, 'rozłączona – połącz ponownie'],
  ] as const)('%j → %s', (view, text) => {
    expect(connectionText(view)).toBe(text)
  })
})

describe('purposeOptions', () => {
  it('lists the shop classes first, then the two accessories purposes', () => {
    expect(purposeOptions([{ key: 'sofa', label: 'Sofa' }])).toEqual([
      { value: 'sofa', label: 'Sofa' },
      { value: 'accessories_locker', label: 'Akcesoria – paczkomat' },
      { value: 'accessories_courier', label: 'Akcesoria – kurier' },
    ])
  })
})
