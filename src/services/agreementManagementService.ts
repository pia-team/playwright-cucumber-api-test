import { ApiClient } from '../core/api/apiClient';
import { buildApiUrl } from '../utils/apiUrl';
import { endpoints } from '../config/agreementManagement.endpoints';

export class AgreementManagementService {
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  async getAgreementSpecifications(params?: Record<string, string | number>) {
    const url = buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list);
    return this.api.get(url, params ? { params } : undefined);
  }

  async createAgreementSpecification(body: any) {
    const url = buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list);
    return this.api.post(url, body);
  }

  async getAgreementSpecification(id: string) {
    const url = buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.byId(id));
    return this.api.get(url);
  }

  async patchAgreementSpecification(id: string, body: any) {
    const url = buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.byId(id));
    return this.api.patch(url, body, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  }

  async deleteAgreementSpecification(id: string) {
    const url = buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.byId(id));
    return this.api.delete(url);
  }

  async getAgreements(params?: Record<string, string | number>) {
    const url = buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list);
    return this.api.get(url, params ? { params } : undefined);
  }

  async createAgreement(body: any) {
    const url = buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list);
    return this.api.post(url, body);
  }

  async getAgreement(id: string) {
    const url = buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.byId(id));
    return this.api.get(url);
  }

  async patchAgreement(id: string, body: any) {
    const url = buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.byId(id));
    return this.api.patch(url, body, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  }

  async deleteAgreement(id: string) {
    const url = buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.byId(id));
    return this.api.delete(url);
  }
}