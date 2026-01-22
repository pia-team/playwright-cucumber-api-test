import { ApiClient } from '../core/api/apiClient';
import { Catalog } from '../models/catalog.model';
import { endpoints } from '../config/endpoints';

export class CatalogService {
  constructor(private api: ApiClient) {}

  createCatalog(catalog: Catalog) {
    return this.api.post(endpoints.productCatalogManagement.catalog.create, catalog);
  }

  getCatalog(id: string) {
    return this.api.get(endpoints.productCatalogManagement.catalog.byId(id));
  }

  getCatalogs(params?: { limit?: number; sort?: string; offset?: number }) {
    return this.api.get(endpoints.productCatalogManagement.catalog.list, {
      params: params as Record<string, string | number>
    });
  }

  updateCatalog(id: string, catalog: Catalog) {
    return this.api.put(endpoints.productCatalogManagement.catalog.update(id), catalog);
  }

  deleteCatalog(id: string) {
    return this.api.delete(endpoints.productCatalogManagement.catalog.delete(id));
  }
}
