# Backend API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

### 1. Traditional Wallet Login

#### Get Challenge (Nonce)
```http
GET /auth/challenge?address=WALLET_ADDRESS
```
 
#### Verify Signature & Get JWT
```http
POST /auth/verify
```
```json
{
  "address": "0x...",
  "signature": "0x...",
  "publicKey": "0x..."
}
```

### 2. zkLogin (Google)

#### Get Challenge
```http
GET /auth/zklogin/challenge
```

#### Get/Generate Salt
```http
POST /auth/zklogin/salt
```
```json
{
  "sub": "google_sub_id",
  "aud": "google_client_id",
  "iss": "https://accounts.google.com"
}
```

#### Register Nonce
```http
POST /auth/zklogin/register
```
```json
{
  "sub": "google_sub_id",
  "aud": "google_client_id",
  "iss": "https://accounts.google.com",
  "nonce": "computed_nonce"
}
```

#### Verify & Get JWT
```http
POST /auth/zklogin/verify
```
```json
{
  "sub": "google_sub_id",
  "aud": "google_client_id",
  "iss": "https://accounts.google.com",
  "proof": {
    "proofPoints": {
      "proof": ["..."],
      "address": "0x...",
      "claims": ["..."]
    }
  }
}
```

## Users

### Get User Profile
```http
GET /users/profile
Authorization: Bearer YOUR_JWT_TOKEN
```

### Update Profile
```http
PATCH /users/profile
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "new@example.com",
  "firstName": "New",
  "lastName": "Name"
}
```

### Change Username
```http
PATCH /users/profile/username
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "newUsername": "newusername"
}
```

### Lookup User by Username
```http
GET /users/lookup?username=target_username
Authorization: Bearer YOUR_JWT_TOKEN
```

## Transfer

### Scan QR Code
```http
POST /transfer/scan
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "qrString": "@username or 0x... or bank QR data"
}
```

## Environment Variables

Frontend should set these environment variables:

```env
VITE_API_URL=http://localhost:3000/api
VITE_GAIAN_API_URL=# Get from backend team
VITE_GAIAN_API_KEY=# Get from backend team
```

## Integration Notes

1. **Authentication Flow**:
   - For wallet login: Get challenge → Sign message → Verify signature
   - For zkLogin: Follow the 4-step flow (challenge → salt → register → verify)

2. **JWT Usage**:
   - Include in `Authorization: Bearer` header for authenticated requests
   - Automatically handles session management

3. **Error Handling**:
   - 401: Unauthorized (invalid/expired token)
   - 400: Bad request (validation errors)
   - 404: Resource not found
   - 429: Rate limited

4. **Rate Limits**:
   - Username changes: 3 per 30 days per user
   - API calls: 100 requests/minute per IP (configurable)

5. **WebSocket**:
   - Real-time notifications available at `ws://localhost:3000` (TBD)

## Example Frontend Implementation

```typescript
// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to inject token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  getChallenge: (address: string) => api.get(`/auth/challenge?address=${address}`),
  verify: (data: any) => api.post('/auth/verify', data),
  // Add other auth methods
};

export const users = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.patch('/users/profile', data),
  changeUsername: (newUsername: string) => 
    api.patch('/users/profile/username', { newUsername }),
  lookup: (username: string) => 
    api.get(`/users/lookup?username=${username}`),
};

export const transfer = {
  scanQr: (qrString: string) => 
    api.post('/transfer/scan', { qrString }),
};
```
