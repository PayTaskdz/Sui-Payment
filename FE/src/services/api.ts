import axios from 'axios';

const VITE_API_URL = import.meta.env.VITE_API_URL || 'https://sui-payment.onrender.com/api';

const api = axios.create({
  baseURL: VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type ApiEnvelope<T> = T | { data: T } | { result: T };

const unwrap = <T>(payload: ApiEnvelope<T>): T => {
  if (payload && typeof payload === 'object') {
    if ('data' in payload) return (payload as { data: T }).data;
    if ('result' in payload) return (payload as { result: T }).result;
  }
  return payload as T;
};

export const getData = async <T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> => {
  const res = await promise;
  return unwrap<T>(res.data);
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type WalletChallengeResponseDto = {
  nonce: string;
  expiresAt: string;
  domain: string;
};

export type WalletVerifyRequestDto = {
  address: string;
  domain?: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  statement?: string;
  message: string;
  signature: string;
};

export const getChallenge = (address: string) => api.get<WalletChallengeResponseDto>('/auth/challenge', {
  params: { address },
});

export const postVerify = (dto: WalletVerifyRequestDto) => api.post('/auth/verify', dto);

export const getZkLoginChallenge = () => api.get('/auth/zklogin/challenge');
export const postZkLoginSalt = (dto: { sub: string }) => api.post('/auth/zklogin/salt', dto);
export const postZkLoginRegister = (dto: { nonceBase64Url: string; maxEpoch: number }) =>
  api.post('/auth/zklogin/register', dto);
export const postZkLoginVerify = (dto: unknown) => api.post('/auth/zklogin/verify', dto);
export type RegisterRequestDto = {
  walletAddress: string;
  username: string;
  email?: string;
};

export const postRegister = (dto: RegisterRequestDto) => api.post('/wallet/register', dto);

export const getProfile = () => api.get('/users/profile');

export const updateProfile = (dto: { email?: string; firstName?: string; lastName?: string }) =>
  api.patch('/users/profile', dto);

export const changeUsername = (newUsername: string) => api.patch('/users/profile/username', { newUsername });

// User lookup for transfers
export type LookupUserDefaultWallet =
  | { id: string; type: 'onchain'; address: string; chain: string }
  | { id: string; type: 'offchain'; bankName: string; accountNumber: string; accountName: string; qrString: string };

export type LookupUserResponseDto = {
  userId: string;
  username: string;
  walletAddress: string;
  kycStatus: string;
  canReceiveTransfer: boolean;
  defaultWallet: LookupUserDefaultWallet | null;
};

export const lookupUser = (username: string) =>
  api.get<LookupUserResponseDto>(`/users/lookup?username=${username}`);

export type CheckUsernameResponseDto = {
  available: boolean;
};

export const checkUsername = (username: string) =>
  api.get<CheckUsernameResponseDto>('/users/check-username', { params: { username } });

export const postOnboarding = (dto: { username: string; email?: string; referralUsername?: string }) =>
  api.post('/users/onboarding', dto);

export const scanQr = async (qrString: string) => {
  const data = await getData(api.post('/transfer/scan', { qrString }));
  return { data };
};

export type OnchainWalletDto = {
  id: string;
  address: string;
  label?: string | null;
  createdAt?: string;
};

export type OffchainBankDto = {
  id: string;
  bankName: string;
  accountNumber: string;
  beneficiaryName: string;
  label?: string | null;
  createdAt?: string;
};

export type PaymentMethodDefaultResponseDto = {
  walletId: string | null;
  walletType: 'onchain' | 'offchain' | null;
};

export const listOnchainWallets = async () => {
  const data = await getData<OnchainWalletDto[]>(api.get('/wallet/onchain'));
  return { data };
};
export const addOnchainWallet = (dto: { address: string; chain: string; label?: string; walletProvider?: string; publicKey?: string }) =>
  api.post('/wallet/onchain/add', dto);
export const deleteOnchainWallet = (id: string) => api.delete(`/wallet/onchain/${id}`);

export const listOffchainBanks = async () => {
  const data = await getData<{ total: number; banks: OffchainBankDto[] }>(api.get('/wallet/offchain'));
  return { data };
};
export const addOffchainBankByQr = (dto: { qrString: string; label?: string }) => api.post('/wallet/offchain/add', dto);
export const deleteOffchainBank = (id: string) => api.delete(`/wallet/offchain/${id}`);

export const getDefaultPaymentMethod = async () => {
  const data = await getData<PaymentMethodDefaultResponseDto>(api.get('/payment-methods/default'));
  return { data };
};
export const setDefaultPaymentMethod = (dto: { walletId: string; walletType: 'onchain' | 'offchain' }) =>
  api.post('/payment-methods/default', dto);

export type KycLinkResponseDto = {
  url?: string;
  kycLink?: string;
};

export type KycStatusResponseDto = {
  status: 'unverified' | 'pending' | 'verified' | string;
};

export const getKycLink = (dto: { walletAddress: string }) => api.post<KycLinkResponseDto>('/kyc/get-link', dto);
export const getKycStatus = (walletAddress: string) =>
  api.get<KycStatusResponseDto>('/kyc/status', { params: { walletAddress } });

// ============================================
// PAYMENT ORDER API (Bank Transfers)
// ============================================

export type CreatePaymentOrderDto = {
  qrString: string;
  usdcAmount: number;
  payerWalletAddress: string;
  fiatCurrency?: string;
  country?: string;
  clientRequestId?: string;
};

export type PaymentInstructionDto = {
  toAddress: string;
  coinType: string;
  totalCrypto: string;
  totalCryptoRaw: string;
  totalPayout: number;
};

export type CreatePaymentOrderResponseDto = {
  id: string;
  status: string;
  exchangeInfo: {
    cryptoAmount: number;
    fiatAmount: number;
    fiatCurrency: string;
    cryptoCurrency: string;
    exchangeRate: number;
    feeAmount: number;
  };
  hiddenWallet?: {
    feePercent: string;
    feeRate: number;
    feeAmount: number;
    amountBeforeFee: number;
    amountWithFee: number;
  };
  paymentInstruction: PaymentInstructionDto;
  payout: {
    username?: string;
    fiatCurrency: string;
  };
};

export const createPaymentOrder = (dto: CreatePaymentOrderDto) =>
  api.post<CreatePaymentOrderResponseDto>('/payments/orders', dto);

export const confirmPaymentOrder = (orderId: string, userPaymentTxDigest: string) =>
  api.post(`/payments/orders/${orderId}/confirm-user-payment`, { userPaymentTxDigest });

export const getPaymentOrder = (orderId: string) =>
  api.get(`/payments/orders/${orderId}`);

export const syncPaymentOrder = (orderId: string) =>
  api.post(`/payments/orders/${orderId}/sync`);

export default api;
