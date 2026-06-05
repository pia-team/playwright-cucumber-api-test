export interface AttachmentRefOrValue {
  id?: string;
  name?: string;
  attachmentType?: string;
  url?: string;
}

export interface AgreementSpecification_Create {
  name: string;
  attachment: AttachmentRefOrValue[];
  description?: string;
  isBundle?: boolean;
  version?: string;
  lastUpdate?: string;
  lifecycleStatus?: string;
  lifecycleStatusReason?: string;
  relatedParty?: any[];
  specificationCharacteristic?: any[];
  specificationRelationship?: any[];
  validFor?: any;
  aclRelatedParty?: any[];
}

export interface AgreementSpecification_Update {
  name?: string;
  description?: string;
  attachment?: AttachmentRefOrValue[];
  isBundle?: boolean;
  version?: string;
  lastUpdate?: string;
  lifecycleStatus?: string;
  lifecycleStatusReason?: string;
  relatedParty?: any[];
  specificationCharacteristic?: any[];
  specificationRelationship?: any[];
  validFor?: any;
  aclRelatedParty?: any[];
}

export interface Agreement_Create {
  agreementItem: { id: string }[];
  agreementType: string;
  engagedParty: { id: string; name: string; '@referredType': string }[];
  name: string;
  description?: string;
  documentNumber?: number;
  initialDate?: string;
  statementOfIntent?: string;
  status?: string;
  statusReason?: string;
  version?: string;
  agreementAuthorization?: any[];
  agreementPeriod?: any;
  agreementSpecification?: { id: string; href: string };
  associatedAgreement?: any[];
  attachment?: AttachmentRefOrValue[];
  characteristic?: any[];
  externalReference?: any[];
  aclRelatedParty?: any[];
  id?: string;
  completionDate?: any;
}

export interface Agreement_Update {
  name?: string;
  description?: string;
  documentNumber?: number;
  initialDate?: string;
  statementOfIntent?: string;
  status?: string;
  statusReason?: string;
  version?: string;
  agreementAuthorization?: any[];
  agreementPeriod?: any;
  agreementSpecification?: { id: string; href: string };
  associatedAgreement?: any[];
  attachment?: AttachmentRefOrValue[];
  characteristic?: any[];
  externalReference?: any[];
  aclRelatedParty?: any[];
  agreementType?: string;
  agreementItem?: { id: string }[];
  engagedParty?: { id: string; name: string; '@referredType': string }[];
}