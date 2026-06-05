export interface ShoppingCartCreate {
  status?: string;
  statusReason?: string;
  cartItem?: any[];
  contactMedium?: any[];
  contact?: any[];
  externalReference?: any[];
  relatedParty?: any[];
  channel?: any[];
  shoppingCartCharacteristic?: any[];
  payment?: any[];
  note?: any[];
  requestedOrderStartDate?: string;
  requestedOrderCompletionDate?: string;
  agreement?: any[];
  billingAccount?: any;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  priceAlteration?: any[];
  aclRelatedParty?: any[];
  id?: string;
  cartTotalPrice?: any[];
  validFor?: any;
}

export interface ShoppingCartUpdate {
  status?: string;
  statusReason?: string;
  cartItem?: any[];
  contactMedium?: any[];
  contact?: any[];
  externalReference?: any[];
  relatedParty?: any[];
  channel?: any[];
  shoppingCartCharacteristic?: any[];
  payment?: any[];
  note?: any[];
  requestedOrderStartDate?: string;
  requestedOrderCompletionDate?: string;
  agreement?: any[];
  billingAccount?: any;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  priceAlteration?: any[];
  aclRelatedParty?: any[];
}

export interface ShoppingCart {
  revision?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
  id?: string;
  href?: string;
  shoppingCartCharacteristic?: any[];
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  cartItem?: any[];
  cartTotalPrice?: any[];
  status?: string;
  statusReason?: string;
  contactMedium?: any[];
  contact?: any[];
  relatedParty?: any[];
  validFor?: any;
  channel?: any[];
  externalReference?: any[];
  payment?: any[];
  note?: any[];
  endDateTime?: string;
  requestedOrderStartDate?: string;
  requestedOrderCompletionDate?: string;
  agreement?: any[];
  billingAccount?: any;
  category?: string;
  description?: string;
  productOfferingQualification?: any[];
  attachment?: any[];
  relatedEntity?: any[];
  priceAlteration?: any[];
  aclRelatedParty?: any[];
}