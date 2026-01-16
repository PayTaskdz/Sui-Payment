import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_USERNAME || 'alice';
  const qrString = process.env.SEED_QR_STRING || 'SAMPLE_QR_STRING';
  const fiatCurrency = process.env.SEED_FIAT_CURRENCY || 'VND';

  await prisma.paymentTarget.upsert({
    where: { username },
    update: {
      qrString,
      fiatCurrency,
      isActive: true,
    },
    create: {
      username,
      qrString,
      fiatCurrency,
      isActive: true,
    },
  });

  console.log(`Seeded payment target: ${username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

