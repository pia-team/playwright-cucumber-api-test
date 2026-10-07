export const endpoints = {
  baseURI: 'https://dpr-api.dnextsmf-orangedev.com/api/partyRoleManagement/v4',
  /** Individual/Organization live under Party Management (TMF632), not Party Role Management. */
  partyManagementBaseURI: 'https://dpam-api.dnextsmf-orangedev.com/api/partyManagement/v4',
  roleType: {
    list: '/roleType',
    create: '/roleType',
    byId: (id: string) => `/roleType/${id}`
  },
  partyRole: {
    list: '/partyRole',
    create: '/partyRole',
    byId: (id: string) => `/partyRole/${id}`
  },
  individual: {
    create: '/individual',
  },
};
