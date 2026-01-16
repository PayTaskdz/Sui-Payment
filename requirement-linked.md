# Identity – Wallet Management Requirements

## Goal

Xây dựng backend gói gọn tất cả các ví onchain, tài khoản ngân hàng vào trong một cái username và có thể sử dụng username để chuyển stablecoin cho người khác.

**Payment Flow**: 
- User nhập username của người nhận → chuyển SUI → swap SUI sang USDC:
  - **Case 1**: Default wallet của người nhận là ví onchain → nhận USDC trực tiếp
  - **Case 2**: Default wallet của người nhận là tài khoản ngân hàng → Gaian chuyển từ USDC sang VNĐ vào tài khoản

---

## Core Principles

1. **Username-based identity**: Mỗi user có một username unique để nhận/gửi tiền
2. **Multi-wallet support**: Một user có thể link nhiều SUI wallets + nhiều bank accounts
3. **Default wallet**: Chỉ một default wallet (onchain HOẶC offchain) để nhận tiền
4. **KYC via WebSDK**: User làm KYC qua Gaian WebSDK (Sumsub), KYC được quản lý bởi Gaian
5. **Wallet restore**: Connect wallet đã tồn tại → khôi phục identity, không tạo user mới

---

## Scope

### In-scope
- Create identity với username unique
- Link onchain wallets (multi-chain, **ưu tiên SUI**):
  - Connect via wallet extension (Sui Wallet, Suiet, MetaMask, etc.)
  - Manual input address (support SUI, Ethereum, Bitcoin, etc.)
  - QR scan để lấy address
  - Query balance real-time từ RPC
- Link offchain wallets (Bank):
  - Manual input bank info
  - QR scan (VietQR)
- Set default wallet (onchain hoặc offchain)
- Deactivate/reactivate/delete wallets
- Restore identity khi connect wallet đã tồn tại
- KYC verification qua Gaian WebSDK (Sumsub)
- Scan bank QR để identify recipient
- Save contacts và recent transfers

---

## Use Cases Summary

### UC1: Create Identity
- Tạo userID mới + username (unique per environment)
- Chỉ chạy khi restore identity thất bại
- User mới có `kyc_status = 'not_submitted'`

### UC2: Link Onchain Wallet (Multi-chain, ưu tiên SUI)
**Ba methods**:
- **Connect Wallet**: User click "Connect Wallet" → wallet extension popup → approve → get address
- **Manual Input**: User nhập address thủ công
- **QR Scan**: User scan QR code → decode address

**Method 1: Connect Wallet** (Recommended cho SUI)
1. Frontend detects wallet extension (Sui Wallet, Suiet, MetaMask, etc.)
2. User clicks "Connect Wallet"
3. Wallet popup asks for approval
4. Frontend receives: `chain`, `address`, `publicKey` (optional)
5. Frontend sends to backend: `{ chain: 'Sui', address, publicKey, source_type: 'connected' }`
6. Backend validates & stores

**Method 2: Manual Input**
1. User chọn chain: SUI (default), Ethereum, Bitcoin, etc.
2. User nhập address
3. Backend validates format theo chain
4. Store với `source_type: 'manual'`

**Method 3: QR Scan**
1. User clicks "Scan QR"
2. Camera mở → scan QR code
3. QR format: `{ "chain": "Sui", "address": "0x..." }` hoặc simple address
4. Frontend decode → send to backend
5. Store với `source_type: 'qr_scan'`

**Rules**:
- **SUI là priority** cho hackathon
- Support chains khác: Ethereum, Bitcoin (có thể thêm sau)
- Mỗi wallet chỉ thuộc một userID duy nhất
- Không cho relink wallet sang userID khác
- Auto set default nếu là wallet đầu tiên
- Balance query real-time từ RPC

### UC3: Link Offchain Wallet (Bank)

**Mô tả**: Liên kết tài khoản ngân hàng vào userID

**Method 1: Manual Input**
1. User chọn "Add Bank Account"
2. User nhập thông tin:
   - Country (VN, PH)
   - Bank name
   - Account number
   - Account holder name
3. System validates format
4. System kiểm tra uniqueness (account đã được link chưa)
5. Nếu mới:
   - Store bank info
   - Auto set default nếu là account đầu tiên
   - Return bank account info
6. Nếu đã tồn tại → show error với username owner

**Method 2: QR Scan (VietQR)**
1. User chọn "Scan Bank QR"
2. Camera opens → user scans VietQR code
3. System gửi QR string tới Gaian parseQr API
4. Gaian trả về parsed data:
   - Bank BIN, account number, account name
   - Amount, currency, purpose (if available)
5. System auto-fills bank info từ parsed data
6. System validates và checks uniqueness
7. Nếu mới:
   - Store ALL QR data (qr_string, parsed info)
   - Auto set default nếu là account đầu tiên
8. Return bank account info

**Rules**:
- Mỗi bank account chỉ thuộc một userID duy nhất
- Manual input: Chỉ lưu core bank info
- QR scan: Lưu thêm QR metadata (amount, purpose, provider)
- Auto set default nếu là account đầu tiên
- Không cho link account đã được user khác sử dụng

### UC4: Multi-Account Management
- Một user sở hữu nhiều wallets (onchain + offchain)
- Không tồn tại account "mồ côi" không có userID
- KYC status được quản lý ở user level (không phải từng wallet)

### UC5: Set Default Wallet
- Chỉ có **1 default wallet globally** (across onchain + offchain)
- Transaction logic: Unset all defaults → Set new default
- Wallet inactive không được set default

### UC6: Deactivate Wallet (Soft Lock)
- Set `is_active = FALSE`, giữ record trong DB
- Nếu deactivate default wallet → auto fallback sang wallet active khác
- Wallet deactivated vẫn có thể reactivate

### UC7: Change Username
- Username mới phải unique
- Rate limit: 3 changes per 30 days
- KYC status không thay đổi

### UC8: Restore Identity
- User connect wallet đã tồn tại → khôi phục identity
- Return: `user_id`, `username`, `kyc_status`, `canTransfer`
- Không tạo userID mới

### UC9: Onboarding Entrypoint
- Luôn attempt restore trước
- Chỉ create identity khi restore thất bại

### UC10: Prevent Duplicate Identity
- Wallet đã tồn tại → reject mọi attempt tạo userID mới
- Show error với username owner

### UC11: Delete Wallet
- Hard delete khỏi DB
- Không cho xoá default wallet
- Wallet đã xoá không restore được identity

### UC12: KYC Verification (WebSDK - Gaian handles)

**Mô tả**: User thực hiện KYC qua Gaian WebSDK (Sumsub)

**Main Flow**:
1. **Get KYC Link**:
   - User clicks "Verify Identity"
   - Backend calls Gaian: `POST /api/v1/kyc/link` với `walletAddress`
   - Gaian returns: `websdkUrl`
   - Backend trả về URL cho frontend

2. **User Completes KYC**:
   - Frontend redirect user tới `websdkUrl`
   - User uploads ID documents và completes verification trên Gaian/Sumsub
   - Gaian xử lý và validate documents

3. **Check KYC Status**:
   - User quay lại app
   - Backend calls Gaian: `GET /api/v1/users/?walletAddress={address}`
   - Gaian returns: `kyc.status`, `kyc.firstName`, `kyc.lastName`
   - Backend updates DB: `users.kyc_status`, `first_name`, `last_name`

4. **Webhook Update** (Optional):
   - Gaian gửi webhook khi status changes
   - Backend auto-update `kyc_status` trong DB

**KYC Status States**:
- `"not started"`: Chưa bắt đầu KYC
- `"under review"`: Đang review tại Gaian
- `"approved"`: KYC thành công, có thể transfer
- `"rejected"`: KYC bị từ chối

**Rules**:
- User chưa KYC approved → KHÔNG được gọi API Place Order (offchain payment)
- User KYC approved → Được phép transfer offchain (bank)
- Onchain transfer: Không cần KYC (direct crypto transfer)
- KYC status được sync từ Gaian mỗi khi check

### UC13: Bank QR Resolution (Lookup Recipient)
- User scan bank QR → backend lookup trong `offchain_wallets`
- Nếu tìm thấy → hiển thị username + option "Save Contact"
- Nếu không tìm thấy → chỉ hiển thị bank info từ QR
- Save to contacts table cho "Recent Transfers"

---

## Database Schema

### Table: `users`
**Purpose**: Central identity with KYC status

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `id` | UUID | Primary key | Auto-generated |
| `username` | String | Tên định danh duy nhất user tự đặt<br/>Ví dụ: "tienphan"<br/>Dùng để lookup khi chuyển tiền | User input |
| `wallet_address` | String | Địa chỉ ví chính để đăng ký<br/>Tham số bắt buộc trong API Register | User wallet |
| `email` | String | Email người dùng | User input hoặc API Register |
| `gaian_user_id` | String | ID user trong hệ thống Gaian<br/>Để tham chiếu chéo | API Register response: `user.id` |
| `kyc_status` | String | Trạng thái KYC<br/>Values: "not started", "under review", "approved", "rejected" | API Get User Info: `kyc.status` |
| `first_name` | String | Họ | API Get User Info: `kyc.firstName` |
| `last_name` | String | Tên | API Get User Info: `kyc.lastName` |
| `is_active` | Boolean | Trạng thái tài khoản | Default: true |
| `created_at` | Timestamp | Ngày tạo | Auto |
| `updated_at` | Timestamp | Ngày cập nhật | Auto |

---

### Table: `onchain_wallets`
**Purpose**: Crypto wallet addresses (support nhiều chains, ưu tiên SUI)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `id` | UUID | Primary key | Auto-generated |
| `user_id` | UUID | Foreign key to users | User reference |
| `address` | String | Địa chỉ ví blockchain<br/>Tham số `fromAddress` trong API Place Order | User wallet connection |
| `chain` | String | Tên blockchain<br/>Ví dụ: "Sui", "Solana", "Ethereum", "Polygon" | User selection |
| `kyc_status` | String | Trạng thái KYC của ví này<br/>Values: "not started", "under review", "approved", "rejected" | API Get User Info: `kyc.status` |
| `gaian_user_id` | String | ID user trong Gaian | API Register: `user.id` |
| `label` | String | Tên gợi nhớ<br/>Ví dụ: "Ví Phantom chính" | User input |
| `is_default` | Boolean | Ví mặc định để nhận tiền | User selection |
| `wallet_provider` | String | Nhà cung cấp ví<br/>Ví dụ: "metamask", "phantom", "sui_wallet" | Auto-detect |
| `created_at` | Timestamp | Ngày tạo | Auto |
| `updated_at` | Timestamp | Ngày cập nhật | Auto |

---

### Table: `offchain_wallets`
**Purpose**: Bank accounts linked to users

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `id` | UUID | Primary key | Auto-generated |
| `user_id` | UUID | Foreign key to users | User reference |
| `country` | String | Mã quốc gia<br/>Ví dụ: "VN", "PH" | API Parse QR: `country` |
| `bank_bin` | String | Mã ngân hàng<br/>Ví dụ: "970436" | API Parse QR: `bankBin` |
| `bank_name` | String | Tên ngân hàng<br/>Ví dụ: "VIETCOMBANK" | API Parse QR: `detailedQrInfo.provider.name` |
| `account_number` | String | Số tài khoản | API Parse QR: `accountNumber` |
| `account_name` | String | Tên chủ tài khoản | API Parse QR: `beneficiaryName` |
| `qr_string` | String | Chuỗi QR gốc<br/>**Bắt buộc** để gọi API Place Order | API Parse QR: `encodedString` |
| `label` | String | Tên gợi nhớ<br/>Ví dụ: "VCB chính" | User input |
| `is_default` | Boolean | Tài khoản mặc định | User selection |
| `qr_parsed_data` | JSON | Toàn bộ response Parse QR (backup) | API Parse QR: full response |
| `created_at` | Timestamp | Ngày tạo | Auto |
| `updated_at` | Timestamp | Ngày cập nhật | Auto |

## Rules

### Uniqueness
- Wallet unique per (chain, address, env)
- Username unique per env
- Bank account unique per (country, bankCode, accountNumber, env)

### Default Wallet
- Mỗi user có tối đa **1 default wallet globally** (onchain HOẶC offchain)
- Wallet inactive không được set default
- Wallet default không được xoá
- Deactivate default → auto fallback hoặc unset

## API Endpoints

### Authentication & Onboarding

| Method | Endpoint | Description | Auth | KYC Required |
|--------|----------|-------------|------|--------------|
| `POST` | `/auth/register` | Đăng ký user mới | No | No |
| `GET` | `/auth/check-username` | Kiểm tra username có available không | No | No |
| `POST` | `/auth/onboarding` | Onboarding entrypoint (UC9) | No | No |
| `POST` | `/auth/restore` | Restore identity by wallet (UC8) | No | No |

---

### Identity & Profile

| Method | Endpoint | Description | Auth | KYC Required |
|--------|----------|-------------|------|--------------|
| `GET` | `/profile` | Get user profile + KYC status + wallets | Yes | No |
| `PATCH` | `/profile` | Update profile info (email, firstName, lastName) | Yes | No |
| `PATCH` | `/profile/username` | Change username (UC7) | Yes | No |

---

### Onchain Wallets

| Method | Endpoint | Description | Auth | KYC Required |
|--------|----------|-------------|------|--------------|
| `POST` | `/wallets/onchain/add` | Add wallet (manual/connect/QR) | Yes | No |
| `GET` | `/wallets/onchain` | List onchain wallets | Yes | No |
| `GET` | `/wallets/onchain/{id}/balance` | Query balance từ RPC | Yes | No |
| `PATCH` | `/wallets/onchain/{id}` | Update wallet label | Yes | No |
| `POST` | `/wallets/onchain/{id}/deactivate` | Deactivate wallet (UC6) | Yes | No |
| `POST` | `/wallets/onchain/{id}/reactivate` | Reactivate wallet (UC6) | Yes | No |
| `DELETE` | `/wallets/onchain/{id}` | Remove wallet (UC11) | Yes | No |

---

### Offchain Wallets (Banks)

| Method | Endpoint | Description | Auth | KYC Required |
|--------|----------|-------------|------|--------------|
| `POST` | `/wallets/offchain/scan-qr` | Add bank from QR scan (UC3B) | Yes | No |
| `POST` | `/wallets/offchain/add-manual` | Add bank manually (UC3A) | Yes | No |
| `GET` | `/wallets/offchain` | List bank accounts | Yes | No |
| `PATCH` | `/wallets/offchain/{id}` | Update bank account | Yes | No |
| `POST` | `/wallets/offchain/{id}/deactivate` | Deactivate bank (UC6) | Yes | No |
| `POST` | `/wallets/offchain/{id}/reactivate` | Reactivate bank | Yes | No |
| `DELETE` | `/wallets/offchain/{id}` | Remove bank account (UC11) | Yes | No |


### Default Payment Method

| Method | Endpoint | Description | Auth | KYC Required |
|--------|----------|-------------|------|--------------|
| `POST` | `/payment-methods/default` | Set default wallet (UC5) | Yes | No |
| `GET` | `/payment-methods/default` | Get current default wallet | Yes | No |
---

### KYC Management

| Method | Endpoint | Description | Auth | KYC Required |
|--------|----------|-------------|------|--------------|
| `POST` | `/kyc/get-link` | Get WebSDK URL from Gaian (UC12) | Yes | No |
| `GET` | `/kyc/status` | Get KYC status - check approved/pending | Yes | No |
| `POST` | `/webhooks/kyc` | KYC provider webhook (Gaian/Sumsub) | No | No |

---

---

## Error Codes

Errors organized by HTTP status. All errors return JSON with `error_code`, `message`, `details`.

### 400 Bad Request
Validation errors

### 401 Unauthorized
Authentication failures

### 403 Forbidden
Authorization failures

### 404 Not Found

### 409 Conflict

### 429 Too Many Requests


### 500 Internal Server Error
---
## Tech Stack

- **Backend**: NestJS + TypeScript + Prisma ORM
- **Database**: PostgreSQL 15+ (UUID primary keys)
- **Blockchain**: 
  - SUI Mainnet
  - `@mysten/sui.js` - SUI SDK for balance queries, transactions
  - Direct wallet connection (Sui Wallet, Suiet, Ethos extensions)
- **KYC**: Gaian API (Partner KYC flow)
- **Storage**: S3 (KYC documents, QR images), Redis (cache)
- **Auth**: JWT

---

## Acceptance Criteria

✅ User có thể tạo identity với username unique  
✅ User có thể link nhiều wallets (onchain + offchain)  
✅ Chỉ có 1 default wallet globally  
✅ Wallet đã tồn tại → restore identity, không tạo user mới  
✅ User có thể làm KYC qua Gaian WebSDK  
✅ Offchain transfer bị block nếu chưa KYC approved  
✅ Scan bank QR → identify recipient nếu đã registered  
