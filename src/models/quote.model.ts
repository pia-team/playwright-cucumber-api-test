// All models related to the Quote feature are defined in this single file.

export interface TimePeriod {
  endDateTime?: string;
  startDateTime?: string;
}

export interface RelatedParty {
  id: string;
  href?: string;
  name?: string;
  role?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType': string;
}

export interface Note {
  id?: string;
  author?: string;
  date?: string;
  text: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface Characteristic {
  id?: string;
  name: string;
  valueType?: string;
  value: any;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface Money {
  unit?: string;
  value?: number;
}

export interface Price {
  percentage?: number;
  taxRate?: number;
  dutyFreeAmount?: Money;
  taxIncludedAmount?: Money;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface ProductOfferingPriceRef {
  id: string;
  href?: string;
  name?: string;
  version: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface PriceAlteration {
  applicationDuration?: number;
  description?: string;
  name?: string;
  priceType: string;
  priority?: number;
  alterationType: string;
  recurringChargePeriod?: string;
  unitOfMeasure?: string;
  price: Price;
  productOfferingPrice?: ProductOfferingPriceRef;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface QuotePrice {
  description?: string;
  name?: string;
  priceType?: string;
  recurringChargePeriod?: string;
  unitOfMeasure?: string;
  price?: Price;
  priceAlteration?: PriceAlteration[];
  productOfferingPrice?: ProductOfferingPriceRef;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface ProductOfferingRef {
  id: string;
  href: string;
  version: string;
  name?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface ProductRefOrValue {
    id?: string;
    href?: string;
    name?: string;
    productOffering?: ProductOfferingRef;
    // other fields as needed
}

export interface QuoteItem {
  id: string;
  action: 'add' | 'modify' | 'delete' | 'no-change';
  quantity?: number;
  state?: string;
  note?: Note[];
  product?: ProductRefOrValue;
  productOffering?: ProductOfferingRef;
  quoteItemPrice?: QuotePrice[];
  relatedParty?: RelatedParty[];
  quoteItemCharacteristic?: Characteristic[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface QuoteCreate {
  category?: string;
  description?: string;
  externalId?: string;
  instantSyncQuote?: boolean;
  requestedQuoteCompletionDate?: string;
  note?: Note[];
  quoteItem: QuoteItem[];
  relatedParty?: RelatedParty[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  validFor?: TimePeriod;
  quoteCharacteristic?: Characteristic[];
}

export interface QuoteUpdate {
  category?: string;
  description?: string;
  externalId?: string;
  instantSyncQuote?: boolean;
  requestedQuoteCompletionDate?: string;
  note?: Note[];
  quoteItem?: QuoteItem[];
  relatedParty?: RelatedParty[];
  state?: 'inProgress' | 'pending' | 'cancelled' | 'approved' | 'accepted' | 'rejected';
  validFor?: TimePeriod;
  quoteCharacteristic?: Characteristic[];
}

export interface Quote extends QuoteCreate {
  id: string;
  href: string;
  version?: string;
  state?: string;
  quoteDate?: string;
  quoteTotalPrice?: QuotePrice[];
}

export interface JsonPatch {}