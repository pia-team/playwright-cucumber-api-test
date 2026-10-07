export interface RoleType {
  id?: string;
  href?: string;
  name?: string;
  description?: string;
  requiresBilling?: boolean;
  requiresSettlement?: boolean;
  revision?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  agreement?: AgreementRef[];
  aclRelatedParty?: AclRelatedParty[];
}

export interface RoleTypeCreate {
  name: string;
  description?: string;
  requiresBilling?: boolean;
  requiresSettlement?: boolean;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  agreement?: AgreementRef[];
  aclRelatedParty?: AclRelatedParty[];
}

export interface RoleTypeUpdate {
  name?: string;
  description?: string;
  requiresBilling?: boolean;
  requiresSettlement?: boolean;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  agreement?: AgreementRef[];
  aclRelatedParty?: AclRelatedParty[];
}

export interface PartyRole {
  id?: string;
  href?: string;
  name?: string;
  status?: string;
  statusReason?: string;
  revision?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  roleType?: RoleTypeRef;
  engagedParty?: PartyRef;
  account?: AccountRef[];
  agreement?: AgreementRef[];
  attachment?: AttachmentRefOrValue[];
  characteristic?: Characteristic[];
  contactMedium?: ContactMedium[];
  creditProfile?: CreditProfile[];
  paymentMethod?: PaymentMethodRef[];
  relatedParty?: RelatedParty[];
  externalReference?: ExternalReference[];
  validFor?: TimePeriod;
  aclRelatedParty?: AclRelatedParty[];
}

export interface PartyRoleCreate {
  name: string;
  engagedParty: PartyRef;
  roleType: RoleTypeRef;
  status?: string;
  statusReason?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  account?: AccountRef[];
  agreement?: AgreementRef[];
  attachment?: AttachmentRef[];
  characteristic?: Characteristic[];
  contactMedium?: ContactMedium[];
  creditProfile?: CreditProfile[];
  paymentMethod?: PaymentMethodRef[];
  relatedParty?: RelatedParty[];
  externalReference?: ExternalReference[];
  validFor?: TimePeriod;
  aclRelatedParty?: AclRelatedParty[];
}

export interface PartyRoleUpdate {
  name?: string;
  status?: string;
  statusReason?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  roleType?: RoleTypeRef;
  engagedParty?: PartyRef;
  account?: AccountRef[];
  agreement?: AgreementRef[];
  attachment?: AttachmentRefOrValue[];
  characteristic?: Characteristic[];
  contactMedium?: ContactMedium[];
  creditProfile?: CreditProfile[];
  paymentMethod?: PaymentMethodRef[];
  relatedParty?: RelatedParty[];
  externalReference?: ExternalReference[];
  validFor?: TimePeriod;
  aclRelatedParty?: AclRelatedParty[];
}

export interface AgreementRef {
  id?: string;
  href?: string;
  name?: string;
  description?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface AclRelatedParty {
  id?: string;
  href?: string;
  name?: string;
  role?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface RoleTypeRef {
  id?: string;
  href?: string;
  name?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface PartyRef {
  id?: string;
  href?: string;
  name?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface AccountRef {
  id?: string;
  href?: string;
  name: string;
  description?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface AttachmentRefOrValue {
  id?: string;
  href?: string;
  name?: string;
  attachmentType?: string;
  content?: string;
  description?: string;
  documentType?: string;
  mimeType?: string;
  url?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface Characteristic {
  name: string;
  value?: string;
  valueType?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface ContactMedium {
  mediumType?: string;
  preferred?: boolean;
  characteristic?: MediumCharacteristic;
  validFor?: TimePeriod;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface MediumCharacteristic {
  city?: string;
  contactType?: string;
  country?: string;
  emailAddress?: string;
  faxNumber?: string;
  phoneNumber?: string;
  postCode?: string;
  socialNetworkId?: string;
  stateOrProvince?: string;
  street1?: string;
  street2?: string;
  town?: string;
  locality?: string;
  buildingNumber?: string;
  unitNumber?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  place?: RelatedPlaceRef[];
}

export interface RelatedPlaceRef {
  id?: string;
  href?: string;
  name?: string;
  role: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface CreditProfile {
  creditProfileDate: string;
  creditRiskRating?: number;
  creditScore?: number;
  validFor: TimePeriod;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface PaymentMethodRef {
  id?: string;
  href?: string;
  name?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface RelatedParty {
  id?: string;
  href?: string;
  name?: string;
  role?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface ExternalReference {
  id: string;
  href?: string;
  name: string;
  externalReferenceType: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface TimePeriod {
  startDateTime?: string;
  endDateTime?: string;
}