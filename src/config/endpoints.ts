export const endpoints = {
  keycloackAuth: {
    baseURI: 'https://learning.test.orbitant.dev',
    token: '/realms/orbitant-realm/protocol/openid-connect/token',
  },
  quoteManagement: {
    baseURI: 'https://learning.test.orbitant.dev/api/quoteManagement/v4',
    quote: {
      list: '/quote',
      create: '/quote',
      byId: (id: string) => `/quote/${id}`,
      update: (id: string) => `/quote/${id}`,
      delete: (id: string) => `/quote/${id}`,
    },
    hub: {
      list: '/hub',
      register: '/hub',
      unregister: (id: string) => `/hub/${id}`,
    },
  },
  productCatalogManagement: {
    baseURI: 'https://learning.test.orbitant.dev/api/productCatalogManagement/v2',

    catalog: {
      list: '/catalog',
      create: '/catalog',
      byId: (id: string) => `/catalog/${id}`,
      update: (id: string) => `/catalog/${id}`,
      delete: (id: string) => `/catalog/${id}`,
    },
    category: {
      list: '/category',
      create: '/category',
      byId: (id: string) => `/category/${id}`,
      update: (id: string) => `/category/${id}`,
      delete: (id: string) => `/category/${id}`,
    }
  }
} as const;