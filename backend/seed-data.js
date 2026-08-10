const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    const password = await bcrypt.hash('Password123!', 10);

    const users = [
      { name: 'Admin User', email: 'admin@erp.test', role: 'ADMIN' },
      { name: 'Sales User', email: 'sales@erp.test', role: 'SALES' },
      { name: 'Warehouse User', email: 'warehouse@erp.test', role: 'WAREHOUSE' },
      { name: 'Accounts User', email: 'accounts@erp.test', role: 'ACCOUNTS' },
    ];

    for (const user of users) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          name: user.name,
          email: user.email,
          passwordHash: password,
          role: user.role,
        },
      });
    }

    console.log('✓ Users seeded successfully');

    const product = await prisma.product.upsert({
      where: { sku: 'PRD-001' },
      update: {},
      create: {
        name: 'Sample Product A',
        sku: 'PRD-001',
        category: 'General',
        unitPrice: 250.0,
        currentStock: 100,
        minStockAlert: 10,
        location: 'Main Warehouse',
      },
    });

    console.log('✓ Product seeded successfully');

    const customer = await prisma.customer.upsert({
      where: { id: 'seed-customer-1' },
      update: {},
      create: {
        id: 'seed-customer-1',
        name: 'Sample Customer',
        mobile: '9999999999',
        email: 'customer@example.com',
        businessName: 'Sample Traders',
        customerType: 'WHOLESALE',
        status: 'ACTIVE',
        address: 'Bengaluru, India',
      },
    });

    console.log('✓ Customer seeded successfully');
    console.log('\nDatabase seeding completed!');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
