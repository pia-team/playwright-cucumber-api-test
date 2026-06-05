export const endpoints = {
  quote: {
    baseURI: 'https://quote-api.pi.dev-gcu.com/api/quoteManagement/v4',
    list: '/quote',
    create: '/quote',
    byId: (id: string) => `/quote/${id}`,
  },
};