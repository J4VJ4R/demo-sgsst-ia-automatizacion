import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // SAFEGUARD: Prevent accidental data loss in production
  // Check if users already exist to avoid resetting the DB
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('Database already has data. Skipping seed to prevent data loss.');
    return;
  }

  // Clean up existing data ONLY if explicitly forced (e.g. locally)
  // For now, we will assume if we reached here (count=0), we can create data.
  // But we won't run deleteMany() to be extra safe.
  
  /* 
  try {
    await prisma.notification.deleteMany();
    await prisma.document.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany(); 
  } catch (error) {
    console.log('Error cleaning up data (tables might not exist yet):', error);
  }
  */

  const demoPassword = 'demo2026';
  const demoPasswordHashed = await hash(demoPassword, 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@autoavanzada.com',
      name: 'Miguel Hernández',
      role: 'ADMIN_PMD',
      password: demoPasswordHashed,
      image: 'https://ui-avatars.com/api/?name=Miguel+Hernandez&background=FACC15&color=0B1220',
    },
  });

  const inspector = await prisma.user.create({
    data: {
      email: 'inspector@autoavanzada.com',
      name: 'Inspector SST',
      role: 'CLIENT',
      password: demoPasswordHashed,
      image: 'https://ui-avatars.com/api/?name=Inspector+SST&background=0B1220&color=FACC15',
    },
  });

  const operario = await prisma.user.create({
    data: {
      email: 'operario@autoavanzada.com',
      name: 'Colaborador Operario',
      role: 'STUDENT',
      password: demoPasswordHashed,
      image: 'https://ui-avatars.com/api/?name=Operario&background=334155&color=FACC15',
    },
  });

  console.log('Users created.');

  const project = await prisma.project.create({
    data: {
      name: 'Automatización Avanzada S.A.S',
      clientName: 'Automatización Avanzada S.A.S',
      description: 'SG-SST-IA (Analítica Predictiva) - Demo',
      consultant: { connect: { id: admin.id } },
      clientUser: { connect: { id: inspector.id } },
      department: 'Bogotá D.C.',
      municipality: 'Bogotá',
      status: 'ACTIVE',
      economicActivity: 'Automatizaciones y energía',
      riskLevel: '5',
      nit: '901205325-8',
      workerCount: 120,
    },
  });

  console.log('Project created.');

  const ptaMay2026 = [
    { title: 'Mantenimiento Preventivo de Subestaciones', assignedToId: inspector.id, dueDate: new Date('2026-05-10T09:00:00.000Z') },
    { title: 'Auditoría de EPP Dieléctricos', assignedToId: admin.id, dueDate: new Date('2026-05-18T09:00:00.000Z') },
    { title: 'Simulacro de Rescate Eléctrico', assignedToId: inspector.id, dueDate: new Date('2026-05-26T09:00:00.000Z') },
  ];

  for (const item of ptaMay2026) {
    await prisma.activity.create({
      data: {
        title: `PTA 2026: ${item.title}`,
        status: 'PENDING',
        priority: 'MEDIUM',
        periodicity: 'ANUAL',
        projectId: project.id,
        assignedToId: item.assignedToId,
        dueDate: item.dueDate,
      },
    });
  }

  console.log('PTA activities created.');

  const inspections = [
    {
      title: 'Inspección en campo - Riesgo Eléctrico #1',
      findings: ['Violación de distancias de seguridad en M.T.'],
      dueDate: new Date('2026-04-06T14:00:00.000Z'),
    },
    {
      title: 'Inspección en campo - Riesgo Eléctrico #2',
      findings: ['Herramientas sin aislamiento dieléctrico'],
      dueDate: new Date('2026-04-09T14:00:00.000Z'),
    },
    {
      title: 'Inspección en campo - Riesgo Eléctrico #3',
      findings: ['Estructuras defectuosas'],
      dueDate: new Date('2026-04-12T14:00:00.000Z'),
    },
    {
      title: 'Inspección en campo - Riesgo Eléctrico #4',
      findings: ['Proximidad mínima no respetada en B.T.', 'Señalización incompleta en área de trabajo'],
      dueDate: new Date('2026-04-15T14:00:00.000Z'),
    },
    {
      title: 'Inspección en campo - Riesgo Eléctrico #5',
      findings: ['Procedimiento de bloqueo y etiquetado (LOTO) incompleto'],
      dueDate: new Date('2026-04-18T14:00:00.000Z'),
      predictive: { arcProbPct: 75 },
    },
  ] as const;

  for (const [index, i] of inspections.entries()) {
    const activity = await prisma.activity.create({
      data: {
        title: i.title,
        status: 'IN_REVIEW',
        priority: index === 4 ? 'HIGH' : 'MEDIUM',
        projectId: project.id,
        assignedToId: inspector.id,
        dueDate: i.dueDate,
      },
    });

    const document = await prisma.document.create({
      data: {
        name: `Evidencia - ${i.title}.pdf`,
        url: `https://example.com/demo/autoavanzada/evidencias/inspeccion-${index + 1}.pdf`,
        activityId: activity.id,
        uploadedByUserId: inspector.id,
        version: 1,
        sizeBytes: 245_000,
      },
    });

    const findingsText = i.findings.map((f) => `- ${f}`).join('\n');
    const predictiveText =
      'predictive' in i && i.predictive
        ? `\n\nAnalítica Predictiva:\n- Probabilidad de Arco Eléctrico: ${i.predictive.arcProbPct}%`
        : '';

    await prisma.activityReply.create({
      data: {
        activityId: activity.id,
        documentId: document.id,
        message: `Hallazgos:\n${findingsText}${predictiveText}`,
        createdByUserId: inspector.id,
      },
    });

    if ('predictive' in i && i.predictive) {
      const title = `Alerta Preventiva: Probabilidad de Arco Eléctrico ${i.predictive.arcProbPct}%`;
      const message = `Se detectó una probabilidad elevada de arco eléctrico (${i.predictive.arcProbPct}%) en la inspección. Revisar controles, distancias de seguridad y EPP dieléctrico.`;

      await prisma.notification.create({
        data: {
          recipientId: admin.id,
          title,
          message,
          type: 'SYSTEM_ALERT',
          priority: 'HIGH',
          category: 'OPERATIONAL',
          functionalArea: 'SST',
          activityId: activity.id,
        },
      });

      await prisma.notification.create({
        data: {
          recipientId: inspector.id,
          title,
          message,
          type: 'SYSTEM_ALERT',
          priority: 'HIGH',
          category: 'OPERATIONAL',
          functionalArea: 'SST',
          activityId: activity.id,
        },
      });
    }
  }

  console.log('Inspections created.');

  const course1 = await prisma.learningCourse.create({
    data: {
      projectId: project.id,
      title: 'Certificación en Riesgo Eléctrico (A.T/M.T)',
      description: 'Curso de certificación con enfoque en prevención, distancias de seguridad y control de energías peligrosas.',
      createdByUserId: admin.id,
    },
  });

  const course2 = await prisma.learningCourse.create({
    data: {
      projectId: project.id,
      title: 'Seguridad en Alturas para el Sector Energía',
      description: 'Curso de formación para trabajo seguro en alturas en entornos de energía.',
      createdByUserId: admin.id,
    },
  });

  const course1Module1 = await prisma.learningModule.create({
    data: {
      courseId: course1.id,
      title: 'Distancias de seguridad y proximidad mínima',
      description: 'Criterios prácticos para A.T/M.T/B.T.',
      order: 1,
      youtubeVideoId: 'dQw4w9WgXcQ',
      materialsJson: '[]',
    },
  });

  const course1Module2 = await prisma.learningModule.create({
    data: {
      courseId: course1.id,
      title: 'EPP dieléctrico y control de herramientas',
      description: 'Selección, inspección y uso.',
      order: 2,
      youtubeVideoId: 'dQw4w9WgXcQ',
      materialsJson: '[]',
    },
  });

  const course1Modules = [course1Module1, course1Module2];

  await prisma.learningModule.createMany({
    data: [
      {
        courseId: course2.id,
        title: 'Fundamentos de trabajo seguro en alturas',
        description: 'Riesgos, controles y responsabilidades.',
        order: 1,
        youtubeVideoId: 'dQw4w9WgXcQ',
        materialsJson: '[]',
      },
      {
        courseId: course2.id,
        title: 'Rescate y respuesta a emergencias',
        description: 'Prácticas y protocolos.',
        order: 2,
        youtubeVideoId: 'dQw4w9WgXcQ',
        materialsJson: '[]',
      },
    ],
  });

  await prisma.learningCourseEnrollment.create({
    data: {
      courseId: course1.id,
      userId: operario.id,
      assignedByUserId: admin.id,
    },
  });

  await prisma.learningCourseEnrollment.create({
    data: {
      courseId: course2.id,
      userId: operario.id,
      assignedByUserId: admin.id,
    },
  });

  await prisma.learningModuleProgress.createMany({
    data: course1Modules.map((m) => ({
      moduleId: m.id,
      userId: operario.id,
      completedAt: new Date('2026-04-02T12:00:00.000Z'),
    })),
  });

  console.log('Learning demo data created.');
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
