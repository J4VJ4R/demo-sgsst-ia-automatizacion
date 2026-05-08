import prisma from "@/lib/prisma";

async function main() {
  const [projects, usersActive, usersDeleted, activities, collaborators, accidentalidad, equipments] = await Promise.all([
    prisma.project.count(),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: { not: null } } }),
    prisma.activity.count(),
    prisma.collaborator.count(),
    prisma.accidentalidadEmpresa.count(),
    prisma.inspectionEquipment.count(),
  ]);

  console.log({
    projects,
    usersActive,
    usersDeleted,
    activities,
    collaborators,
    accidentalidad,
    equipments,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

