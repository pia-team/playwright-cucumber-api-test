export const endpoints = {
  shoppingCart: {
    baseURI: 'https://dsales-api.pi.dev-gcu.com/api/shoppingCart/v4',
    create: '/shoppingCart',
    list: '/shoppingCart',
    retrieve: (id: string) => `/shoppingCart/${id}`,
    update: (id: string) => `/shoppingCart/${id}`,
    delete: (id: string) => `/shoppingCart/${id}`,
  },
};