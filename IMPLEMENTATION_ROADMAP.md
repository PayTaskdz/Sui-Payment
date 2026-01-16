# 🗺️ Implementation Roadmap

## ✅ Phase 1: Foundation (HOÀN THÀNH)

### Files đã tạo:
- [x] `.env.example` - Environment variables template
- [x] `tsconfig.json` - TypeScript configuration
- [x] `src/config/config.service.ts` - Config management
- [x] `src/config/config.module.ts` - Config module
- [x] `src/integrations/gaian/gaian.service.ts` - **Gaian API integration**
- [x] `src/integrations/gaian/gaian.module.ts` - Gaian module
- [x] `src/common/dto/pagination.dto.ts` - Reusable pagination DTO
- [x] `src/auth/dto/register.dto.ts` - Registration validation
- [x] `src/auth/dto/restore.dto.ts` - Restore validation
- [x] `src/auth/auth.service.ts` - **Auth logic HOÀN CHỈNH**
- [x] `src/auth/auth.controller.ts` - Auth endpoints
- [x] `src/app.module.ts` - Updated with new modules
- [x] `src/main.ts` - Added validation pipe

### Cần làm ngay:
```bash
# 1. Tạo file .env từ .env.example
cp .env.example .env

# 2. Cập nhật .env với thông tin thật
# - DATABASE_URL
# - GAIAN_API_KEY
# - JWT_SECRET

# 3. Install thêm packages
npm install class-validator class-transformer

# 4. Test Auth endpoints
npm run start:dev
```

---

## 🎯 Phase 2: Auth Module (BẮT ĐẦU TỪ ĐÂY)

### ✅ Đã xong:
- [x] Register endpoint
- [x] Restore endpoint
- [x] Onboarding endpoint
- [x] Check username endpoint

### 🔄 Test Auth Module:

```bash
# Test 1: Check username
curl http://localhost:3000/api/auth/check-username?username=tienphan

# Test 2: Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tienphan",
    "walletAddress": "0x1234567890abcdef",
    "email": "tien@example.com"
  }'

# Test 3: Restore
curl -X POST http://localhost:3000/api/auth/restore \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890abcdef"
  }'

# Test 4: Onboarding (auto restore hoặc register)
curl -X POST http://localhost:3000/api/auth/onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "walletAddress": "0xnewwallet123",
    "email": "new@example.com"
  }'
```

---

## 📋 Phase 3: KYC Module (TIẾP THEO)

### Files cần tạo:

#### 1. DTOs
```typescript
// src/kyc/dto/get-kyc-link.dto.ts
export class GetKycLinkDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}
```

#### 2. Update KYC Service
- Implement `getKycLink()` - Call Gaian API
- Implement `getKycStatus()` - Check status from Gaian
- Implement `handleKycWebhook()` - Update DB when KYC changes

#### 3. Update KYC Controller
- Add validation to endpoints
- Add proper error handling

---

## 📋 Phase 4: Wallets Module

### 4.1 Onchain Wallets

#### Files cần tạo:
```typescript
// src/wallets/onchain/dto/add-wallet.dto.ts
export class AddOnchainWalletDto {
  @IsString()
  address: string;
  
  @IsString()
  chain: string; // "Sui", "Ethereum", etc.
  
  @IsString()
  @IsOptional()
  label?: string;
  
  @IsString()
  @IsOptional()
  walletProvider?: string;
}
```

#### Logic cần implement:
- Validate address format theo chain
- Check uniqueness (chain, address)
- Auto set default if first wallet
- Query balance từ RPC

### 4.2 Offchain Wallets (Banks)

#### Files cần tạo:
```typescript
// src/wallets/offchain/dto/scan-qr.dto.ts
export class ScanQrDto {
  @IsString()
  qrString: string;
  
  @IsString()
  @IsOptional()
  country?: string = 'VN';
}

// src/wallets/offchain/dto/add-manual.dto.ts
export class AddManualBankDto {
  @IsString()
  country: string;
  
  @IsString()
  bankBin: string;
  
  @IsString()
  bankName: string;
  
  @IsString()
  accountNumber: string;
  
  @IsString()
  accountName: string;
  
  @IsString()
  @IsOptional()
  label?: string;
}
```

#### Logic cần implement:
- Call `gaianService.parseQr()` để parse VietQR
- Store full QR metadata
- Check uniqueness
- Auto set default if first account

---

## 📋 Phase 5: Users Module

### Files cần tạo:
```typescript
// src/users/dto/update-profile.dto.ts
export class UpdateProfileDto {
  @IsEmail()
  @IsOptional()
  email?: string;
  
  @IsString()
  @IsOptional()
  firstName?: string;
  
  @IsString()
  @IsOptional()
  lastName?: string;
}

// src/users/dto/change-username.dto.ts
export class ChangeUsernameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  newUsername: string;
}
```

### Logic cần implement:
- UC7: Change Username với rate limit (3/30 days)
- Get profile with all wallets
- Lookup user by username

---

## 📋 Phase 6: Payment Methods Module

### Logic cần implement:
- UC5: Set Default Wallet
  - Unset all defaults (onchain + offchain)
  - Set new default
  - Validate wallet is active

---

## 📋 Phase 7: Contacts Module

### Files cần tạo:
```typescript
// src/contacts/dto/save-contact.dto.ts
export class SaveContactDto {
  @IsString()
  recipientUsername: string;
  
  @IsString()
  @IsOptional()
  label?: string;
}

// src/contacts/dto/resolve-qr.dto.ts
export class ResolveQrDto {
  @IsString()
  qrString: string;
}
```

### Logic cần implement:
- UC13: Bank QR Resolution
- Save/get/delete contacts
- Recent transfers tracking

---

## 📋 Phase 8: Guards & Security

### Files cần tạo:

#### 1. JWT Auth Guard
```typescript
// src/common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

#### 2. KYC Guard
```typescript
// src/common/guards/kyc-verified.guard.ts
@Injectable()
export class KycVerifiedGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (user.kycStatus !== 'approved') {
      throw new ForbiddenException('KYC verification required');
    }
    
    return true;
  }
}
```

#### 3. Current User Decorator
```typescript
// src/common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

## 📋 Phase 9: Blockchain Integration

### Files cần tạo:

```typescript
// src/integrations/blockchain/sui-rpc.service.ts
@Injectable()
export class SuiRpcService {
  async getBalance(address: string): Promise<string> {
    // Query SUI balance from RPC
  }
}

// src/integrations/blockchain/ethereum-rpc.service.ts
@Injectable()
export class EthereumRpcService {
  async getBalance(address: string): Promise<string> {
    // Query ETH balance from RPC
  }
}
```

---

## 📊 Progress Tracker

| Phase | Status | Completion |
|-------|--------|------------|
| 1. Foundation | ✅ DONE | 100% |
| 2. Auth Module | ✅ DONE | 100% |
| 3. KYC Module | 🔄 TODO | 0% |
| 4. Wallets Module | 🔄 TODO | 0% |
| 5. Users Module | 🔄 TODO | 0% |
| 6. Payment Methods | 🔄 TODO | 0% |
| 7. Contacts Module | 🔄 TODO | 0% |
| 8. Guards & Security | 🔄 TODO | 0% |
| 9. Blockchain RPC | 🔄 TODO | 0% |

---

## 🎯 BẮT ĐẦU TỪ ĐÂY:

### Step 1: Setup Environment
```bash
# Copy .env file
cp .env.example .env

# Edit .env với editor
code .env  # hoặc notepad .env
```

### Step 2: Install Dependencies
```bash
npm install class-validator class-transformer
```

### Step 3: Run Prisma
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Step 4: Start Dev Server
```bash
npm run start:dev
```

### Step 5: Test Auth Endpoints
```bash
# Test check username
curl http://localhost:3000/api/auth/check-username?username=test

# Test register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","walletAddress":"0x123","email":"test@example.com"}'
```

---

## ✅ Checklist Ngắn Hạn

- [ ] Setup `.env` file
- [ ] Install `class-validator` và `class-transformer`
- [ ] Run Prisma migrations
- [ ] Test Auth endpoints
- [ ] Implement KYC module (next)
- [ ] Implement Wallets module
- [ ] Add JWT authentication

---

**Bắt đầu từ Phase 2 (Auth Testing) → Phase 3 (KYC)!** 🚀
