import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL ?? '');
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🥞 Seeding CrepePOS products...');

  await prisma.product.deleteMany();

  // แป้งเครป (DOUGH)
  const doughs = await prisma.product.createMany({
    data: [
      {
        name: 'แป้งธรรมดา',
        category: 'DOUGH',
        price: 30,
        stockQuantity: 100,
        alertThreshold: 20,
        deductionAmount: 1,
      },
      {
        name: 'แป้งโกโก้',
        category: 'DOUGH',
        price: 35,
        stockQuantity: 80,
        alertThreshold: 15,
        deductionAmount: 1,
      },
      {
        name: 'แป้งมัทฉะ',
        category: 'DOUGH',
        price: 35,
        stockQuantity: 60,
        alertThreshold: 15,
        deductionAmount: 1,
      },
      {
        name: 'แป้งสตรอเบอรี่',
        category: 'DOUGH',
        price: 35,
        stockQuantity: 60,
        alertThreshold: 15,
        deductionAmount: 1,
      },
    ],
  });

  // ท็อปปิ้ง (TOPPING)
  const toppings = await prisma.product.createMany({
    data: [
      {
        name: 'กล้วย',
        category: 'TOPPING',
        price: 10,
        stockQuantity: 50,
        alertThreshold: 10,
        deductionAmount: 0.5,
      },
      {
        name: 'สตรอเบอรี่',
        category: 'TOPPING',
        price: 15,
        stockQuantity: 40,
        alertThreshold: 10,
        deductionAmount: 0.5,
      },
      {
        name: 'นูเทลล่า',
        category: 'TOPPING',
        price: 15,
        stockQuantity: 30,
        alertThreshold: 5,
        deductionAmount: 0.3,
      },
      {
        name: 'ชีส',
        category: 'TOPPING',
        price: 15,
        stockQuantity: 40,
        alertThreshold: 10,
        deductionAmount: 0.5,
      },
      {
        name: 'ไข่',
        category: 'TOPPING',
        price: 10,
        stockQuantity: 60,
        alertThreshold: 15,
        deductionAmount: 1,
      },
      {
        name: 'ไส้กรอก',
        category: 'TOPPING',
        price: 15,
        stockQuantity: 40,
        alertThreshold: 10,
        deductionAmount: 1,
      },
      {
        name: 'แฮม',
        category: 'TOPPING',
        price: 15,
        stockQuantity: 40,
        alertThreshold: 10,
        deductionAmount: 1,
      },
      {
        name: 'ครีม',
        category: 'TOPPING',
        price: 10,
        stockQuantity: 50,
        alertThreshold: 10,
        deductionAmount: 0.3,
      },
      {
        name: 'นมข้นหวาน',
        category: 'TOPPING',
        price: 5,
        stockQuantity: 80,
        alertThreshold: 20,
        deductionAmount: 0.2,
      },
      {
        name: 'ซอสช็อกโกแลต',
        category: 'TOPPING',
        price: 5,
        stockQuantity: 80,
        alertThreshold: 20,
        deductionAmount: 0.2,
      },
    ],
  });

  console.log(`✅ Doughs: ${doughs.count} รายการ`);
  console.log(`✅ Toppings: ${toppings.count} รายการ`);
  console.log('🎉 Seed สำเร็จ! พร้อมทดสอบได้เลย');
}

main()
  .catch((e) => {
    console.error('❌ Seed ล้มเหลว:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
