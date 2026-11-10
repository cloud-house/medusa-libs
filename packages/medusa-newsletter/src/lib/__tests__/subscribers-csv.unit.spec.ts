import { messages } from '../../messages'
import { subscribersCsv } from '../subscribers-csv'

const HEADER = 'email,data_zgody,zrodlo,tresc_zgody\r\n'

describe('subscribersCsv', () => {
  it('zaczyna się znakiem BOM i nagłówkiem, pusta lista to sam nagłówek', () => {
    expect(subscribersCsv([])).toBe(`﻿${HEADER}`)
  })

  it('ujmuje w cudzysłów pola z przecinkiem, cudzysłowem i nową linią', () => {
    const csv = subscribersCsv([
      {
        email: 'ola@example.pl',
        consentAt: '2026-10-21T10:00:00.000Z',
        source: 'home',
        consentText: 'Chcę newsletter, „promocje” i "porady"\nwięcej',
      },
      {
        email: 'jan@example.pl',
        consentAt: '2026-10-21T11:00:00.000Z',
        source: 'footer',
        consentText: 'Zgoda',
      },
    ])
    expect(csv).toBe(
      `﻿${HEADER}` +
        'ola@example.pl,2026-10-21T10:00:00.000Z,home,"Chcę newsletter, „promocje” i ""porady""\nwięcej"\r\n' +
        'jan@example.pl,2026-10-21T11:00:00.000Z,footer,Zgoda\r\n',
    )
  })

  it('komórki zaczynające się od =, +, -, @, tabulatora albo CR arkusz nie wykona jako formuły', () => {
    const csv = subscribersCsv([
      {
        email: '=HYPERLINK("http://zly.example")@example.pl',
        consentAt: '+1',
        source: '-2',
        consentText: '@SUM(A1)',
      },
      { email: '\tola@example.pl', consentAt: '\r2026', source: 'home', consentText: 'Zgoda' },
    ])
    expect(csv).toBe(
      `﻿${HEADER}` +
        `"'=HYPERLINK(""http://zly.example"")@example.pl",'+1,'-2,'@SUM(A1)\r\n` +
        `'\tola@example.pl,"'\r2026",home,Zgoda\r\n`,
    )
  })

  it('takes the column names from the dictionary (English)', () => {
    expect(subscribersCsv([], messages.en.csvColumns)).toBe(
      '﻿email,consent_date,source,consent_text\r\n',
    )
  })
})
