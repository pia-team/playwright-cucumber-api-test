import { ApiClient } from '../core/api/apiClient';
import { buildApiUrl } from '../utils/apiUrl';
import { endpoints } from '../config/party_role.endpoints';
import { RoleType, PartyRole } from '../models/party_role.model';

export class PartyRoleService {
  private api: ApiClient;

  constructor(apiClient: ApiClient) {
    this.api = apiClient;
  }

  async listRoleTypes(params?: Record<string, string | number>) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.list);
    return this.api.get(url, params ? { params } : undefined);
  }

  async createRoleType(body: Partial<RoleType>) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.create);
    return this.api.post(url, body);
  }

  async getRoleTypeById(id: string) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.byId(id));
    return this.api.get(url);
  }

  async updateRoleType(id: string, body: Partial<RoleType>) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.byId(id));
    return this.api.patch(url, body, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  }

  async deleteRoleType(id: string) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.byId(id));
    return this.api.delete(url);
  }

  async listPartyRoles(params?: Record<string, string | number>) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.list);
    return this.api.get(url, params ? { params } : undefined);
  }

  async createPartyRole(body: Partial<PartyRole>) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.create);
    return this.api.post(url, body);
  }

  async getPartyRoleById(id: string) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.byId(id));
    return this.api.get(url);
  }

  async updatePartyRole(id: string, body: Partial<PartyRole>) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.byId(id));
    return this.api.patch(url, body, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  }

  async deletePartyRole(id: string) {
    const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.byId(id));
    return this.api.delete(url);
  }
}