
import 'dotenv/config';
import { prisma } from '../server/db.js';
import bcrypt from 'bcryptjs';

async function main() {
  const steps = [
    { id: 'quotation_request', label: 'Quotation Request', color: '#6366f1', position: 1 },
    { id: 'proforma_invoice', label: 'Proforma Invoice', color: '#8b5cf6', position: 2 },
    { id: 'po_received', label: 'PO Received', color: '#ec4899', position: 3 },
    { id: 'tax_invoice_shared', label: 'Tax Invoice Shared', color: '#10b981', position: 4 }
  ];

  console.log('Seeding default workflow steps...');
  for (const step of steps) {
    const s = await prisma.workflowStep.upsert({
      where: { id: step.id },
      update: step,
      create: step
    });
    console.log(`- ${s.label} (${s.id})`);
  }

  // Seed a fictional administrator account only.
  const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@example.com';
  const adminName = process.env.DEMO_ADMIN_NAME || 'Demo Administrator';
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
  const password = demoPassword && demoPassword.length >= 12
    ? await bcrypt.hash(demoPassword, 12)
    : undefined;
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin', displayName: adminName, ...(password ? { password } : {}) },
    create: {
      email: adminEmail,
      displayName: adminName,
      role: 'admin',
      password,
    }
  });
  console.log('Demo administrator is ready.');
  console.log('✨ Database seeding complete!');
}

main()
  .catch(e => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
