export const endpoints = {
  agreementSpecification: {
    baseURI: 'https://dagm-api.pi.dev-gcu.com/api/agreementManagement/v4',
    list: '/agreementSpecification',
    byId: (id: string) => `/agreementSpecification/${id}`,
  },
  agreement: {
    baseURI: 'https://dagm-api.pi.dev-gcu.com/api/agreementManagement/v4',
    list: '/agreement',
    byId: (id: string) => `/agreement/${id}`,
  },
};