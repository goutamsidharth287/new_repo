import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password123!", 10);

  const roles = [
    { name: "Admin User", email: "admin@erp.test", role: "ADMIN" as const },
    { name: "Sales User", email: "sales@erp.test", role: "SALES" as const },
    { name: "Warehouse User", email: "warehouse@erp.test", role: "WAREHOUSE" as const },
    { name: "Accounts User", email: "accounts@erp.test", role: "ACCOUNTS" as const },
  ];

  for (const r of roles) {
    await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: { name: r.name, email: r.email, passwordHash: password, role: r.role },
    });
  }

  const product = await prisma.product.upsert({
    where: { sku: "PRD-001" },
    update: {},
    create: {
      name: "Sample Product A",
      sku: "PRD-001",
      category: "General",
      unitPrice: 250.0,
      currentStock: 100,
      minStockAlert: 10,
      location: "Main Warehouse",
    },
  });

  await prisma.customer.upsert({
    where: { id: "seed-customer-1" },
    update: {},
    create: {
      id: "seed-customer-1",
      name: "Sample Customer",
      mobile: "9999999999",
      email: "customer@example.com",
      businessName: "Sample Traders",
      customerType: "WHOLESALE",
      status: "ACTIVE",
      address: "Bengaluru, India",
    },
  });

  console.log("Seed complete. Test credentials (all use password: Password123!):");
  roles.forEach((r) => console.log(`  ${r.role}: ${r.email}`));
  console.log(`Sample product created: ${product.name} (${product.sku})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
