import { ApiClient } from '../core/api/apiClient';
import { endpoints } from '../config/endpoints';

export class CategoryService {
  constructor(private api: ApiClient) {}

  getCategories() {
    return this.api.get(endpoints.productCatalogManagement.category.list);
  }

  getCategory(id: string) {
    return this.api.get(endpoints.productCatalogManagement.category.byId(id));
  }

  createCategory(category: any) {
    return this.api.post(endpoints.productCatalogManagement.category.create, category);
  }

  updateCategory(id: string, category: any) {
    return this.api.put(endpoints.productCatalogManagement.category.update(id), category);
  }

  deleteCategory(id: string) {
    return this.api.delete(endpoints.productCatalogManagement.category.delete(id));
  }
}
