import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('demo1234', 10)

  await prisma.user.upsert({
    where: { email: 'dev@demo.com' },
    update: {},
    create: {
      name: 'Demo Developer',
      email: 'dev@demo.com',
      password: hashedPassword,
      role: Role.DEV,
    },
  })

  await prisma.user.upsert({
    where: { email: 'manager@demo.com' },
    update: {},
    create: {
      name: 'Demo Manager',
      email: 'manager@demo.com',
      password: hashedPassword,
      role: Role.MANAGER,
    },
  })

  console.log('✅ Seeded demo users:')
  console.log('   dev@demo.com     / demo1234  (DEV)')
  console.log('   manager@demo.com / demo1234  (MANAGER)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
