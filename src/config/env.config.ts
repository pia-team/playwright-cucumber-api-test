import { endpoints } from './endpoints';

// Helper to get the first available baseURI from endpoints
const getFirstBaseURI = (): string => {
    const firstGroup = Object.values(endpoints)[0] as any;
    return firstGroup?.baseURI || 'https://dpc-api-pre.non-prod.pt-digital.engineering.vodafone.com';
};

export const envConfig = {
    baseUrl: process.env.BASE_URL || getFirstBaseURI(),
    token: process.env.API_TOKEN
};