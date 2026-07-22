import { prisma } from "../src/lib/prisma";
import * as bcrypt from "bcryptjs";

async function main() {
  const adminPhone = "0987654321";
  const adminEmail = "admin@vinhgiang.vn";

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ phone: adminPhone }, { email: adminEmail }],
    },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("Aa@123456", 10);
    await prisma.user.create({
      data: {
        phone: adminPhone,
        email: adminEmail,
        password_hash: hashedPassword,
        full_name: "Admin Vĩnh Giang",
        role: "ADMIN",
        is_locked: false,
      },
    });
    console.log("Seeded Admin user successfully.");
  } else {
    console.log("Admin user already exists.");
  }

  // Seed Forklift Driver 1
  const driver1Phone = "0911223344";
  const driver1Email = "driver1@vinhgiang.vn";
  const existingDriver1 = await prisma.user.findFirst({
    where: { OR: [{ phone: driver1Phone }, { email: driver1Email }] },
  });

  const hashedPassword = await bcrypt.hash("Aa@123456", 10);

  if (!existingDriver1) {
    await prisma.user.create({
      data: {
        phone: driver1Phone,
        email: driver1Email,
        password_hash: hashedPassword,
        full_name: "Trần Văn Tài (Driver 1)",
        role: "XE_NANG",
        is_locked: false,
      },
    });
    console.log("Seeded Driver 1 successfully.");
  }

  // Seed Forklift Driver 2
  const driver2Phone = "0922334455";
  const driver2Email = "driver2@vinhgiang.vn";
  const existingDriver2 = await prisma.user.findFirst({
    where: { OR: [{ phone: driver2Phone }, { email: driver2Email }] },
  });

  if (!existingDriver2) {
    await prisma.user.create({
      data: {
        phone: driver2Phone,
        email: driver2Email,
        password_hash: hashedPassword,
        full_name: "Lê Văn Tiến (Driver 2)",
        role: "XE_NANG",
        is_locked: false,
      },
    });
    console.log("Seeded Driver 2 successfully.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
