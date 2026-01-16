# 🚀 Hướng Dẫn Setup & Chạy Prisma

## Bước 1: Cài Đặt Packages

```bash
npm install prisma @prisma/client
# hoặc
yarn add prisma @prisma/client
# hoặc
pnpm add prisma @prisma/client
```

---

## Bước 2: Tạo File `.env`

Tạo file `.env` ở root project với nội dung:

```env
# Database URL for PostgreSQL
DATABASE_URL="postgresql://username:password@localhost:5432/swiftpath_db?schema=public"

# Example with actual values:
# DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/swiftpath_db?schema=public"
```

### 📝 Giải thích Database URL:

```
postgresql://[username]:[password]@[host]:[port]/[database]?schema=public
```

- `username`: PostgreSQL username (mặc định: `postgres`)
- `password`: PostgreSQL password
- `host`: Database host (local: `localhost`, cloud: IP/domain)
- `port`: PostgreSQL port (mặc định: `5432`)
- `database`: Tên database (ví dụ: `swiftpath_db`)

### Ví dụ cụ thể:

**Local PostgreSQL:**
```env
DATABASE_URL="postgresql://postgres:123456@localhost:5432/swiftpath_db?schema=public"
```

**Neon (Cloud PostgreSQL):**
```env
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
```

**Supabase:**
```env
DATABASE_URL="postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?pgbouncer=true"
```

---

## Bước 3: Tạo Database (nếu chưa có)

### Option A: Sử dụng PostgreSQL CLI

```bash
# Kết nối vào PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE swiftpath_db;

# Thoát
\q
```

### Option B: Sử dụng GUI (pgAdmin, TablePlus, DBeaver)

1. Mở GUI tool
2. Click "Create Database"
3. Đặt tên: `swiftpath_db`
4. Click "Save"

---

## Bước 4: Generate Prisma Client

```bash
npx prisma generate
```

**Output mong đợi:**
```
✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

---

## Bước 5: Tạo Migration & Sync Database

### Option A: Development (tạo migration file)

```bash
npx prisma migrate dev --name init
```

**Lệnh này sẽ:**
- ✅ Tạo folder `prisma/migrations/`
- ✅ Tạo file SQL migration
- ✅ Chạy migration vào database
- ✅ Generate Prisma Client

### Option B: Production (chỉ chạy migration)

```bash
npx prisma migrate deploy
```

### Option C: Prototype (không tạo migration - CHỈ cho dev)

```bash
npx prisma db push
```

**⚠️ Warning:** `db push` không tạo migration history, chỉ dùng khi prototype nhanh!

---

## Bước 6: Kiểm Tra Database

### Mở Prisma Studio (Database GUI)

```bash
npx prisma studio
```

**Browser sẽ mở:** `http://localhost:5555`

Tại đây bạn có thể:
- ✅ Xem tất cả tables
- ✅ Thêm/sửa/xóa records
- ✅ Test relationships

---

## 📦 Sử Dụng Prisma Client Trong Code

### 1. Tạo Prisma Client Instance

**File: `src/lib/prisma.ts` (hoặc `src/prisma.ts`)**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 2. Import & Use

```typescript
import { prisma } from './lib/prisma';

// Example: Tạo user mới
async function createUser() {
  const user = await prisma.user.create({
    data: {
      username: 'tienphan',
      walletAddress: '0x1234567890abcdef',
      email: 'tien@example.com',
      kycStatus: 'not started'
    }
  });
  
  console.log('Created user:', user);
}

// Example: Lấy user với wallets
async function getUserWithWallets(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      onchainWallets: true,
      offchainWallets: true,
      contacts: true
    }
  });
  
  return user;
}

// Example: Thêm onchain wallet
async function addWallet(userId: string) {
  const wallet = await prisma.onchainWallet.create({
    data: {
      userId: userId,
      address: '0xabcdef123456',
      chain: 'Sui',
      label: 'Ví chính',
      walletProvider: 'sui_wallet',
      isDefault: true
    }
  });
  
  return wallet;
}
```

---

## 🔄 Commands Thường Dùng

```bash
# Generate Prisma Client (sau khi thay đổi schema)
npx prisma generate

# Tạo migration mới
npx prisma migrate dev --name add_new_field

# Reset database (XÓA TẤT CẢ DATA!)
npx prisma migrate reset

# Xem database trong browser
npx prisma studio

# Format schema file
npx prisma format

# Validate schema
npx prisma validate

# Pull database schema vào Prisma (reverse engineering)
npx prisma db pull

# Push schema lên database (không tạo migration)
npx prisma db push

# Seed database (nếu có file seed)
npx prisma db seed
```

---

## 🎯 Workflow Thông Thường

### Development Flow:

1. **Sửa schema** (`prisma/schema.prisma`)
2. **Tạo migration:**
   ```bash
   npx prisma migrate dev --name describe_your_changes
   ```
3. **Code sẽ auto-update** (Prisma Client được generate lại)

### Khi Pull Code Từ Git:

1. **Install packages:**
   ```bash
   npm install
   ```
2. **Run migrations:**
   ```bash
   npx prisma migrate dev
   ```

### Production Deployment:

1. **Build:**
   ```bash
   npm run build
   ```
2. **Run migrations:**
   ```bash
   npx prisma migrate deploy
   ```
3. **Start app:**
   ```bash
   npm start
   ```

---

## 🐛 Troubleshooting

### Lỗi: "Environment variable not found: DATABASE_URL"

**Fix:**
```bash
# Tạo file .env với DATABASE_URL
echo 'DATABASE_URL="postgresql://postgres:password@localhost:5432/swiftpath_db"' > .env
```

### Lỗi: "Can't reach database server"

**Fix:**
1. Kiểm tra PostgreSQL đã chạy chưa:
   ```bash
   # Windows
   services.msc  # Tìm PostgreSQL service
   
   # Mac
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Kiểm tra DATABASE_URL đúng chưa
3. Kiểm tra port 5432 có bị block không

### Lỗi: "Database does not exist"

**Fix:**
```bash
# Tạo database
psql -U postgres -c "CREATE DATABASE swiftpath_db;"
```

### Prisma Client outdated sau khi sửa schema

**Fix:**
```bash
npx prisma generate
```

---

## 📚 Tài Liệu Tham Khảo

- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)

---

## ✅ Checklist Setup Hoàn Chỉnh

- [ ] Cài `prisma` và `@prisma/client`
- [ ] Tạo file `.env` với `DATABASE_URL`
- [ ] PostgreSQL đang chạy
- [ ] Database `swiftpath_db` đã tạo
- [ ] Chạy `npx prisma generate`
- [ ] Chạy `npx prisma migrate dev --name init`
- [ ] Mở `npx prisma studio` để kiểm tra
- [ ] Test tạo 1 user trong code

**Sau khi hoàn thành checklist → Prisma đã sẵn sàng! 🎉**
