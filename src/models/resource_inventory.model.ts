export interface ResourceInventory {
  id?: string;
  href?: string;
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  name?: string;
  description?: string;
  category?: string;
  resourceVersion?: string;
  startOperatingDate?: string;
  endOperatingDate?: string;
  administrativeState?: string;
  operationalState?: string;
  usageState?: string;
  resourceStatus?: string;
  statusReason?: string;
  value?: string;
  serialNumber?: string;
  manufactureDate?: string;
  powerState?: string;
  versionNumber?: string;
  resourceSpecification?: ResourceSpecificationRef;
  place?: RelatedPlaceRefOrValue;
  relatedParty?: RelatedParty[];
  resourceCharacteristic?: Characteristic[];
  resourceRelationship?: ResourceRelationship[];
  attachment?: AttachmentRefOrValue[];
  note?: Note[];
  externalReference?: ExternalReference[];
  activationFeature?: Feature[];
  resourceOrderItem?: RelatedResourceOrderItem[];
  productOrderItem?: RelatedProductOrderItem[];
  serviceOrderItem?: RelatedServiceOrderItem[];
  relatedEntity?: RelatedEntityRefOrValue[];
  aclRelatedParty?: RelatedParty[];
  extensions?: IdentifierRange;
  revision?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ResourceCreate {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  name: string;
  description?: string;
  category?: string;
  resourceVersion?: string;
  startOperatingDate?: string;
  endOperatingDate?: string;
  administrativeState?: string;
  operationalState?: string;
  usageState?: string;
  resourceStatus?: string;
  statusReason?: string;
  resourceSpecification?: ResourceSpecificationRef;
  place?: RelatedPlaceRefOrValue;
  relatedParty?: RelatedParty[];
  resourceCharacteristic?: Characteristic[];
  resourceRelationship?: ResourceRelationship[];
  attachment?: AttachmentRefOrValue[];
  note?: Note[];
  externalReference?: ExternalReference[];
  activationFeature?: Feature[];
  resourceOrderItem?: RelatedResourceOrderItem[];
  productOrderItem?: RelatedProductOrderItem[];
  serviceOrderItem?: RelatedServiceOrderItem[];
  relatedEntity?: RelatedEntityRefOrValue[];
  aclRelatedParty?: RelatedParty[];
  extensions?: IdentifierRange;
}

export interface LogicalResourceCreate extends ResourceCreate {
  '@type'?: 'LogicalResource';
  value?: string;
  '@referredType'?: string;
}

export interface PhysicalResourceCreate extends ResourceCreate {
  '@type'?: 'PhysicalResource';
  serialNumber: string;
  manufactureDate?: string;
  powerState?: string;
  versionNumber?: string;
  '@referredType'?: string;
}

export interface ResourceUpdate {
  name?: string;
  description?: string;
  category?: string;
  resourceVersion?: string;
  startOperatingDate?: string;
  endOperatingDate?: string;
  administrativeState?: string;
  operationalState?: string;
  usageState?: string;
  resourceStatus?: string;
  statusReason?: string;
  resourceSpecification?: ResourceSpecificationRef;
  place?: RelatedPlaceRefOrValue;
  relatedParty?: RelatedParty[];
  resourceCharacteristic?: Characteristic[];
  resourceRelationship?: ResourceRelationship[];
  attachment?: AttachmentRefOrValue[];
  note?: Note[];
  externalReference?: ExternalReference[];
  activationFeature?: Feature[];
  resourceOrderItem?: RelatedResourceOrderItem[];
  productOrderItem?: RelatedProductOrderItem[];
  serviceOrderItem?: RelatedServiceOrderItem[];
  relatedEntity?: RelatedEntityRefOrValue[];
  aclRelatedParty?: RelatedParty[];
  extensions?: IdentifierRange;
}

export interface BulkResourceCreate {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  jobReference?: string;
  itemCount: number;
  baseResource: LogicalResourceCreate | PhysicalResourceCreate;
  bulkCharacteristic: BulkCharacteristic[];
}

export interface BulkResourceStatusUpdate {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  itemCount: number;
  resourceStatus?: string;
  jobReference?: string;
  bulkCharacteristic?: BulkCharacteristic;
}

export interface BulkCharacteristic {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  name: string;
  isUnique?: boolean;
  isVisible?: boolean;
  isIdentifier?: boolean;
  counterType?: string;
  valueMask: string;
  valueFrom: string;
  valueTo: string;
  isPopulateCharacteristicValueToResourceName?: boolean;
}

export interface BulkResource {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  jobReference?: string;
  itemCount?: number;
  baseResource?: LogicalResourceCreate | PhysicalResourceCreate;
  resourceCharacteristicTemplate?: BulkCharacteristic[];
  revision?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ResourceSpecificationRef {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id: string;
  href: string;
  name?: string;
  version?: string;
  '@referredType'?: string;
}

export interface RelatedPlaceRefOrValue {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  href?: string;
  name?: string;
  role: string;
  city?: string;
  country?: string;
  locality?: string;
  postcode?: string;
  stateOrProvince?: string;
  streetName?: string;
  streetNr?: string;
  streetType?: string;
  geographicLocation?: GeographicLocationRefOrValue;
  geographicSubAddress?: GeographicSubAddress[];
  externalReference?: ExternalReference[];
  '@referredType'?: string;
}

export interface RelatedParty {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id: string;
  href?: string;
  name?: string;
  role?: string;
  '@referredType': string;
}

export interface Characteristic {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  name: string;
  valueType?: string;
  value?: string;
  characteristicRelationship?: CharacteristicRelationship[];
}

export interface CharacteristicRelationship {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  relationshipType?: string;
}

export interface ResourceRelationship {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  relationshipType?: string;
  resource: ResourceRefOrValue;
}

export interface ResourceRefOrValue {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  href?: string;
  name?: string;
  description?: string;
  category?: string;
  '@referredType'?: string;
}

export interface AttachmentRefOrValue {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  href?: string;
  name?: string;
  attachmentType?: string;
  content?: string;
  description?: string;
  mimeType?: string;
  url?: string;
  size?: Quantity;
  validFor?: TimePeriod;
  '@referredType'?: string;
}

export interface Note {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  author?: string;
  date?: string;
  text?: string;
}

export interface ExternalReference {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  href?: string;
  name: string;
  externalReferenceType?: string;
}

export interface Feature {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  isBundle?: boolean;
  isEnabled?: boolean;
  name: string;
  constraint?: ConstraintRef[];
  featureCharacteristic?: Characteristic[];
  featureRelationship?: FeatureRelationship[];
  featureBundle?: FeatureBundle[];
}

export interface ConstraintRef {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id: string;
  href?: string;
  name?: string;
  version?: string;
  '@referredType'?: string;
}

export interface FeatureRelationship {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  name: string;
  relationshipType: string;
  validFor?: TimePeriod;
}

export interface FeatureBundle {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  href?: string;
  id?: string;
  lifecycleStatus?: string;
  name?: string;
}

export interface GeographicLocationRefOrValue {
  '@type': string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  href?: string;
  name?: string;
  bbox?: number[];
  '@referredType'?: string;
}

export interface GeographicSubAddress {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  href?: string;
  name?: string;
  buildingName?: string;
  levelNumber?: string;
  levelType?: string;
  privateStreetName?: string;
  privateStreetNumber?: string;
  subAddressType?: string;
  subUnitNumber?: string;
  subUnitType?: string;
}

export interface Quantity {
  amount?: number;
  units?: string;
}

export interface TimePeriod {
  startDateTime?: string;
  endDateTime?: string;
}

export interface RelatedResourceOrderItem {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  itemId: string;
  resourceOrderId: string;
  role?: string;
  resourceOrderHref?: string;
  itemAction?: string;
  '@referredType'?: string;
}

export interface RelatedProductOrderItem {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  orderItemAction?: string;
  orderItemId?: string;
  productOrderHref?: string;
  productOrderId?: string;
  role?: string;
  '@referredType'?: string;
}

export interface RelatedServiceOrderItem {
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  itemAction?: string;
  itemId?: string;
  serviceOrderHref?: string;
  serviceOrderId?: string;
  role?: string;
  '@referredType'?: string;
}

export interface RelatedEntityRefOrValue {
  '@type': string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  id?: string;
  href?: string;
  name?: string;
  role: string;
  '@referredType'?: string;
}

export interface IdentifierRange {
  quantity: number;
  rangeStart: string;
  rangeEnd: string;
}