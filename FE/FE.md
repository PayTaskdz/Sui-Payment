# Frontend Documentation

This document provides an overview of the HiddenWallet UI frontend architecture.

## Tech Stack

- **Framework**: React + Vite + TypeScript
- **UI Components**: Tailwind CSS + Shadcn/UI
- **Blockchain**: Sui Network via `@mysten/dapp-kit`
- **State Management**: React Context API (`WalletContext`)
- **Routing**: `react-router-dom`

## Project Structure

```
src/
├── components/     # Reusable UI components (Shadcn/UI based)
├── context/        # Global state management (WalletContext.tsx)
├── hooks/          # Custom React hooks
├── pages/          # Main page components for each route
├── providers/      # Wrapper components for third-party libraries (SuiProvider)
├── services/       # API services (e.g., Gaian for QR parsing)
└── lib/            # Utility functions
```

## Core Architecture

The application is a single-page app (SPA) built with React. The core logic and state are centralized in `src/context/WalletContext.tsx`.

### State Management: `WalletContext`

This context is the "brain" of the application. It manages:

- **Wallet Connection**: `isConnected`, `walletAddress`.
- **User Data**: `username`, `kycStatus`, `linkedBanks`.
- **On-Chain Data**: `suiBalance`, `usdcBalance`, `transactions`.
- **Actions**: Functions to `connectWallet`, `sendUsdc`, `refreshBalance`, etc.

All blockchain interactions, balance fetching, and transaction history are handled within this provider, making it the central point for data flow.

### Sui Blockchain Integration

- **`SuiProvider` (`src/providers/SuiProvider.tsx`)**: Wraps the entire app to provide Sui network context using `@mysten/dapp-kit`.
- **`ConnectButton`**: The primary UI component from `@mysten/dapp-kit` for initiating wallet connections.
- **Hooks**: The app uses `useSuiClient`, `useCurrentAccount`, and `useSignAndExecuteTransaction` for reading from and writing to the Sui blockchain.
- **Transactions**: The `sendUsdc` function in `WalletContext` demonstrates how to build, sign, and execute a real transaction on the Sui network.

### Routing

`react-router-dom` manages navigation. Key routes defined in `src/App.tsx` include:

- `/login`: Wallet connection page.
- `/onboarding`: New user setup (e.g., claim username).
- `/dashboard`: Main application view after login.
- `/send`, `/receive`: Core payment flow pages.

## Key Components & Pages

- **`pages/Login.tsx`**: Handles the initial user interaction. It intelligently detects if the user is on a mobile device and guides them to use a Sui-compatible browser like Slush.
- **`context/WalletContext.tsx`**: The most critical file. It contains the logic for fetching balances, transaction history, and sending tokens. It currently uses a mix of real on-chain data and mock data for user lookups.
- **`services/gaian.ts`**: A service for parsing VietQR codes using an external API.

## API Integration

The frontend communicates with a backend API for user management and other services not directly on the blockchain.

- **Base URL**: `https://sui-payment.onrender.com/api`
- **Services**: An example of an API service can be built using `axios` or `fetch` to interact with the endpoints defined in `BE.md`.

### Example API Service (`src/services/api.ts` - *to be created*)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://sui-payment.onrender.com/api',
});

// Add interceptor to include JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt'); // Assuming JWT is stored in localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  getChallenge: (address: string) => api.get(`/auth/challenge?address=${address}`),
  verify: (data: { address: string; signature: string; }) => api.post('/auth/verify', data),
};

export const userApi = {
  getProfile: () => api.get('/users/profile'),
  // ... other user endpoints
};
```

