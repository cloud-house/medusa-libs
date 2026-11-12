/**
 * Every text the plugin shows: API errors and the admin page. `{handle}`, `{id}`, `{name}` and
 * `{count}` are filled in where the text is used. Plain data, so the admin page can get it over HTTP.
 */
export interface BrandMessages {
  /** 400 `brand_name_invalid`. */
  nameRequired: string
  nameTooLong: string
  /** 400 `brand_handle_invalid`. */
  handleInvalid: string
  /** 400 `brand_handle_underivable`. */
  handleUnderivable: string
  /** 422 `brand_handle_taken`; `{handle}`. */
  handleTaken: string
  /** 404 `brand_product_not_found`; `{id}`. */
  productNotFound: string
  /** BCP 47 locale the brands are sorted by (store and admin lists). */
  sortLocale: string
  /** Admin menu and page heading. */
  adminTitle: string
  adminDescription: string
  addBrand: string
  newBrand: string
  editBrand: string
  columnName: string
  columnHandle: string
  columnProducts: string
  fieldName: string
  fieldHandle: string
  /** Placeholder of the handle input. */
  handlePlaceholder: string
  /** Under the handle input; `{handle}` – what is typed, `…` when empty. */
  handleHint: string
  /** Button in the list that opens `/brands/:id` (only with the option `adminDetailLinks`). */
  details: string
  edit: string
  delete: string
  save: string
  cancel: string
  saved: string
  deleted: string
  /** `{name}`. */
  deleteTitle: string
  /** `{count}` – products that lose the brand. */
  deleteDescription: string
  deleteDescriptionEmpty: string
  deleteConfirm: string
  empty: string
  loading: string
  /** The brand widget on the product page. */
  widgetTitle: string
  widgetPlaceholder: string
  widgetNone: string
  widgetEmpty: string
  /** A failed request without a message of its own. */
  genericError: string
}

export type BrandLocale = 'pl' | 'en'

export const BRAND_LOCALES: readonly BrandLocale[] = ['pl', 'en']

export const messages: Record<BrandLocale, BrandMessages> = {
  pl: {
    nameRequired: 'Podaj nazwę marki.',
    nameTooLong: 'Nazwa marki ma najwyżej 80 znaków.',
    handleInvalid: 'Adres marki może zawierać tylko małe litery, cyfry i pojedyncze myślniki.',
    handleUnderivable:
      'Z tej nazwy nie da się utworzyć adresu marki – podaj adres (handle) ręcznie.',
    handleTaken: 'Marka o adresie „{handle}” już istnieje.',
    productNotFound: 'Nie znaleziono produktu {id}.',
    sortLocale: 'pl',
    adminTitle: 'Marki',
    adminDescription: 'Marki produktów. Markę produktu ustawisz na stronie produktu.',
    addBrand: 'Dodaj markę',
    newBrand: 'Nowa marka',
    editBrand: 'Edytuj markę',
    columnName: 'Nazwa',
    columnHandle: 'Adres',
    columnProducts: 'Produkty',
    fieldName: 'Nazwa',
    fieldHandle: 'Adres (handle)',
    handlePlaceholder: 'np. aqua-marina – puste: z nazwy',
    handleHint: 'Używany w adresach marki: {handle}',
    details: 'Szczegóły',
    edit: 'Edytuj',
    delete: 'Usuń',
    save: 'Zapisz',
    cancel: 'Anuluj',
    saved: 'Zapisano markę',
    deleted: 'Usunięto markę',
    deleteTitle: 'Usunąć markę {name}?',
    deleteDescription: '{count} produktów straci przypisanie do tej marki.',
    deleteDescriptionEmpty: 'Marka nie ma przypisanych produktów.',
    deleteConfirm: 'Usuń',
    empty: 'Nie ma jeszcze żadnej marki.',
    loading: 'Wczytywanie…',
    widgetTitle: 'Marka',
    widgetPlaceholder: 'Wybierz markę',
    widgetNone: 'Brak marki',
    widgetEmpty: 'Najpierw dodaj marki w sekcji „Marki”.',
    genericError: 'Coś poszło nie tak. Spróbuj ponownie.',
  },
  en: {
    nameRequired: 'Enter the brand name.',
    nameTooLong: 'The brand name has at most 80 characters.',
    handleInvalid: 'A brand handle may only contain lower-case letters, digits and single hyphens.',
    handleUnderivable: 'No handle can be made from this name – enter the handle by hand.',
    handleTaken: 'A brand with the handle “{handle}” already exists.',
    productNotFound: 'Product {id} was not found.',
    sortLocale: 'en',
    adminTitle: 'Brands',
    adminDescription: 'Product brands. Set a product’s brand on the product page.',
    addBrand: 'Add brand',
    newBrand: 'New brand',
    editBrand: 'Edit brand',
    columnName: 'Name',
    columnHandle: 'Handle',
    columnProducts: 'Products',
    fieldName: 'Name',
    fieldHandle: 'Handle',
    handlePlaceholder: 'e.g. aqua-marina – empty: from the name',
    handleHint: 'Used in the brand’s addresses: {handle}',
    details: 'Details',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Brand saved',
    deleted: 'Brand deleted',
    deleteTitle: 'Delete the brand {name}?',
    deleteDescription: '{count} products will lose this brand.',
    deleteDescriptionEmpty: 'The brand has no products.',
    deleteConfirm: 'Delete',
    empty: 'There are no brands yet.',
    loading: 'Loading…',
    widgetTitle: 'Brand',
    widgetPlaceholder: 'Select a brand',
    widgetNone: 'No brand',
    widgetEmpty: 'Add brands in the “Brands” section first.',
    genericError: 'Something went wrong. Please try again.',
  },
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/** The `locale` dictionary with `overrides` on top (`undefined` ones ignored). */
export function resolveMessages(
  locale: BrandLocale,
  overrides: Partial<BrandMessages> = {},
): BrandMessages {
  return { ...messages[locale], ...withoutUndefined(overrides) }
}
