import { PrismaClient } from '../../node_modules/.prisma/master-client';
const prisma = new PrismaClient();

async function main() {
  const tenants = [
    {
      code: 'velasco',
      name: 'Centro de Endocrinología Velasco',
      dbName: 'clinic_velasco',
    },
    {
      code: 'clinic_b',
      name: 'Clínica B',
      dbName: 'clinic_b',
    },
  ];

  for (const t of tenants) {
    const exists = await prisma.tenant.findUnique({ where: { code: t.code } });
    if (!exists) {
      await prisma.tenant.create({ data: t });
      console.log(`✅ Tenant creado: ${t.name}`);
    } else {
      console.log(`⚠️ Tenant ya existe: ${t.name}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
