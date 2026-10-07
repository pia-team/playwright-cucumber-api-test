export const endpoints = {
  document: {
    baseURI: 'https://ddms-api.test.dev-gcu.com/api/documentManagement/v4',
    list: '/document',
    create: '/document',
    byId: '/document/{id}'
  },
  attachment: {
    baseURI: 'https://ddms-api.test.dev-gcu.com/api/documentManagement/v4',
    list: '/attachment',
    create: '/attachment',
    byId: '/attachment/{id}'
  },
  hub: {
    baseURI: 'https://ddms-api.test.dev-gcu.com/api/documentManagement/v4',
    register: '/hub',
    byId: '/hub/{id}'
  }
};