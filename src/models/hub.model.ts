// All models related to the Hub feature are defined in this single file.

export interface EventSubscriptionInput {
  callback: string;
  query?: string;
}

export interface EventSubscription {
  id: string;
  callback: string;
  query?: string;
  revision?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Error {
  code?: string;
  reason?: string;
  message?: string;
  status?: string;
  referenceError?: string;
  baseType?: string;
  schemaLocation?: string;
  type?: string;
}