import SipService from './sipService';

let sipServiceInstance: SipService | null = null;

export const setSipServiceInstance = (instance: SipService | null) => {
  sipServiceInstance = instance;
};

export const getSipServiceInstance = () => {
  return sipServiceInstance;
};

