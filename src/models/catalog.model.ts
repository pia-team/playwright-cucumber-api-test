export interface Catalog {
    id: string;
    href: string;
    name: string;
    version: string;
    lifecycleStatus: CatalogLifecycleStatus;
  
    revision: number;
    createdDate: string;
    updatedDate: string;
    lastUpdate: string;
  
    createdBy: string;
    updatedBy: string;
  
    aclRelatedParty: RelatedParty[];
    category: Category[];
  
    '@baseType': string;
    '@schemaLocation': string;
    '@type': string;
  }
  

  export interface RelatedParty {
    id: string;
    name: string;
    role: string;
  
    '@referredType': string;
    '@type': string;
  }
  

  export interface Category {
    id: string;
    href: string;
    name: string;
    version: string;
  }
  
  export enum CatalogLifecycleStatus {
    InDesign = 'InDesign',
    Launched = 'Launched',
    Retired = 'Retired',
    Obsolete = 'Obsolete'
  }
  