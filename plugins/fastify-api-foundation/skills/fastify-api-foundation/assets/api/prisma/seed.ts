import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";

// Idempotent: safe to run repeatedly (upsert by unique key).
async function main() {
  const email = "admin@example.com";
  const password = "change-me-123";

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await hashPassword(password), status: "ACTIVE" },
    create: {
      name: "Admin",
      email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`✓ Seed user ready: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
