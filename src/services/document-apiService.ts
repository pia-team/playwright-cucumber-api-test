import { ApiClient } from '../core/api/apiClient';
import { buildApiUrl } from '../utils/apiUrl';
import { DocumentApi } from '../models/document-api.model';
import { endpoints } from '../config/document-api.endpoints';

export class DocumentApiService {
  constructor(private api: ApiClient) {}

  getCreateDocumentUrl(): string {
    return buildApiUrl(endpoints.document.baseURI, endpoints.document.create);
  }

  getListDocumentsUrl(): string {
    return buildApiUrl(endpoints.document.baseURI, endpoints.document.list);
  }

  getDocumentByIdUrl(id: string): string {
    return buildApiUrl(endpoints.document.baseURI, endpoints.document.byId.replace('{id}', id));
  }

  getCreateAttachmentUrl(): string {
    return buildApiUrl(endpoints.attachment.baseURI, endpoints.attachment.create);
  }

  getListAttachmentsUrl(): string {
    return buildApiUrl(endpoints.attachment.baseURI, endpoints.attachment.list);
  }

  getAttachmentByIdUrl(id: string): string {
    return buildApiUrl(endpoints.attachment.baseURI, endpoints.attachment.byId.replace('{id}', id));
  }

  async createDocument(payload: Partial<DocumentApi>): Promise<any> {
    const url = this.getCreateDocumentUrl();
    return this.api.post(url, payload);
  }

  async listDocuments(params?: Record<string, string | number>): Promise<any> {
    const url = this.getListDocumentsUrl();
    return this.api.get(url, params ? { params } : undefined);
  }

  async getDocumentById(id: string, params?: Record<string, string | number>): Promise<any> {
    const url = this.getDocumentByIdUrl(id);
    return this.api.get(url, params ? { params } : undefined);
  }

  async updateDocument(id: string, payload: Partial<DocumentApi>): Promise<any> {
    const url = this.getDocumentByIdUrl(id);
    return this.api.patch(url, payload, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  }

  async deleteDocument(id: string): Promise<any> {
    const url = this.getDocumentByIdUrl(id);
    return this.api.delete(url);
  }

  async createAttachment(payload: Partial<DocumentApi>): Promise<any> {
    const url = this.getCreateAttachmentUrl();
    return this.api.post(url, payload);
  }

  async listAttachments(params?: Record<string, string | number>): Promise<any> {
    const url = this.getListAttachmentsUrl();
    return this.api.get(url, params ? { params } : undefined);
  }

  async getAttachmentById(id: string, params?: Record<string, string | number>): Promise<any> {
    const url = this.getAttachmentByIdUrl(id);
    return this.api.get(url, params ? { params } : undefined);
  }

  async updateAttachment(id: string, payload: Partial<DocumentApi>): Promise<any> {
    const url = this.getAttachmentByIdUrl(id);
    return this.api.patch(url, payload, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  }

  async deleteAttachment(id: string): Promise<any> {
    const url = this.getAttachmentByIdUrl(id);
    return this.api.delete(url);
  }
}