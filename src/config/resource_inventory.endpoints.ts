export const endpoints = {
  bulkResourceCreate: {
    baseURI: 'https://dri-api.dnextsmf-orangedev.com/api/resourceInventoryManagement/v4',
    create: '/bulkResourceCreate'
  },
  bulkResourceStatusUpdate: {
    baseURI: 'https://dri-api.dnextsmf-orangedev.com/api/resourceInventoryManagement/v4',
    create: '/bulkResourceStatusUpdate'
  },
  resource: {
    baseURI: 'https://dri-api.dnextsmf-orangedev.com/api/resourceInventoryManagement/v4',
    list: '/resource',
    create: '/resource',
    byId: (id: string) => `/resource/${id}`
  }
};