"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { uploadToS3 } from "@/lib/s3";
import { extractYouTubeVideoId } from "@/lib/youtube";

const learningReady = () => {
  const p = prisma as unknown as Record<string, unknown>;
  const hasCourse =
    typeof (p.learningCourse as { findMany?: unknown } | undefined)?.findMany === "function";
  const hasEnrollment =
    typeof (p.learningCourseEnrollment as { findMany?: unknown } | undefined)?.findMany === "function";
  const hasModule =
    typeof (p.learningModule as { findUnique?: unknown } | undefined)?.findUnique === "function";
  const hasProgress =
    typeof (p.learningModuleProgress as { upsert?: unknown } | undefined)?.upsert === "function";
  const hasExam =
    typeof (p.learningExam as { findUnique?: unknown } | undefined)?.findUnique === "function";
  const hasExamAttempt =
    typeof (p.learningExamAttempt as { create?: unknown } | undefined)?.create === "function";
  const hasCertificate =
    typeof (p.learningCertificate as { upsert?: unknown } | undefined)?.upsert === "function";

  return hasCourse && hasEnrollment && hasModule && hasProgress && hasExam && hasExamAttempt && hasCertificate;
};

const learningNotReadyError =
  "Formación empresarial está pendiente de instalación (migración/generación de Prisma).";
const canAccessLearning = (role: string | null | undefined) => {
  return role === "ADMIN_PMD" || role === "CLIENT" || role === "CLIENT_VIEWER" || role === "STUDENT";
};

const canManageLearning = (role: string | null | undefined) => {
  return role === "ADMIN_PMD" || role === "CLIENT" || role === "CLIENT_VIEWER";
};

function normalizeEmail(raw: unknown) {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export async function listLearningProjects() {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false as const, error: "No autenticado" };
    if (!canAccessLearning(user.role)) return { success: false as const, error: "Sin permisos" };

    const where =
      user.role === "ADMIN_PMD"
        ? {}
        : user.role === "STUDENT"
        ? {
            status: "ACTIVE",
            learningCourses: {
              some: {
                deletedAt: null,
                enrollments: { some: { userId: user.id } },
              },
            },
          }
        : {
            clientUserId: user.id,
            status: "ACTIVE",
          };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, clientName: true, status: true },
    });

    return { success: true as const, projects };
  } catch (error) {
    console.error("listLearningProjects failed:", error);
    return { success: false as const, error: "No se pudo cargar la formación." };
  }
}

export async function listLearningCourses(projectId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false as const, error: "No autenticado" };
    if (!canAccessLearning(user.role)) return { success: false as const, error: "Sin permisos" };
    if (!learningReady()) return { success: false as const, error: learningNotReadyError };

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientUserId: true },
    });
    if (!project) return { success: false as const, error: "Empresa no encontrada" };

    if (user.role === "STUDENT") {
      const any = await prisma.learningCourseEnrollment.findFirst({
        where: { userId: user.id, course: { projectId, deletedAt: null } },
        select: { id: true },
      });
      if (!any) {
        return { success: true as const, courses: [] as unknown[] };
      }
    } else if (user.role !== "ADMIN_PMD" && project.clientUserId !== user.id) {
      return { success: false as const, error: "Sin permisos" };
    }

    const courses = await prisma.learningCourse.findMany({
      where:
        user.role === "STUDENT"
          ? { projectId, deletedAt: null, enrollments: { some: { userId: user.id } } }
          : { projectId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        modules: { orderBy: { order: "asc" } },
        exam: { include: { questions: { orderBy: { order: "asc" } } } },
      },
    });

    return {
      success: true as const,
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        coverUrl: c.coverUrl,
        certificateEnabled: c.certificateEnabled,
        createdAt: c.createdAt.toISOString(),
        modules: c.modules.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          order: m.order,
          youtubeVideoId: m.youtubeVideoId,
          materialsJson: m.materialsJson,
        })),
        exam: c.exam
          ? {
              id: c.exam.id,
              passingScorePercent: c.exam.passingScorePercent,
              questions: c.exam.questions.map((q) => ({
                id: q.id,
                prompt: q.prompt,
                optionsJson: q.optionsJson,
                correctIndex: q.correctIndex,
                order: q.order,
              })),
            }
          : null,
      })),
    };
  } catch (error) {
    console.error("listLearningCourses failed:", error);
    return { success: false as const, error: "No se pudieron cargar los cursos." };
  }
}

type CoursePayload = {
  projectId: string;
  title: string;
  description?: string | null;
  certificateEnabled?: boolean;
  modules: Array<{
    title: string;
    description?: string | null;
    youtube: string;
    materials?: string[] | null;
  }>;
  exam?: {
    passingScorePercent: number;
    questions: Array<{
      prompt: string;
      options: string[];
      correctIndex: number;
    }>;
  } | null;
};

export async function createLearningCourse(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false as const, error: "No autenticado" };
    if (!canManageLearning(user.role)) return { success: false as const, error: "Sin permisos" };
    if (!learningReady()) return { success: false as const, error: learningNotReadyError };

    const payloadRaw = (formData.get("payload") as string | null) || "";
    let payload: CoursePayload | null = null;
    try {
      payload = JSON.parse(payloadRaw) as CoursePayload;
    } catch {
      return { success: false as const, error: "Datos inválidos" };
    }

    if (!payload?.projectId) return { success: false as const, error: "Empresa requerida" };
    const title = (payload.title || "").trim();
    if (!title) return { success: false as const, error: "Nombre del curso requerido" };

    const project = await prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { id: true, clientUserId: true },
    });
    if (!project) return { success: false as const, error: "Empresa no encontrada" };
    if (user.role !== "ADMIN_PMD" && project.clientUserId !== user.id) {
      return { success: false as const, error: "Sin permisos" };
    }

    const modulesInput = Array.isArray(payload.modules) ? payload.modules : [];
    if (modulesInput.length === 0) return { success: false as const, error: "Agrega al menos 1 módulo" };

    const normalizedModules = modulesInput
      .map((m, idx) => {
        const mt = (m.title || "").trim();
        const videoId = extractYouTubeVideoId(m.youtube || "");
        const materials = (Array.isArray(m.materials) ? m.materials : [])
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter(Boolean);
        return {
          ok: Boolean(mt && videoId),
          title: mt,
          description: (m.description || "").trim() || null,
          youtubeVideoId: videoId,
          order: idx + 1,
          materialsJson: JSON.stringify(materials),
        };
      })
      .filter((m) => m.ok);

    if (normalizedModules.length !== modulesInput.length) {
      return { success: false as const, error: "Verifica títulos y links de YouTube de los módulos" };
    }

    const coverFile = formData.get("cover") as File | null;
    const maxCoverBytes = 12 * 1024 * 1024;
    if (coverFile && coverFile.size > maxCoverBytes) {
      return { success: false as const, error: "La carátula no debe superar los 12MB." };
    }
    if (coverFile && !String(coverFile.type || "").startsWith("image/")) {
      return { success: false as const, error: "La carátula debe ser una imagen." };
    }

    const courseId = randomUUID();

    let coverUrl: string | null = null;
    let coverKey: string | null = null;
    let coverSizeBytes: number | null = null;

    if (coverFile) {
      try {
        const ext = coverFile.name.includes(".")
          ? coverFile.name.slice(coverFile.name.lastIndexOf(".") + 1)
          : "jpg";
        coverKey = `learning/${payload.projectId}/${courseId}/cover-${randomUUID()}.${ext}`;
        const buffer = Buffer.from(await coverFile.arrayBuffer());
        coverUrl = await uploadToS3(coverKey, buffer, coverFile.type || "application/octet-stream");
        coverSizeBytes = coverFile.size;
      } catch (error) {
        console.error("Failed to upload course cover:", error);
        const message = error instanceof Error ? error.message : "";
        if (message.includes("AWS_S3_BUCKET") || message.includes("AWS_REGION")) {
          return {
            success: false as const,
            error: "S3 no está configurado en el entorno. Configura AWS_S3_BUCKET y AWS_REGION.",
          };
        }
        if (message.toLowerCase().includes("credential")) {
          return {
            success: false as const,
            error: "No hay credenciales de AWS para subir la carátula. Configura AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY.",
          };
        }
        return { success: false as const, error: "No se pudo subir la carátula." };
      }
    }

    const certificateEnabled = payload.certificateEnabled !== false;

    const exam = payload.exam || null;
    const passing = Math.max(0, Math.min(100, Number(exam?.passingScorePercent ?? 70) || 70));
    const questions = (Array.isArray(exam?.questions) ? exam?.questions : [])
      .map((q, idx) => {
        const prompt = (q.prompt || "").trim();
        const options = (Array.isArray(q.options) ? q.options : [])
          .map((o) => (o || "").trim())
          .filter(Boolean);
        const correctIndex = Number(q.correctIndex);
        const ok = Boolean(
          prompt &&
            options.length >= 2 &&
            Number.isInteger(correctIndex) &&
            correctIndex >= 0 &&
            correctIndex < options.length
        );
        return {
          ok,
          prompt,
          optionsJson: JSON.stringify(options),
          correctIndex,
          order: idx + 1,
        };
      })
      .filter((q) => q.ok);

    await prisma.$transaction(async (tx) => {
      await tx.learningCourse.create({
        data: {
          id: courseId,
          projectId: payload.projectId,
          title,
          description: (payload.description || "").trim() || null,
          coverUrl,
          coverKey,
          coverSizeBytes: coverSizeBytes ?? null,
          certificateEnabled,
          createdByUserId: user.id,
        },
      });

      await tx.learningModule.createMany({
        data: normalizedModules.map((m) => ({
          id: randomUUID(),
          courseId,
          title: m.title,
          description: m.description,
          order: m.order,
          youtubeVideoId: m.youtubeVideoId as string,
          materialsJson: m.materialsJson,
        })),
      });

      if (questions.length > 0) {
        const examId = randomUUID();
        await tx.learningExam.create({
          data: {
            id: examId,
            courseId,
            passingScorePercent: passing,
          },
        });
        await tx.learningExamQuestion.createMany({
          data: questions.map((q) => ({
            id: randomUUID(),
            examId,
            prompt: q.prompt,
            optionsJson: q.optionsJson,
            correctIndex: q.correctIndex,
            order: q.order,
          })),
        });
      }
    });

    revalidatePath("/learning");
    return { success: true as const, id: courseId };
  } catch (error) {
    console.error("createLearningCourse failed:", error);
    return { success: false as const, error: "No se pudo crear el curso." };
  }
}

export async function searchLearningStudents(query: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado", students: [] as unknown[] };
  if (!canManageLearning(user.role)) return { success: false as const, error: "Sin permisos", students: [] as unknown[] };

  const q = normalizeEmail(query) || (typeof query === "string" ? query.trim() : "");
  if (!q) return { success: true as const, students: [] as unknown[] };

  if (user.role !== "ADMIN_PMD") {
    if (!q.includes("@")) return { success: true as const, students: [] as unknown[] };
    const found = await prisma.user.findFirst({
      where: { email: q, deletedAt: null },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!found || found.role !== "STUDENT") return { success: true as const, students: [] as unknown[] };
    return { success: true as const, students: [{ id: found.id, email: found.email, name: found.name }] };
  }

  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: "STUDENT",
      OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { email: "asc" },
    take: 20,
    select: { id: true, email: true, name: true },
  });
  return { success: true as const, students: rows };
}

export async function getLearningCourseEnrollments(courseId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado", students: [] as unknown[] };
  if (!canManageLearning(user.role)) return { success: false as const, error: "Sin permisos", students: [] as unknown[] };
  if (!learningReady()) return { success: false as const, error: learningNotReadyError, students: [] as unknown[] };

  const course = await prisma.learningCourse.findUnique({
    where: { id: courseId },
    select: { id: true, project: { select: { clientUserId: true } } },
  });
  if (!course) return { success: false as const, error: "Curso no encontrado", students: [] as unknown[] };
  if (user.role !== "ADMIN_PMD" && course.project.clientUserId !== user.id) {
    return { success: false as const, error: "Sin permisos", students: [] as unknown[] };
  }

  const rows = await prisma.learningCourseEnrollment.findMany({
    where: { courseId },
    orderBy: { assignedAt: "desc" },
    select: { user: { select: { id: true, email: true, name: true } }, assignedAt: true },
  });
  return {
    success: true as const,
    students: rows.map((r) => ({ id: r.user.id, email: r.user.email, name: r.user.name, assignedAt: r.assignedAt.toISOString() })),
  };
}

export async function addStudentsToLearningCourse(courseId: string, studentIds: string[]) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!canManageLearning(user.role)) return { success: false as const, error: "Sin permisos" };
  if (!learningReady()) return { success: false as const, error: learningNotReadyError };

  const course = await prisma.learningCourse.findUnique({
    where: { id: courseId },
    select: { id: true, project: { select: { clientUserId: true } } },
  });
  if (!course) return { success: false as const, error: "Curso no encontrado" };
  if (user.role !== "ADMIN_PMD" && course.project.clientUserId !== user.id) {
    return { success: false as const, error: "Sin permisos" };
  }

  const ids = Array.isArray(studentIds) ? Array.from(new Set(studentIds.filter((x) => typeof x === "string" && x.trim()))) : [];
  if (ids.length === 0) return { success: true as const };

  const students = await prisma.user.findMany({
    where: { id: { in: ids }, deletedAt: null, role: "STUDENT" },
    select: { id: true },
  });
  const validIds = students.map((s) => s.id);
  if (validIds.length === 0) return { success: true as const };

  await prisma.learningCourseEnrollment.createMany({
    data: validIds.map((id) => ({
      id: randomUUID(),
      courseId,
      userId: id,
      assignedByUserId: user.id,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/learning");
  return { success: true as const };
}

export async function removeStudentFromLearningCourse(courseId: string, studentId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!canManageLearning(user.role)) return { success: false as const, error: "Sin permisos" };
  if (!learningReady()) return { success: false as const, error: learningNotReadyError };

  const course = await prisma.learningCourse.findUnique({
    where: { id: courseId },
    select: { id: true, project: { select: { clientUserId: true } } },
  });
  if (!course) return { success: false as const, error: "Curso no encontrado" };
  if (user.role !== "ADMIN_PMD" && course.project.clientUserId !== user.id) {
    return { success: false as const, error: "Sin permisos" };
  }

  await prisma.learningCourseEnrollment.deleteMany({
    where: { courseId, userId: studentId },
  });

  revalidatePath("/learning");
  return { success: true as const };
}

export async function markLearningModuleCompleted(moduleId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!canAccessLearning(user.role)) return { success: false as const, error: "Sin permisos" };
  if (!learningReady()) return { success: false as const, error: learningNotReadyError };

  const learningModule = await prisma.learningModule.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, course: { select: { projectId: true, project: { select: { clientUserId: true } } } } },
  });
  if (!learningModule) return { success: false as const, error: "Módulo no encontrado" };

  if (user.role === "STUDENT") {
    const enrolled = await prisma.learningCourseEnrollment.findFirst({
      where: { courseId: learningModule.courseId, userId: user.id },
      select: { id: true },
    });
    if (!enrolled) return { success: false as const, error: "Sin permisos" };
  } else if (user.role !== "ADMIN_PMD" && learningModule.course.project.clientUserId !== user.id) {
    return { success: false as const, error: "Sin permisos" };
  }

  await prisma.learningModuleProgress.upsert({
    where: { moduleId_userId: { moduleId, userId: user.id } },
    update: { completedAt: new Date() },
    create: { id: randomUUID(), moduleId, userId: user.id },
  });

  revalidatePath("/learning");
  return { success: true as const };
}

export async function getLearningStudentState(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!canAccessLearning(user.role)) return { success: false as const, error: "Sin permisos" };
  if (!learningReady()) return { success: false as const, error: learningNotReadyError };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientUserId: true },
  });
  if (!project) return { success: false as const, error: "Empresa no encontrada" };
  if (user.role === "STUDENT") {
    const any = await prisma.learningCourseEnrollment.findFirst({
      where: { userId: user.id, course: { projectId, deletedAt: null } },
      select: { id: true },
    });
    if (!any) return { success: false as const, error: "Sin permisos" };
  } else if (user.role !== "ADMIN_PMD" && project.clientUserId !== user.id) {
    return { success: false as const, error: "Sin permisos" };
  }

  const [progress, attempts, certificates] = await Promise.all([
    prisma.learningModuleProgress.findMany({
      where:
        user.role === "STUDENT"
          ? { userId: user.id, module: { course: { projectId } } }
          : { userId: user.id },
      select: { moduleId: true, completedAt: true },
    }),
    prisma.learningExamAttempt.findMany({
      where:
        user.role === "STUDENT"
          ? { userId: user.id, exam: { course: { projectId } } }
          : { userId: user.id },
      select: { examId: true, scorePercent: true, passed: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.learningCertificate.findMany({
      where:
        user.role === "STUDENT"
          ? { userId: user.id, course: { projectId } }
          : { userId: user.id },
      select: { courseId: true, issuedAt: true },
    }),
  ]);

  return {
    success: true as const,
    progress: progress.map((p) => ({ moduleId: p.moduleId, completedAt: p.completedAt.toISOString() })),
    attempts: attempts.map((a) => ({ examId: a.examId, scorePercent: a.scorePercent, passed: a.passed, createdAt: a.createdAt.toISOString() })),
    certificates: certificates.map((c) => ({ courseId: c.courseId, issuedAt: c.issuedAt.toISOString() })),
  };
}

export async function submitLearningExamAttempt(examId: string, answers: number[]) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!canAccessLearning(user.role)) return { success: false as const, error: "Sin permisos" };
  if (!learningReady()) return { success: false as const, error: learningNotReadyError };

  const exam = await prisma.learningExam.findUnique({
    where: { id: examId },
    include: {
      course: { select: { id: true, projectId: true, certificateEnabled: true, project: { select: { clientUserId: true } } } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!exam) return { success: false as const, error: "Examen no encontrado" };

  if (user.role === "STUDENT") {
    const enrolled = await prisma.learningCourseEnrollment.findFirst({
      where: { courseId: exam.course.id, userId: user.id },
      select: { id: true },
    });
    if (!enrolled) return { success: false as const, error: "Sin permisos" };
  } else if (user.role !== "ADMIN_PMD" && exam.course.project.clientUserId !== user.id) {
    return { success: false as const, error: "Sin permisos" };
  }

  const questions = exam.questions;
  if (questions.length === 0) return { success: false as const, error: "Examen sin preguntas" };

  const safeAnswers = Array.isArray(answers) ? answers : [];
  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    const expected = questions[i].correctIndex;
    const given = Number(safeAnswers[i]);
    if (Number.isInteger(given) && given === expected) correct += 1;
  }
  const scorePercent = Math.round((correct / questions.length) * 100);
  const passed = scorePercent >= exam.passingScorePercent;
  const attemptId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.learningExamAttempt.create({
      data: {
        id: attemptId,
        examId,
        userId: user.id,
        scorePercent,
        passed,
      },
    });
    if (passed && exam.course.certificateEnabled) {
      await tx.learningCertificate.upsert({
        where: { courseId_userId: { courseId: exam.course.id, userId: user.id } },
        update: { attemptId, issuedAt: new Date() },
        create: { id: randomUUID(), courseId: exam.course.id, userId: user.id, attemptId },
      });
    }
  });

  revalidatePath("/learning");
  return { success: true as const, scorePercent, passed, courseId: exam.course.id };
}
