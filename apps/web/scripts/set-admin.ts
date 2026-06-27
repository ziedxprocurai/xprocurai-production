import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setAdmin(email: string) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });

    console.log(`✅ Successfully set ${email} as ADMIN`);
    console.log('User details:', {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('❌ Error setting admin:', error);
    if (error instanceof Error) {
      if (error.message.includes('Record to update not found')) {
        console.error(`User with email ${email} not found. Make sure they have signed in at least once.`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: npm run set-admin your-email@example.com');
  process.exit(1);
}

setAdmin(email);
