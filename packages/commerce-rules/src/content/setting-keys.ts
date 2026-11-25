/** Wartości z Ustawień sklepu, które redaktor wstawia w treść strony (blok w linii `settingValue`). */
export type SettingValueKey =
  | 'freeShippingThreshold'
  | 'shippingCutoff'
  | 'returnDays'
  | 'warrantyYears'
  | 'contactEmail'
  | 'contactPhone'
  | 'contactHours'
  | 'sellerName'
  | 'returnAddress'

export const SETTING_VALUE_OPTIONS: { value: SettingValueKey; label: string }[] = [
  { value: 'freeShippingThreshold', label: 'Próg darmowej dostawy' },
  { value: 'shippingCutoff', label: 'Godzina wysyłki' },
  { value: 'returnDays', label: 'Dni na zwrot' },
  { value: 'warrantyYears', label: 'Lata gwarancji' },
  { value: 'contactEmail', label: 'E-mail kontaktowy' },
  { value: 'contactPhone', label: 'Telefon' },
  { value: 'contactHours', label: 'Godziny kontaktu' },
  { value: 'sellerName', label: 'Nazwa firmy sprzedawcy' },
  { value: 'returnAddress', label: 'Adres do zwrotów' },
]
