export interface DocumentApi {
  id?: string;
  href?: string;
  name?: string;
  description?: string;
  documentType?: string;
  lifecycleState?: string;
  version?: string;
  attachmentType?: string;
  mimeType?: string;
  url?: string;
  size?: Quantity;
  validFor?: TimePeriod;
  category?: CategoryRef[];
  externalReference?: ExternalReference[];
  aclRelatedParty?: RelatedParty[];
  binaryAttachment?: AttachmentRefOrValue[];
  characteristic?: Characteristic[];
  documentRelationship?: DocumentRef[];
  documentSpecification?: DocumentSpecification;
  relatedEntity?: RelatedEntity;
  relatedParty?: RelatedParty[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
  revision?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface DocumentCreate {
  name: string;
  description?: string;
  documentType?: string;
  lifecycleState?: string;
  version?: string;
  binaryAttachment?: AttachmentRefOrValue[];
  category?: CategoryRef[];
  characteristic?: Characteristic[];
  documentRelationship?: DocumentRef[];
  documentSpecification?: DocumentSpecification;
  relatedEntity?: RelatedEntity;
  relatedParty?: RelatedParty[];
  externalReference?: ExternalReference[];
  aclRelatedParty?: RelatedParty[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface DocumentUpdate {
  creationDate?: string;
  description?: string;
  documentType?: string;
  lastUpdate?: string;
  lifecycleState?: string;
  name?: string;
  version?: string;
  binaryAttachment?: AttachmentRefOrValue[];
  category?: CategoryRef[];
  characteristic?: Characteristic[];
  documentRelationship?: DocumentRef[];
  documentSpecification?: DocumentSpecification;
  relatedEntity?: RelatedEntity;
  relatedParty?: RelatedParty[];
  externalReference?: ExternalReference[];
  aclRelatedParty?: RelatedParty[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface AttachmentCreate {
  attachmentType: string;
  mimeType: string;
  id?: string;
  description?: string;
  name?: string;
  size?: Quantity;
  url?: string;
  validFor?: TimePeriod;
  category?: CategoryRef[];
  externalReference?: ExternalReference[];
  aclRelatedParty?: RelatedParty[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface AttachmentUpdate {
  description?: string;
  mimeType?: string;
  name?: string;
  size?: Quantity;
  attachmentType?: string;
  url?: string;
  validFor?: TimePeriod;
  category?: CategoryRef[];
  externalReference?: ExternalReference[];
  aclRelatedParty?: RelatedParty[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface Quantity {
  amount?: number;
  units?: string;
}

export interface TimePeriod {
  startDateTime?: string;
  endDateTime?: string;
}

export interface CategoryRef {
  id: string;
  href?: string;
  name?: string;
  version?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface ExternalReference {
  externalReferenceType: string;
  id: string;
  name: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface RelatedParty {
  '@referredType': string;
  id: string;
  href?: string;
  name?: string;
  role?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface RelatedEntity {
  '@referredType': string;
  id: string;
  role: string;
  href?: string;
  name?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface AttachmentRefOrValue {
  id?: string;
  href?: string;
  attachmentType?: string;
  description?: string;
  mimeType?: string;
  name?: string;
  url?: string;
  size?: Quantity;
  validFor?: TimePeriod;
  category?: CategoryRef[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface Characteristic {
  name: string;
  value: string;
  id?: string;
  valueType?: string;
  characteristicRelationship?: CharacteristicRelationship[];
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface CharacteristicRelationship {
  id?: string;
  relationshipType?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}

export interface DocumentRef {
  id: string;
  href?: string;
  name?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
  '@referredType'?: string;
}

export interface DocumentSpecification {
  id?: string;
  href?: string;
  URL?: string;
  name?: string;
  version?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
  '@type'?: string;
}